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
              className={'nav-item ' + (current === item.id ? 'active' : '')}
              onClick={() => onNav(item.id)}
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

function Topbar({ breadcrumb }) {
  const tickers = [
    { sym: 'TWSE',   val: '22,483', d: +0.42, cls: 'pos' },
    { sym: 'S&P500', val: '5,842',  d: +0.18, cls: 'pos' },
    { sym: 'NDX',    val: '20,218', d: -0.31, cls: 'neg' },
    { sym: 'USD/TWD',val: '32.18',  d: -0.02, cls: 'neg' },
    { sym: 'GOLD',   val: '2,384',  d: +0.82, cls: 'pos' },
  ];
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
          {tickers.map(t => (
            <div key={t.sym} className={'ticker-item ' + t.cls}>
              <span className="sym mono">{t.sym}</span>
              <span className="val mono">{t.val}</span>
              <span className="val mono" style={{fontSize: 10, opacity: 0.7}}>{t.d>=0?'+':''}{t.d.toFixed(2)}%</span>
            </div>
          ))}
        </div>
        <button className="icon-btn" title="搜尋"><Icon name="search" size={14} /></button>
        <button className="icon-btn" title="通知" style={{position:'relative'}}>
          <Icon name="bell" size={14} />
          <span style={{position:'absolute', top:6, right:7, width:6, height:6, borderRadius:'50%', background:'var(--accent)'}}/>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, NAV });
