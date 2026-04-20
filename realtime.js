// Realtime market data integration
// Fetches live quotes from Yahoo Finance via public CORS proxies.
// Exposes a global `RT` namespace and React hooks on window.

(function () {
  // Map our internal symbols to Yahoo Finance tickers
  const YAHOO_MAP = {
    // Taiwan listed ETFs / stocks use .TW suffix
    '0050':   '0050.TW',
    '006208': '006208.TW',
    '2330':   '2330.TW',
    // US tickers pass through
    'VT': 'VT', 'VTI': 'VTI', 'VOO': 'VOO',
    'BND': 'BND', 'IEF': 'IEF', 'GLD': 'GLD',
    // Cash has no live price
    'CASH': null,
  };

  // Index / macro symbols for the topbar and macro snapshot
  const INDEX_MAP = {
    TWSE:      '^TWII',
    'S&P500':  '^GSPC',
    NDX:       '^NDX',
    'USD/TWD': 'TWD=X',
    GOLD:      'GC=F',
    VIX:       '^VIX',
    US10Y:     '^TNX',
  };

  const PROXIES = [
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
  ];

  async function fetchWithProxy(url) {
    let lastErr;
    for (const proxy of PROXIES) {
      try {
        const res = await fetch(proxy(url), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('All proxies failed');
  }

  // Yahoo chart endpoint returns last close, previous close and meta
  async function fetchYahooQuote(ticker) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const json = await fetchWithProxy(url);
    const r = json?.chart?.result?.[0];
    if (!r) throw new Error('No data for ' + ticker);
    const m = r.meta || {};
    const price = m.regularMarketPrice ?? r.indicators?.quote?.[0]?.close?.slice(-1)?.[0];
    const prev  = m.chartPreviousClose ?? m.previousClose;
    const chg   = (price != null && prev != null) ? price - prev : 0;
    const chgPct= (price != null && prev) ? (chg / prev) * 100 : 0;
    return {
      ticker,
      price,
      previousClose: prev,
      change: chg,
      changePct: chgPct,
      currency: m.currency,
      marketState: m.marketState,
      time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000) : new Date(),
    };
  }

  async function fetchMany(tickers) {
    const results = await Promise.allSettled(tickers.map(fetchYahooQuote));
    const out = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') out[tickers[i]] = r.value;
    });
    return out;
  }

  // Yahoo historical closes. range: 1mo|3mo|6mo|1y|2y|5y|10y|max
  async function fetchYahooHistory(ticker, { range = '10y', interval = '1mo' } = {}) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
    const json = await fetchWithProxy(url);
    const r = json?.chart?.result?.[0];
    if (!r) throw new Error('No history for ' + ticker);
    const timestamps = r.timestamp || [];
    const closes = r.indicators?.adjclose?.[0]?.adjclose
              ?? r.indicators?.quote?.[0]?.close
              ?? [];
    return timestamps.map((t, i) => ({
      date: new Date(t * 1000),
      close: closes[i],
    })).filter(p => p.close != null);
  }

  async function fetchHistoryMany(tickers, opts) {
    const results = await Promise.allSettled(tickers.map(t => fetchYahooHistory(t, opts)));
    const out = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') out[tickers[i]] = r.value;
    });
    return out;
  }

  // Yahoo Finance news search. Returns normalised news items.
  async function fetchYahooNews(query, count = 6) {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${count}&quotesCount=0`;
    const json = await fetchWithProxy(url);
    const news = json?.news || [];
    return news.map((n) => ({
      id: n.uuid || n.link,
      title: n.title,
      publisher: n.publisher || '—',
      summary: n.summary || '',
      link: n.link,
      time: n.providerPublishTime ? new Date(n.providerPublishTime * 1000) : null,
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
      tickers: n.relatedTickers || [],
      query,
    }));
  }

  async function fetchNewsMany(queries, countEach = 4) {
    const results = await Promise.allSettled(queries.map(q => fetchYahooNews(q, countEach)));
    const merged = [];
    const seen = new Set();
    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      r.value.forEach((n) => {
        if (!n.id || seen.has(n.id)) return;
        seen.add(n.id);
        merged.push(n);
      });
    });
    merged.sort((a, b) => (b.time?.getTime() || 0) - (a.time?.getTime() || 0));
    return merged;
  }

  // ── React hook ────────────────────────────────────────────────
  const { useState, useEffect, useRef, useCallback } = React;

  // ── Persistent holdings store (localStorage + pub/sub) ────────
  const HOLDINGS_KEY = 'ai-advisor-holdings-v1';
  let _holdings = null;
  const _holdingsListeners = new Set();

  function _load() {
    try {
      const raw = localStorage.getItem(HOLDINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DATA.holdings.map(h => ({ ...h }));
  }

  function getHoldings() {
    if (_holdings === null) _holdings = _load();
    return _holdings;
  }

  function setHoldingsStore(next) {
    _holdings = Array.isArray(next) ? next : [];
    try { localStorage.setItem(HOLDINGS_KEY, JSON.stringify(_holdings)); } catch {}
    _holdingsListeners.forEach((fn) => fn(_holdings));
  }

  function resetHoldingsStore() {
    try { localStorage.removeItem(HOLDINGS_KEY); } catch {}
    _holdings = DATA.holdings.map(h => ({ ...h }));
    _holdingsListeners.forEach((fn) => fn(_holdings));
  }

  function useHoldings() {
    const [state, set] = useState(getHoldings);
    useEffect(() => {
      _holdingsListeners.add(set);
      return () => { _holdingsListeners.delete(set); };
    }, []);
    return [state, setHoldingsStore];
  }

  // Cross-tab sync
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === HOLDINGS_KEY) {
        try { _holdings = JSON.parse(e.newValue) || []; } catch { _holdings = []; }
        _holdingsListeners.forEach((fn) => fn(_holdings));
      }
    });
  }

  function useLiveQuotes(symbols, { intervalMs = 60000 } = {}) {
    const [quotes, setQuotes] = useState({});
    const [status, setStatus] = useState('idle'); // idle | loading | live | error
    const [updatedAt, setUpdatedAt] = useState(null);
    const [error, setError] = useState(null);
    const tickers = symbols.filter(Boolean);
    const key = tickers.join(',');
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
      if (!tickers.length) return;
      setStatus((s) => (s === 'live' ? 'live' : 'loading'));
      try {
        const data = await fetchMany(tickers);
        if (!mountedRef.current) return;
        if (!Object.keys(data).length) throw new Error('No quotes returned');
        setQuotes(data);
        setStatus('live');
        setUpdatedAt(new Date());
        setError(null);
      } catch (e) {
        if (!mountedRef.current) return;
        setStatus('error');
        setError(e.message || String(e));
      }
    }, [key]);

    useEffect(() => {
      mountedRef.current = true;
      refresh();
      const id = setInterval(refresh, intervalMs);
      const onVisible = () => { if (!document.hidden) refresh(); };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        mountedRef.current = false;
        clearInterval(id);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }, [refresh, intervalMs]);

    return { quotes, status, updatedAt, error, refresh };
  }

  function useLiveNews(queries, { intervalMs = 5 * 60 * 1000, countEach = 4 } = {}) {
    const [news, setNews] = useState([]);
    const [status, setStatus] = useState('idle');
    const [updatedAt, setUpdatedAt] = useState(null);
    const [error, setError] = useState(null);
    const key = queries.filter(Boolean).join('|');
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
      if (!queries.length) return;
      setStatus((s) => s === 'live' ? 'live' : 'loading');
      try {
        const data = await fetchNewsMany(queries, countEach);
        if (!mountedRef.current) return;
        if (!data.length) throw new Error('No news');
        setNews(data);
        setStatus('live');
        setUpdatedAt(new Date());
        setError(null);
      } catch (e) {
        if (!mountedRef.current) return;
        setStatus('error');
        setError(e.message || String(e));
      }
    }, [key]);

    useEffect(() => {
      mountedRef.current = true;
      refresh();
      const id = setInterval(refresh, intervalMs);
      return () => { mountedRef.current = false; clearInterval(id); };
    }, [refresh, intervalMs]);

    return { news, status, updatedAt, error, refresh };
  }

  function useLiveHistory(tickers, { range = '10y', interval = '1mo' } = {}) {
    const [history, setHistory] = useState({});
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const key = tickers.filter(Boolean).join(',') + ':' + range + ':' + interval;
    const mountedRef = useRef(true);

    useEffect(() => {
      mountedRef.current = true;
      if (!tickers.length) return;
      setStatus('loading');
      fetchHistoryMany(tickers, { range, interval })
        .then((data) => {
          if (!mountedRef.current) return;
          if (!Object.keys(data).length) throw new Error('No history returned');
          setHistory(data);
          setStatus('live');
          setError(null);
        })
        .catch((e) => {
          if (!mountedRef.current) return;
          setStatus('error');
          setError(e.message || String(e));
        });
      return () => { mountedRef.current = false; };
    }, [key]);

    return { history, status, error };
  }

  // Infer the trading currency of a symbol.
  function inferCurrency(symbol) {
    const s = (symbol || '').toUpperCase();
    if (s === 'CASH') return 'TWD';
    if (/^\d{4,6}$/.test(s)) return 'TWD';     // Taiwan listed
    return 'USD';                              // default to US
  }

  // Merge live quotes into DATA.holdings, producing a new array.
  function applyQuotesToHoldings(holdings, quotes) {
    return holdings.map((h) => {
      const ticker = YAHOO_MAP[h.symbol];
      const q = ticker ? quotes[ticker] : null;
      const currency = h.currency || inferCurrency(h.symbol);
      if (!q || q.price == null) return { ...h, currency, live: false };
      return { ...h, currency: q.currency || currency, price: q.price, change: q.change, changePct: q.changePct, live: true };
    });
  }

  // Convert a holding's market value to TWD given a USD/TWD rate.
  function holdingMarketValueTWD(h, usdTwd) {
    const mv = h.shares * h.price;
    if ((h.currency || inferCurrency(h.symbol)) === 'USD' && usdTwd) return mv * usdTwd;
    return mv;
  }

  function totalValueTWD(holdings, usdTwd) {
    return holdings.reduce((s, h) => s + holdingMarketValueTWD(h, usdTwd), 0);
  }

  function totalCostTWD(holdings, usdTwd) {
    return holdings.reduce((s, h) => {
      const cost = h.shares * (h.cost || 0);
      if ((h.currency || inferCurrency(h.symbol)) === 'USD' && usdTwd) return s + cost * usdTwd;
      return s + cost;
    }, 0);
  }

  function holdingsToTickers(holdings) {
    return holdings.map((h) => YAHOO_MAP[h.symbol]).filter(Boolean);
  }

  // Format age as "剛剛" / "N 秒前" / "N 分鐘前"
  function relTime(date) {
    if (!date) return '—';
    const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (s < 5)  return '剛剛';
    if (s < 60) return `${s} 秒前`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} 分鐘前`;
    const h = Math.floor(m / 60);
    return `${h} 小時前`;
  }

  // ── Live allocation + signal generation ──────────────────────

  // Compute live sector allocation from holdings. Returns new array based on
  // the sector list in DATA.allocation (targets), with current% filled live.
  function computeLiveAllocation(holdings, targets, usdTwd) {
    const total = totalValueTWD(holdings, usdTwd) || 1;
    const bySector = {};
    holdings.forEach((h) => {
      bySector[h.sector] = (bySector[h.sector] || 0) + holdingMarketValueTWD(h, usdTwd);
    });
    return targets.map((t) => {
      const mv = bySector[t.name] || 0;
      return { ...t, current: (mv / total) * 100, mv };
    });
  }

  // Generate dynamic signals from the live allocation deviation.
  // Only returns items with meaningful deviation (|delta| >= 3pp).
  function generateAllocationSignals(allocation, totalValue) {
    const out = [];
    allocation.forEach((a) => {
      const delta = a.current - a.target;
      const abs = Math.abs(delta);
      if (abs < 3) return;
      const over = delta > 0;
      const level = abs >= 7 ? 'high' : abs >= 5 ? 'medium' : 'low';
      const amount = Math.round((abs / 100) * totalValue);
      out.push({
        id: 'live-' + a.name,
        level,
        type: over ? 'concentration' : 'rebalance',
        title: `${a.name}部位${over?'超出':'低於'}目標 ${abs.toFixed(1)} 個百分點`,
        summary: `目前 ${a.name} 佔比 ${a.current.toFixed(1)}%(目標 ${a.target}%)。建議${over?'分批減碼':'分批加碼'}約 NT$${amount.toLocaleString()}。`,
        confidence: Math.min(95, 60 + Math.round(abs * 3)),
        triggers: over ? ['over-weight'] : ['under-weight'],
        action: over ? 'sell' : 'buy',
        magnitude: `NT$${amount.toLocaleString()}`,
        time: '即時',
        live: true,
      });
    });
    // Sort: high first, then by magnitude
    const levelRank = { high: 0, medium: 1, low: 2, info: 3 };
    return out.sort((a, b) => levelRank[a.level] - levelRank[b.level]);
  }

  // Generate a concrete rebalance plan from live holdings + target allocation.
  // For each sector deviation, pick the largest holding in that sector to
  // sell (if over-weight) or the most expensive/biggest holding to buy (if
  // under-weight). Returns orders with symbol, name, action, shares, amount.
  function generateRebalancePlan(holdings, allocation) {
    const totalMV = holdings.reduce((s,h) => s + h.shares * h.price, 0) || 1;
    const plan = [];
    allocation.forEach((a) => {
      const delta = a.current - a.target; // positive = over-weight
      if (Math.abs(delta) < 2) return;
      const sectorHoldings = holdings.filter(h => h.sector === a.name && h.symbol !== 'CASH' && h.price > 0);
      if (!sectorHoldings.length) return;
      const amount = Math.round(Math.abs(delta) / 100 * totalMV);
      if (delta > 0) {
        // over-weight → sell largest holding
        const pick = [...sectorHoldings].sort((x,y) => (y.shares*y.price) - (x.shares*x.price))[0];
        const shares = Math.max(1, Math.floor(amount / pick.price));
        plan.push({
          symbol: pick.symbol, name: pick.name, action: 'sell',
          shares, amount: shares * pick.price, pct: -Math.abs(delta),
          reason: `${a.name}超出目標 ${Math.abs(delta).toFixed(1)}pp`,
        });
      } else {
        // under-weight → buy first holding or flag to open new one
        const pick = sectorHoldings[0];
        const shares = Math.max(1, Math.floor(amount / pick.price));
        plan.push({
          symbol: pick.symbol, name: pick.name, action: 'buy',
          shares, amount: shares * pick.price, pct: Math.abs(delta),
          reason: `${a.name}低於目標 ${Math.abs(delta).toFixed(1)}pp`,
        });
      }
    });
    return plan;
  }

  // Compute annual returns from a list of monthly close points.
  function annualReturnsFromMonthly(points) {
    const byYear = {};
    points.forEach((p) => {
      const y = p.date.getUTCFullYear();
      (byYear[y] ||= []).push(p.close);
    });
    const years = Object.keys(byYear).map(Number).sort();
    const rets = [];
    years.forEach((y, i) => {
      if (i === 0) return;
      const prev = byYear[years[i-1]];
      const cur  = byYear[y];
      const start = prev[prev.length - 1];
      const end   = cur[cur.length - 1];
      if (start && end) rets.push({ year: y, ret: (end/start - 1) * 100 });
    });
    return rets;
  }

  // Scale DATA.allocation targets by a risk profile.
  // Groups sectors into 股 / 債 / 另類 and reweights to match risk-based ratios,
  // then distributes within each group proportionally to DATA.allocation.
  const RISK_MIX = {
    conservative: { stock: 30, bond: 60, other: 10 },
    moderate:     { stock: 64, bond: 20, other: 16 },
    aggressive:   { stock: 85, bond: 10, other:  5 },
  };
  const STOCK_SECTORS = ['美股','台股','全球'];
  const BOND_SECTORS  = ['債券'];
  function targetsForRisk(baseAllocation, risk) {
    const mix = RISK_MIX[risk] || RISK_MIX.moderate;
    const groupOf = (name) => STOCK_SECTORS.includes(name) ? 'stock'
                            : BOND_SECTORS.includes(name)  ? 'bond' : 'other';
    const groupBaseTotal = { stock: 0, bond: 0, other: 0 };
    baseAllocation.forEach(a => { groupBaseTotal[groupOf(a.name)] += a.target; });
    return baseAllocation.map(a => {
      const g = groupOf(a.name);
      const scale = groupBaseTotal[g] ? mix[g] / groupBaseTotal[g] : 1;
      return { ...a, target: Math.round(a.target * scale * 10) / 10 };
    });
  }

  // Re-render hook: returns `Date.now()` refreshed every `intervalMs`.
  // Components that read `relTime(updatedAt)` can call this to keep labels fresh.
  function useNow(intervalMs = 15000) {
    const [, force] = React.useState(0);
    React.useEffect(() => {
      const t = setInterval(() => force((x) => x + 1), intervalMs);
      return () => clearInterval(t);
    }, [intervalMs]);
    return Date.now();
  }

  window.RT = {
    YAHOO_MAP,
    INDEX_MAP,
    fetchYahooQuote,
    fetchMany,
    fetchYahooHistory,
    fetchHistoryMany,
    fetchYahooNews,
    fetchNewsMany,
    annualReturnsFromMonthly,
    computeLiveAllocation,
    generateAllocationSignals,
    generateRebalancePlan,
    inferCurrency,
    targetsForRisk,
    holdingMarketValueTWD,
    totalValueTWD,
    totalCostTWD,
    applyQuotesToHoldings,
    holdingsToTickers,
    relTime,
  };
  window.useLiveQuotes = useLiveQuotes;
  window.useLiveHistory = useLiveHistory;
  window.useLiveNews = useLiveNews;
  window.useHoldings = useHoldings;
  window.useNow = useNow;
  window.RT.getHoldings = getHoldings;
  window.RT.setHoldings = setHoldingsStore;
  window.RT.resetHoldings = resetHoldingsStore;
})();
