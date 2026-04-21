// Main App
const { useState, useEffect } = React;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:40, fontFamily:'var(--font-sans)', color:'var(--text-1)'}}>
          <h2 style={{color:'var(--neg)', marginTop:0}}>畫面發生錯誤</h2>
          <p style={{fontSize:13, color:'var(--text-2)'}}>頁面渲染時遇到問題,你的資料仍安全保存在瀏覽器。可嘗試重新整理,若問題持續請回報。</p>
          <pre style={{background:'var(--bg-2)', padding:12, borderRadius:8, fontSize:11, overflow:'auto', maxHeight:200}}>{String(this.state.error?.stack || this.state.error)}</pre>
          <button className="btn primary" onClick={() => this.setState({ error: null })}>再試一次</button>
          <button className="btn" style={{marginLeft:8}} onClick={() => location.reload()}>重新整理</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "risk": "moderate",
  "theme": "dark",
  "density": "default",
  "showDisclaimer": true
}/*EDITMODE-END*/;

const BREADCRUMBS = {
  dashboard: ['配置顧問', '儀表板'],
  holdings:  ['配置顧問', '持股管理'],
  advisor:   ['配置顧問', 'AI 決策', '配置建議'],
  signals:   ['配置顧問', 'AI 決策', '調整時機'],
  chat:      ['配置顧問', 'AI 決策', '對話 AI'],
  sources:   ['配置顧問', '資料', '資料基底'],
  backtest:  ['配置顧問', '資料', '歷史回測'],
  theory:    ['配置顧問', '資料', '理論基礎'],
  settings:  ['配置顧問', '個人設定'],
};

const THEME_KEY = 'ai-advisor-theme-v1';
function resolveInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  return mql && mql.matches ? 'light' : TWEAK_DEFAULS.theme;
}

function App() {
  // persistent route
  const [current, setCurrent] = useState(() => localStorage.getItem('page') || 'dashboard');
  const [risk, setRisk]       = useState(TWEAK_DEFAULS.risk);
  const [theme, setThemeState] = useState(resolveInitialTheme);
  const setTheme = (v) => {
    const next = typeof v === 'function' ? v(theme) : v;
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };
  const [density, setDensity] = useState(TWEAK_DEFAULS.density);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => { localStorage.setItem('page', current); }, [current]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.setAttribute('data-density', density); }, [density]);

  // Follow OS theme changes only if user hasn't explicitly chosen.
  useEffect(() => {
    const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
    if (!mql) return;
    const onChange = (e) => {
      if (!localStorage.getItem(THEME_KEY)) setThemeState(e.matches ? 'light' : 'dark');
    };
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange);
  }, []);

  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const SHORTCUTS = {
      '1': 'dashboard', '2': 'holdings', '3': 'advisor',
      '4': 'signals',   '5': 'chat',     '6': 'sources',
      '7': 'backtest',  '8': 'settings',
    };
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') { setHelpOpen(v => !v); return; }
      if (e.key === 'Escape') { setHelpOpen(false); return; }
      const next = SHORTCUTS[e.key];
      if (next) { setCurrent(next); }
      if (e.key === 't') { setTheme(t => t === 'dark' ? 'light' : 'dark'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tweak mode plumbing
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const persist = (edits) => {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  };

  const renderPage = () => {
    switch (current) {
      case 'dashboard': return <Dashboard risk={risk}/>;
      case 'holdings':  return <Holdings/>;
      case 'advisor':   return <Advisor risk={risk}/>;
      case 'signals':   return <Signals/>;
      case 'chat':      return <Chat/>;
      case 'sources':   return <Sources/>;
      case 'backtest':  return <Backtest/>;
      case 'theory':    return <Theory/>;
      case 'settings':  return <Settings risk={risk} setRisk={(v)=>{setRisk(v); persist({risk:v});}}
                                        theme={theme} setTheme={(v)=>{setTheme(v); persist({theme:v});}}
                                        density={density} setDensity={(v)=>{setDensity(v); persist({density:v});}}/>;
      default: return <Dashboard risk={risk}/>;
    }
  };

  return (
    <div className="app" data-screen-label={`頁面:${BREADCRUMBS[current]?.[BREADCRUMBS[current].length-1] || current}`}>
      <Sidebar current={current} onNav={setCurrent}/>
      <div className="main">
        <Topbar breadcrumb={BREADCRUMBS[current] || ['配置顧問']}/>
        <div className="content">
          <ErrorBoundary key={current}>{renderPage()}</ErrorBoundary>
        </div>
      </div>

      {helpOpen && (
        <div onClick={() => setHelpOpen(false)}
             style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', zIndex:1000}}>
          <div onClick={(e) => e.stopPropagation()}
               className="card" style={{minWidth:360, maxWidth:480, padding:24}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <h3 style={{margin:0, fontSize:16}}>鍵盤快速鍵</h3>
              <button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="關閉"><Icon name="close" size={12}/></button>
            </div>
            <dl className="kv" style={{gridTemplateColumns:'1fr auto'}}>
              <dt>1 / 2</dt><dd>儀表板 / 持股管理</dd>
              <dt>3 / 4</dt><dd>配置建議 / 調整時機</dd>
              <dt>5 / 6</dt><dd>對話 AI / 資料基底</dd>
              <dt>7 / 8</dt><dd>歷史回測 / 個人設定</dd>
              <dt>t</dt><dd>切換深色 / 淺色</dd>
              <dt>?</dt><dd>開啟 / 關閉此說明</dd>
              <dt>Esc</dt><dd>關閉此說明</dd>
            </dl>
            <p style={{fontSize:11, color:'var(--text-3)', marginTop:16, marginBottom:0}}>
              在輸入框中時不會觸發捷徑。
            </p>
          </div>
        </div>
      )}

      <ToastHost/>

      {tweaksOpen && (
        <div className="tweaks-panel">
          <h3>Tweaks <button className="icon-btn" style={{width:22, height:22}} onClick={()=>setTweaksOpen(false)}><Icon name="close" size={11}/></button></h3>

          <div className="tweak-row">
            <label>風險等級</label>
            <div className="seg" style={{width:'100%'}}>
              {[['conservative','保守'],['moderate','穩健'],['aggressive','積極']].map(([v,l]) => (
                <button key={v} className={risk===v?'active':''} onClick={()=>{setRisk(v); persist({risk:v});}} style={{flex:1}}>{l}</button>
              ))}
            </div>
          </div>

          <div className="tweak-row">
            <label>主題</label>
            <div className="seg" style={{width:'100%'}}>
              <button className={theme==='dark'?'active':''} onClick={()=>{setTheme('dark'); persist({theme:'dark'});}} style={{flex:1}}>深色</button>
              <button className={theme==='light'?'active':''} onClick={()=>{setTheme('light'); persist({theme:'light'});}} style={{flex:1}}>淺色</button>
            </div>
          </div>

          <div className="tweak-row">
            <label>資料密度</label>
            <div className="seg" style={{width:'100%'}}>
              {[['compact','緊湊'],['default','標準'],['comfortable','寬鬆']].map(([v,l]) => (
                <button key={v} className={density===v?'active':''} onClick={()=>{setDensity(v); persist({density:v});}} style={{flex:1}}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{fontSize:10, color:'var(--text-3)', marginTop:12, padding:'8px 10px', background:'var(--bg-2)', borderRadius:6, lineHeight:1.6}}>
            Tweaks 會即時反映在整個介面。目前頁面:<b style={{color:'var(--text-1)'}}>{BREADCRUMBS[current]?.[BREADCRUMBS[current].length-1]}</b>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
