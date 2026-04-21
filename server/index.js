// ai-investment-advisor proxy
// Zero-dep Node 20+ HTTP server. Deployed to Cloud Run.
// Routes:
//   GET /yahoo/chart?symbol=<t>&interval=1d&range=5d
//   GET /yahoo/search?q=<q>&newsCount=6&quotesCount=0
//   GET /twse/mis?codes=2330,0050        (returns { [code]: quote })
//   GET /twse/day-all                    (5-min cached)
//   GET /healthz
//
// Response envelope (success): { ok: true, data: <json>, cachedAt: <iso>, ttl: <ms> }
// All responses include CORS headers: Access-Control-Allow-Origin: *

import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8080);

const CORS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const UA = 'Mozilla/5.0 (compatible; ai-advisor-proxy/1.0)';

// ── tiny TTL cache ──────────────────────────────────────────────
const cache = new Map();
const MAX_CACHE_KEYS = 2000;
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  return hit;
}
function cacheSet(key, data, ttlMs) {
  if (cache.size >= MAX_CACHE_KEYS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, expires: Date.now() + ttlMs, cachedAt: Date.now(), ttl: ttlMs });
}

async function upstreamJson(url, { timeoutMs = 7000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*' },
      signal: ctl.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`upstream ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ── cached fetcher with single-flight per key ──────────────────
const inflight = new Map();
async function cachedJson(key, url, ttlMs) {
  const hit = cacheGet(key);
  if (hit) return { data: hit.data, cachedAt: hit.cachedAt, ttl: hit.ttl, hit: true };
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const data = await upstreamJson(url);
      cacheSet(key, data, ttlMs);
      return { data, cachedAt: Date.now(), ttl: ttlMs, hit: false };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// ── request helpers ────────────────────────────────────────────
function send(res, status, body, extraHeaders = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...CORS,
    ...extraHeaders,
  });
  res.end(payload);
}

function ok(res, data, meta = {}) {
  send(res, 200, { ok: true, data, ...meta });
}
function fail(res, status, message) {
  send(res, status, { ok: false, error: message });
}

// ── input validators ───────────────────────────────────────────
const SYMBOL_RE = /^[A-Za-z0-9.\-^=]{1,15}$/;
const CODE_RE   = /^\d{4,6}[A-Za-z]?$/;
const RANGE_RE  = /^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$/;
const INTERVAL_RE = /^(1m|5m|15m|30m|60m|1h|1d|5d|1wk|1mo|3mo)$/;

// ── handlers ───────────────────────────────────────────────────
async function handleYahooChart(url, res) {
  const symbol = url.searchParams.get('symbol') || '';
  const interval = url.searchParams.get('interval') || '1d';
  const range = url.searchParams.get('range') || '5d';
  if (!SYMBOL_RE.test(symbol)) return fail(res, 400, 'invalid symbol');
  if (!INTERVAL_RE.test(interval)) return fail(res, 400, 'invalid interval');
  if (!RANGE_RE.test(range)) return fail(res, 400, 'invalid range');

  const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  // Short TTL for 1d/5d quotes, longer for history.
  const ttl = (range === '1d' || range === '5d') ? 30_000 : 10 * 60_000;
  const key = `yc:${symbol}:${interval}:${range}`;
  try {
    const { data, cachedAt, ttl: t, hit } = await cachedJson(key, upstream, ttl);
    ok(res, data, { cachedAt: new Date(cachedAt).toISOString(), ttl: t, hit });
  } catch (e) {
    fail(res, 502, e.message || String(e));
  }
}

async function handleYahooSearch(url, res) {
  const q = (url.searchParams.get('q') || '').slice(0, 80);
  if (!q) return fail(res, 400, 'missing q');
  const newsCount = Math.min(20, Number(url.searchParams.get('newsCount') || 6));
  const quotesCount = Math.min(10, Number(url.searchParams.get('quotesCount') || 0));
  const upstream = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=${newsCount}&quotesCount=${quotesCount}`;
  const key = `ys:${q}:${newsCount}:${quotesCount}`;
  try {
    const { data, cachedAt, ttl, hit } = await cachedJson(key, upstream, 2 * 60_000);
    ok(res, data, { cachedAt: new Date(cachedAt).toISOString(), ttl, hit });
  } catch (e) {
    fail(res, 502, e.message || String(e));
  }
}

async function handleTwseMis(url, res) {
  const codesRaw = (url.searchParams.get('codes') || '').split(',').map(s => s.trim()).filter(Boolean);
  const codes = codesRaw.filter(c => CODE_RE.test(c)).slice(0, 100);
  if (!codes.length) return fail(res, 400, 'no valid codes');

  const ex_ch = codes.flatMap(c => [`tse_${c}.tw`, `otc_${c}.tw`]).join('|');
  const upstream = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(ex_ch)}&json=1&_=${Date.now()}`;
  const key = `mis:${codes.sort().join(',')}`;
  try {
    const { data, cachedAt, ttl, hit } = await cachedJson(key, upstream, 10_000); // 10-sec cache
    const arr = Array.isArray(data?.msgArray) ? data.msgArray : [];
    const out = {};
    for (const r of arr) {
      const code = r.c;
      if (!code || out[code]) continue;
      const prev = parseFloat(r.y);
      const zRaw = parseFloat(r.z);
      const price = (zRaw && !isNaN(zRaw)) ? zRaw : prev;
      if (!price || isNaN(price)) continue;
      const change = (zRaw && !isNaN(zRaw) && prev) ? price - prev : 0;
      out[code] = {
        ticker: code + '.TW',
        price,
        previousClose: prev || price,
        change,
        changePct: prev ? (change / prev) * 100 : 0,
        currency: 'TWD',
        marketState: (zRaw && !isNaN(zRaw)) ? 'MIS' : 'MIS-PRE',
        time: r.t && r.d ? `${r.d.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')}T${r.t}+08:00` : null,
        exchange: r.ex || null,
      };
    }
    ok(res, out, { cachedAt: new Date(cachedAt).toISOString(), ttl, hit, count: Object.keys(out).length });
  } catch (e) {
    fail(res, 502, e.message || String(e));
  }
}

async function handleTwseDayAll(_url, res) {
  const upstream = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
  const key = 'twse:day-all';
  try {
    const { data, cachedAt, ttl, hit } = await cachedJson(key, upstream, 5 * 60_000);
    // Re-shape to { [code]: row } for O(1) lookup, keep payload lean.
    const map = {};
    if (Array.isArray(data)) {
      for (const r of data) if (r && r.Code) map[r.Code] = r;
    }
    ok(res, map, { cachedAt: new Date(cachedAt).toISOString(), ttl, hit, count: Object.keys(map).length });
  } catch (e) {
    fail(res, 502, e.message || String(e));
  }
}

// ── main ───────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== 'GET')     { return fail(res, 405, 'method not allowed'); }

  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return fail(res, 400, 'bad url'); }

  try {
    switch (url.pathname) {
      case '/healthz':       return send(res, 200, 'ok');
      case '/':              return ok(res, { service: 'ai-advisor-proxy', routes: ['/yahoo/chart','/yahoo/search','/twse/mis','/twse/day-all','/healthz'] });
      case '/yahoo/chart':   return await handleYahooChart(url, res);
      case '/yahoo/search':  return await handleYahooSearch(url, res);
      case '/twse/mis':      return await handleTwseMis(url, res);
      case '/twse/day-all':  return await handleTwseDayAll(url, res);
      default:               return fail(res, 404, 'not found');
    }
  } catch (e) {
    fail(res, 500, e.message || String(e));
  }
});

server.listen(PORT, () => {
  console.log(`[proxy] listening on :${PORT}`);
});
