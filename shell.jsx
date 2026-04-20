// Sidebar nav + topbar
const { useState, useEffect, useRef, useMemo } = React;

const APP_VERSION = 'v1.1.0';
const APP_BUILD_DATE = '2026-04-20';
window.APP_VERSION = APP_VERSION;
window.APP_BUILD_DATE = APP_BUILD_DATE;

function Sidebar({ current, onNav }) {
  const [userHoldings] = useHoldings();
  const tickers = useMemo(() => [...new Set([...RT.holdingsToTickers(userHoldings), 'TWD=X'])], [userHoldings]);
  const { quotes } = useLiveQuotes(tickers, { intervalMs: 60000 });
  const holdings = RT.applyQuotesToHoldings(userHoldings, quotes);
  const usdTwd = quotes['TWD=X']?.price;
  const alloc = RT.computeLiveAllocation(holdings, DATA.allocation, usdTwd);
  const totalMV = RT.totalValueTWD(holdings, usdTwd);
  const liveSignals = RT.generateAllocationSignals(alloc, totalMV);

  let sigState = {};
  try { sigState = JSON.parse(localStorage.getItem('ai-advisor-signal-state-v1') || '{}'); } catch {}
  const pendingCount = liveSignals.filter(s => {
    const st = sigState[s.id]?.status;
    return !st || st === 'pending';
  }).length + DATA.signals.filter(s => (s.type !== 'rebalance' && s.type !== 'concentration') && !sigState[s.id]).length;

  const NAV = [
    { group: '主要', items: [
      { id: 'dashboard', label: '儀表板',       icon: 'dashboard' },
      { id: 'holdings',  label: '持股管理',     icon: 'portfolio' },
    ]},
    { group: 'AI 決策', items: [
      { id: 'advisor',   label: '配置建議',     icon: 'sparkles' },
      { id: 'signals',   label: '調整時機',     icon: 'bell',      badge: pendingCount > 0 ? String(pendingCount) : null },
      { id: 'chat',      label: '對話 AI',       icon: 'chat' },
    ]},
    { group: '資料', items: [
      { id: 'sources',   label: '資料基底',     icon: 'database' },
      { id: 'backtest',  label: '歷史回測',     icon: 'history' },
    ]},
    { group: '帳戶', items: [
      { id: 'settings',  label: '個人設定',     icon: 'settings' },
    ]},
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">AI</div>
        <div className="logo-text">
          <span>Long-term Advisor</span>
          <b>配置顧問</b>
        </div>
        <span
          className="mono"
          title={`版本 ${APP_VERSION} · 釋出 ${APP_BUILD_DATE}`}
          style={{
            fontSize:9, color:'var(--text-3)', padding:'2px 6px',
            borderRadius:4, border:'1px solid var(--line)', marginLeft:'auto',
            letterSpacing:'0.02em',
          }}
        >{APP_VERSION}</span>
      </div>

      {NAV.map(group => (
        <div className="nav-group" key={group.group}>
          <div className="nav-group-title">{group.group}</div>
          {group.items.map(item => (
            <div
              key={item.id}
              role="link"
              tabIndex={0}
              aria-current={current === item.id ? 'page' : undefined}
              aria-label={item.label}
              className={'nav-item ' + (current === item.id ? 'active' : '')}
              onClick={() => onNav(item.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNav(item.id); } }}
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
              {item.badge && <span className="badge">{item.badge}</span>}
            </div>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="avatar">{DATA.user.initials}</div>
        <div className="user-info">
          <b>{DATA.user.name}</b>
          <span>穩健型 · 15 年</span>
        </div>
      </div>
      <div style={{fontSize:9, color:'var(--text-4)', textAlign:'center', padding:'6px 12px', borderTop:'1px dashed var(--line)', letterSpacing:'0.02em'}}>
        <span className="mono">{APP_VERSION}</span> · Build {APP_BUILD_DATE}
      </div>
    </aside>
  );
}

const TOPBAR_INDICES = [
  { sym: 'TWSE',    ticker: '^TWII',  digits: 0 },
  { sym: 'S&P500',  ticker: '^GSPC',  digits: 0 },
  { sym: 'NDX',     ticker: '^NDX',   digits: 0 },
  { sym: 'USD/TWD', ticker: 'TWD=X',  digits: 2 },
  { sym: 'GOLD',    ticker: 'GC=F',   digits: 0 },
];

const TOPBAR_FALLBACK = {
  '^TWII':  { price: 22483, changePct: +0.42 },
  '^GSPC':  { price: 5842,  changePct: +0.18 },
  '^NDX':   { price: 20218, changePct: -0.31 },
  'TWD=X':  { price: 32.18, changePct: -0.02 },
  'GC=F':   { price: 2384,  changePct: +0.82 },
};

function Topbar({ breadcrumb }) {
  const tickers = TOPBAR_INDICES.map(t => t.ticker);
  const { quotes, status, updatedAt } = useLiveQuotes(tickers, { intervalMs: 60000 });

  const renderTicker = (t) => {
    const q = quotes[t.ticker] || TOPBAR_FALLBACK[t.ticker] || {};
    const price = q.price;
    const chg = q.changePct ?? 0;
    const cls = chg >= 0 ? 'pos' : 'neg';
    const val = price != null ? price.toLocaleString(undefined, {
      minimumFractionDigits: t.digits, maximumFractionDigits: t.digits,
    }) : '—';
    return (
      <div key={t.sym} className={'ticker-item ' + cls}>
        <span className="sym mono">{t.sym}</span>
        <span className="val mono">{val}</span>
        <span className="val mono" style={{fontSize: 10, opacity: 0.7}}>{chg>=0?'+':''}{chg.toFixed(2)}%</span>
      </div>
    );
  };

  const statusLabel = {
    idle: '待連線', loading: '連線中', live: '即時', error: '離線(使用快照)',
  }[status] || status;
  const statusColor = status === 'live' ? 'var(--pos)' : status === 'error' ? 'var(--neg)' : 'var(--text-3)';
  const pulse = status === 'live' ? 'pulse' : '';

  return (
    <div className="topbar">
      <div className="breadcrumb">
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {i === breadcrumb.length - 1 ? <b>{b}</b> : <span>{b}</span>}
          </React.Fragment>
        ))}
      </div>

      <div className="topbar-right">
        <div className="ticker-strip">
          {TOPBAR_INDICES.map(renderTicker)}
        </div>
        <span
          title={updatedAt ? `更新於 ${updatedAt.toLocaleTimeString()}` : ''}
          style={{display:'flex', alignItems:'center', gap:6, fontSize:10, color:statusColor, padding:'4px 8px', border:'1px solid var(--line)', borderRadius:4}}
        >
          <span className={'dot ' + pulse} style={{background:statusColor, width:6, height:6, borderRadius:'50%'}}/>
          {statusLabel}
        </span>
        <button className="icon-btn" title="搜尋" aria-label="搜尋"><Icon name="search" size={14} /></button>
        <button className="icon-btn" title="通知" aria-label="通知" style={{position:'relative'}}>
          <Icon name="bell" size={14} />
          <span style={{position:'absolute', top:6, right:7, width:6, height:6, borderRadius:'50%', background:'var(--accent)'}}/>
        </button>
        <button className="icon-btn" title="鍵盤捷徑 (按 ?)" aria-label="鍵盤捷徑"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}>
          <span className="mono" style={{fontSize:12}}>?</span>
        </button>
      </div>
    </div>
  );
}

// Toast system
const TOAST_STORE = (() => {
  let seq = 1;
  const listeners = new Set();
  const state = { items: [] };
  const notify = () => listeners.forEach(l => l(state.items));
  const push = (t) => {
    const id = seq++;
    const item = { id, kind: t.kind || 'info', title: t.title || '', message: t.message || '', ttl: t.ttl ?? 3500 };
    state.items = [...state.items, item];
    notify();
    if (item.ttl > 0) setTimeout(() => dismiss(id), item.ttl);
    return id;
  };
  const dismiss = (id) => {
    state.items = state.items.filter(i => i.id !== id);
    notify();
  };
  return {
    subscribe(fn) { listeners.add(fn); fn(state.items); return () => listeners.delete(fn); },
    push, dismiss,
  };
})();

function toast(msgOrOpts, kind = 'info') {
  if (typeof msgOrOpts === 'string') return TOAST_STORE.push({ message: msgOrOpts, kind });
  return TOAST_STORE.push(msgOrOpts);
}
toast.success = (m, title) => TOAST_STORE.push({ kind: 'success', message: m, title });
toast.error   = (m, title) => TOAST_STORE.push({ kind: 'error',   message: m, title });
toast.info    = (m, title) => TOAST_STORE.push({ kind: 'info',    message: m, title });

function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => TOAST_STORE.subscribe(setItems), []);
  if (!items.length) return null;
  const iconFor = (k) => k === 'success' ? 'check' : k === 'error' ? 'alert' : 'info';
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={'toast ' + t.kind}>
          <span className="toast-icon"><Icon name={iconFor(t.kind)} size={14}/></span>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div>{t.message}</div>
          </div>
          <button className="toast-close" onClick={() => TOAST_STORE.dismiss(t.id)} aria-label="關閉">
            <Icon name="close" size={10}/>
          </button>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, ToastHost, toast });
