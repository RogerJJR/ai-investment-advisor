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
  settings:  ['配置顧問', '個人設定'],
};

function App() {
  // persistent route
  const [current, setCurrent] = useState(() => localStorage.getItem('page') || 'dashboard');
  const [risk, setRisk]       = useState(TWEAK_DEFAULS.risk);
  const [theme, setTheme]     = useState(TWEAK_DEFAULS.theme);
  const [density, setDensity] = useState(TWEAK_DEFAULS.density);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => { localStorage.setItem('page', current); }, [current]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.setAttribute('data-density', density); }, [density]);

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
