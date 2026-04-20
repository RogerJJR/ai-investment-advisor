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

  // ── Narrative Regimes ─────────────────────────────────────────
  // Chuang (2026) "Narrative Regimes: LLM-Augmented Strategic Asset
  // Allocation for Long-Horizon Investors". Three-regime Bayesian filter
  // with regime-policy-mix allocator. Paper constants from Appendix C.
  const NR_ASSET_ORDER = ['美股','全球','台股','債券','原物料','現金'];
  // Mapping to paper's 7-asset universe (annualised %).
  // US eq, Intl dev, EM eq, Treasuries, Corp bonds, Commodities, REITs.
  // 美股=US, 全球=avg(Intl, REITs), 台股=EM, 債券=avg(Treasury, Corp), 原物料=Commodities.
  // 現金 has no paper equivalent: 2% risk-free, 0.5% vol.
  const NR_REGIMES = [
    {
      id: 'expansion', name: '擴張', en: 'Expansion', color: '#22c55e',
      summary: '經濟擴張、企業獲利成長、風險性資產具備溢酬;利率低位、波動受抑制。',
      mu:    { '美股': 10.0, '全球':  8.75, '台股': 12.0, '債券':  3.5,  '原物料':  5.0, '現金': 2.0 },
      sigma: { '美股': 14.0, '全球': 16.0,  '台股': 22.0, '債券':  6.0,  '原物料': 18.0, '現金': 0.5 },
    },
    {
      id: 'contraction', name: '緊縮', en: 'Contraction', color: '#f59e0b',
      summary: '經濟成長放緩、股票分散度上升、公債受益於避險需求、信用利差擴大。',
      mu:    { '美股':  0.0, '全球': -1.5,  '台股': -3.0, '債券':  4.75, '原物料': -2.0, '現金': 2.0 },
      sigma: { '美股': 20.0, '全球': 22.0,  '台股': 28.0, '債券':  7.5,  '原物料': 22.0, '現金': 0.5 },
    },
    {
      id: 'stress', name: '壓力', en: 'Stress', color: '#ef4444',
      summary: '系統性壓力、跨資產相關性向 1 收斂、唯有公債與現金提供避險。',
      mu:    { '美股': -18.0,'全球': -23.5, '台股': -30.0,'債券':  1.5,  '原物料':  0.0, '現金': 2.0 },
      sigma: { '美股': 32.0, '全球': 37.0,  '台股': 45.0, '債券': 12.5,  '原物料': 35.0, '現金': 0.5 },
    },
  ];
  // Transition matrix P (rows sum to 1). Paper: diag(0.95, 0.82, 0.60).
  // Off-diagonals synthesised from relative ergodicity (expansion hardest to exit,
  // stress likeliest to revert to expansion).
  const NR_TRANSITION = [
    [0.95, 0.04, 0.01],
    [0.13, 0.82, 0.05],
    [0.25, 0.15, 0.60],
  ];
  // Stationary distribution π of NR_TRANSITION (computed via power iteration).
  const NR_STATIONARY = (() => {
    let v = [1/3, 1/3, 1/3];
    for (let i = 0; i < 200; i++) {
      const n = [0,0,0];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) n[j] += v[k] * NR_TRANSITION[k][j];
      v = n;
    }
    return v;
  })();
  // γ per risk profile: moderate = 5 (paper's baseline CRRA).
  const NR_GAMMA = { conservative: 8, moderate: 5, aggressive: 3 };
  // SNR β for narrative likelihood. Paper's adoption threshold.
  const NR_BETA = 2.0;  // paper recommends β≥2 for "strictly dominates"
  // Weight-inertia λ (paper baseline 0.7).
  const NR_INERTIA = 0.7;
  // Per-asset cap w̄.
  const NR_CAP = 0.60;

  // Solve long-only mean-variance with diagonal Σ, subject to 1'w=1, 0<=w<=cap.
  // max μ'w - (γ/2) Σ σ_i² w_i² ⇒ w_i = clip((μ_i - λ) / (γ σ_i²), 0, cap).
  // Binary search on λ to satisfy budget.
  function _mvDiagSolve(mu, sigma2, gamma, cap) {
    const n = mu.length;
    const f = (lam) => {
      let s = 0;
      for (let i = 0; i < n; i++) {
        const raw = (mu[i] - lam) / (gamma * sigma2[i]);
        s += Math.max(0, Math.min(cap, raw));
      }
      return s;
    };
    let lo = -1, hi = 1;
    for (let i = 0; i < 60 && f(lo) < 1; i++) lo -= 1;
    for (let i = 0; i < 60 && f(hi) > 1; i++) hi += 1;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 1) lo = mid; else hi = mid;
    }
    const lam = (lo + hi) / 2;
    const w = new Array(n);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const raw = (mu[i] - lam) / (gamma * sigma2[i]);
      w[i] = Math.max(0, Math.min(cap, raw));
      s += w[i];
    }
    // final renorm for numerical safety
    if (s > 0) for (let i = 0; i < n; i++) w[i] /= s;
    return w;
  }

  // Compute per-regime MV-optimal weights for each regime at given γ.
  // Returns { [regimeId]: { asset: weight } } normalised to 100%.
  function regimePolicies(gamma) {
    const out = {};
    NR_REGIMES.forEach(r => {
      const mu = NR_ASSET_ORDER.map(a => r.mu[a] / 100);          // decimal
      const s2 = NR_ASSET_ORDER.map(a => (r.sigma[a] / 100) ** 2); // decimal^2
      const w = _mvDiagSolve(mu, s2, gamma, NR_CAP);
      const perAsset = {};
      NR_ASSET_ORDER.forEach((a, i) => { perAsset[a] = w[i]; });
      out[r.id] = perAsset;
    });
    return out;
  }

  // Bayesian regime filter (single-step). Paper Algorithm 1 simplified for UI:
  // - return likelihood from US-equity trailing monthly return
  // - narrative likelihood from VIX level & SPY 3M trend → soft one-hot s
  // - prior = π (stationary), posterior ∝ prior × ℓ_r × ℓ_s
  function _gaussLogLik(r, muAnn, sigAnn) {
    const mu = muAnn / 12;
    const s  = sigAnn / Math.sqrt(12);
    const z  = (r - mu) / s;
    return -0.5 * z * z - Math.log(s);
  }

  function _softmax(arr) {
    const m = Math.max.apply(null, arr);
    const e = arr.map(x => Math.exp(x - m));
    const s = e.reduce((a,b) => a+b, 0);
    return e.map(x => x / s);
  }

  function _buildNarrativeSignal(vix, trend3M) {
    // Paper: s ~ N(e_k, σ² I), σ² = 1/β. We output a soft one-hot ∈ [0,1]³.
    // VIX low & trend positive → expansion; VIX mid or trend negative → contraction;
    // VIX > 30 → stress. Blend the two axes with a simple weighted vote.
    const s = [0, 0, 0];
    // VIX axis
    if (vix == null) {
      s[0] += 0.4; s[1] += 0.3; s[2] += 0.3;
    } else if (vix < 18) {
      s[0] += 0.8;
    } else if (vix < 25) {
      s[0] += 0.3; s[1] += 0.7;
    } else if (vix < 35) {
      s[1] += 0.5; s[2] += 0.5;
    } else {
      s[2] += 1.0;
    }
    // Trend axis
    if (trend3M == null) {
      s[0] += 0.4; s[1] += 0.3; s[2] += 0.3;
    } else if (trend3M > 0.04) {
      s[0] += 0.9;
    } else if (trend3M > -0.02) {
      s[0] += 0.3; s[1] += 0.5;
    } else if (trend3M > -0.10) {
      s[1] += 0.9;
    } else {
      s[2] += 1.0;
    }
    const sum = s[0] + s[1] + s[2];
    return sum > 0 ? s.map(x => x / sum) : [1/3, 1/3, 1/3];
  }

  // Main regime detector. Inputs (all optional; falls back to stationary):
  //   spyReturn1M: trailing 1-month return of broad US equity (decimal, e.g. +0.02)
  //   spyReturn3M: trailing 3-month return
  //   vix:         latest VIX level
  //   override:    'expansion'|'contraction'|'stress' → skip filter
  //   prevPosterior: optional 3-vector for Markov predict step
  function detectRegime({ spyReturn1M, spyReturn3M, vix, override, prevPosterior } = {}) {
    const drivers = [];

    if (override && NR_REGIMES.find(r => r.id === override)) {
      const idx = NR_REGIMES.findIndex(r => r.id === override);
      const p = [0,0,0]; p[idx] = 1;
      return {
        posterior: p,
        dominantId: override,
        dominant: NR_REGIMES[idx],
        confidence: 1.0,
        drivers: [{ factor: '使用者覆寫', value: NR_REGIMES[idx].name, contribution: 1.0, source: '手動' }],
        signalVec: [0,0,0],
        narrativeSNR: NR_BETA,
        overridden: true,
      };
    }

    // 1) Prior from Markov predict
    let prior = prevPosterior && prevPosterior.length === 3
      ? [0,0,0].map((_, j) => prevPosterior.reduce((s, pk, k) => s + pk * NR_TRANSITION[k][j], 0))
      : NR_STATIONARY.slice();

    // 2) Return log-likelihood (US equity trailing 1M return)
    const ℓr = [0,0,0];
    if (spyReturn1M != null) {
      NR_REGIMES.forEach((r, k) => {
        ℓr[k] = _gaussLogLik(spyReturn1M, r.mu['美股'] / 100, r.sigma['美股'] / 100);
      });
      drivers.push({
        factor: '美股 1M 報酬',
        value: (spyReturn1M * 100).toFixed(2) + '%',
        contribution: 0,
        source: '^GSPC',
      });
    }

    // 3) Narrative log-likelihood: ℓ_s = -β/2 ||s - e_k||²
    const signalVec = _buildNarrativeSignal(vix, spyReturn3M);
    const ℓs = [0,0,0];
    for (let k = 0; k < 3; k++) {
      let sq = 0;
      for (let j = 0; j < 3; j++) {
        const d = signalVec[j] - (j === k ? 1 : 0);
        sq += d * d;
      }
      ℓs[k] = -0.5 * NR_BETA * sq;
    }
    if (vix != null) {
      drivers.push({
        factor: 'VIX',
        value: vix.toFixed(1),
        contribution: 0,
        source: '^VIX',
      });
    }
    if (spyReturn3M != null) {
      drivers.push({
        factor: '美股 3M 趨勢',
        value: (spyReturn3M * 100).toFixed(2) + '%',
        contribution: 0,
        source: '^GSPC',
      });
    }

    // 4) Bayes update
    const logPost = prior.map((p, k) => Math.log(Math.max(1e-12, p)) + ℓr[k] + ℓs[k]);
    const posterior = _softmax(logPost);

    // Identify dominant regime
    let di = 0;
    for (let k = 1; k < 3; k++) if (posterior[k] > posterior[di]) di = k;

    // Fill driver contributions (share of posterior logit mass relative to dominant)
    const totalLL = ℓr.reduce((s,x) => s + Math.abs(x), 0) + ℓs.reduce((s,x) => s + Math.abs(x), 0);
    drivers.forEach(d => {
      if (d.factor === '美股 1M 報酬')  d.contribution = totalLL > 0 ? Math.abs(ℓr[di]) / totalLL : 0;
      else if (d.factor === 'VIX')      d.contribution = totalLL > 0 ? Math.abs(ℓs[di]) * 0.6 / totalLL : 0;
      else if (d.factor === '美股 3M 趨勢') d.contribution = totalLL > 0 ? Math.abs(ℓs[di]) * 0.4 / totalLL : 0;
    });
    // Prior contribution
    drivers.push({
      factor: '先驗 (Markov)',
      value: (prior[di] * 100).toFixed(0) + '%',
      contribution: totalLL > 0 ? 1 - drivers.reduce((s,d) => s + d.contribution, 0) : 1,
      source: '論文 Appendix C',
    });

    return {
      posterior,
      dominantId: NR_REGIMES[di].id,
      dominant: NR_REGIMES[di],
      confidence: posterior[di],
      drivers,
      signalVec,
      narrativeSNR: NR_BETA,
      overridden: false,
    };
  }

  // Posterior-weighted target allocation, preserving base palette + sector labels.
  // regimeResult: output of detectRegime(); risk: 'conservative'|'moderate'|'aggressive'.
  // Returns array shaped like baseAllocation with .target replaced by regime-informed %.
  function targetsForPosterior(baseAllocation, regimeResult, risk) {
    const gamma = NR_GAMMA[risk] || NR_GAMMA.moderate;
    const policies = regimePolicies(gamma);
    const byAsset = {};
    NR_ASSET_ORDER.forEach(a => { byAsset[a] = 0; });
    NR_REGIMES.forEach((r, k) => {
      const p = regimeResult?.posterior?.[k] || NR_STATIONARY[k];
      NR_ASSET_ORDER.forEach(a => { byAsset[a] += p * policies[r.id][a]; });
    });
    // Normalise (should already sum to 1 but guard against float)
    const s = Object.values(byAsset).reduce((a,b) => a+b, 0) || 1;
    NR_ASSET_ORDER.forEach(a => { byAsset[a] /= s; });
    // Project onto baseAllocation shape; for asset names in base but not in NR, keep base target.
    return baseAllocation.map(base => {
      const w = byAsset[base.name];
      if (w == null) return { ...base };
      return { ...base, target: Math.round(w * 1000) / 10 };
    });
  }

  // Convenience: single-regime targets (used for "regime baseline" view).
  function targetsForRegime(baseAllocation, regimeId, risk) {
    const fake = { posterior: [0,0,0] };
    const idx = NR_REGIMES.findIndex(r => r.id === regimeId);
    if (idx < 0) return baseAllocation.map(b => ({...b}));
    fake.posterior[idx] = 1;
    return targetsForPosterior(baseAllocation, fake, risk);
  }

  function regimeExplain(id) {
    const r = NR_REGIMES.find(x => x.id === id);
    return r ? r.summary : '';
  }

  const NarrativeRegimes = {
    REGIMES: NR_REGIMES,
    ASSET_ORDER: NR_ASSET_ORDER,
    TRANSITION: NR_TRANSITION,
    STATIONARY: NR_STATIONARY,
    GAMMA: NR_GAMMA,
    BETA: NR_BETA,
    INERTIA: NR_INERTIA,
    CAP: NR_CAP,
    detectRegime,
    regimePolicies,
    targetsForPosterior,
    targetsForRegime,
    explain: regimeExplain,
  };

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
    NarrativeRegimes,
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
