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

  // ── React hook ────────────────────────────────────────────────
  const { useState, useEffect, useRef, useCallback } = React;

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
      return () => { mountedRef.current = false; clearInterval(id); };
    }, [refresh, intervalMs]);

    return { quotes, status, updatedAt, error, refresh };
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

  // Merge live quotes into DATA.holdings, producing a new array.
  function applyQuotesToHoldings(holdings, quotes) {
    return holdings.map((h) => {
      const ticker = YAHOO_MAP[h.symbol];
      const q = ticker ? quotes[ticker] : null;
      if (!q || q.price == null) return { ...h, live: false };
      return { ...h, price: q.price, change: q.change, changePct: q.changePct, live: true };
    });
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
  function computeLiveAllocation(holdings, targets) {
    const total = holdings.reduce((s, h) => s + h.shares * h.price, 0) || 1;
    const bySector = {};
    holdings.forEach((h) => {
      bySector[h.sector] = (bySector[h.sector] || 0) + h.shares * h.price;
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

  window.RT = {
    YAHOO_MAP,
    INDEX_MAP,
    fetchYahooQuote,
    fetchMany,
    fetchYahooHistory,
    fetchHistoryMany,
    annualReturnsFromMonthly,
    computeLiveAllocation,
    generateAllocationSignals,
    applyQuotesToHoldings,
    holdingsToTickers,
    relTime,
  };
  window.useLiveQuotes = useLiveQuotes;
  window.useLiveHistory = useLiveHistory;
})();
