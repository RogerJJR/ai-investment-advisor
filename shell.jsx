// Sidebar nav + topbar
const { useState, useEffect, useRef, useMemo } = React;

const NAV = [
  { group: '主要', items: [
    { id: 'dashboard', label: '儀表板',       icon: 'dashboard' },
    { id: 'holdings',  label: '持股管理',     icon: 'portfolio' },
  ]},
  { group: 'AI 決策', items: [
    { id: 'advisor',   label: '配置建議',     icon: 'sparkles',  badge: 'NEW' },
    { id: 'signals',   label: '調整時機',     icon: 'bell',      badge: '4' },
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

function Sidebar({ current, onNav }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">AI</div>
        <div className="logo-text">
          <span>Long-term Advisor</span>
          <b>配置顧問</b>
        </div>
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

Object.assign(window, { Sidebar, Topbar, NAV });
