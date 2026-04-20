// Backtest + Settings + Chat pages (lighter)

// AI target allocation weights for backtest
const BT_WEIGHTS = {
  'VTI':   0.30,  // 美股
  '0050.TW': 0.22, // 台股
  'VT':    0.12,  // 全球
  'BND':   0.20,  // 債券
  'GLD':   0.08,  // 原物料
  // 現金 8% → 假設 0% 報酬
};

const BT_BENCHMARK = { 'VTI': 0.60, 'BND': 0.40 }; // 60/40

function computePortfolioAnnual(history, weights) {
  // merge all tickers on common year range
  const perTicker = {};
  Object.keys(weights).forEach(t => {
    if (history[t]) perTicker[t] = RT.annualReturnsFromMonthly(history[t]);
  });
  if (!Object.keys(perTicker).length) return [];
  const commonYears = Object.values(perTicker)
    .map(arr => new Set(arr.map(r => r.year)))
    .reduce((a, s) => new Set([...a].filter(x => s.has(x))));
  const years = [...commonYears].sort();
  // normalise weights based on available tickers
  const totalW = Object.keys(weights).filter(t => history[t]).reduce((s,t) => s + weights[t], 0) || 1;
  return years.map(y => {
    let r = 0;
    Object.keys(weights).forEach(t => {
      if (!history[t]) return;
      const yr = perTicker[t].find(x => x.year === y);
      if (yr) r += (weights[t] / totalW) * yr.ret;
    });
    return { year: y, ret: r };
  });
}

function computeStats(annual) {
  if (!annual.length) return null;
  const cumulative = annual.reduce((acc, a) => {
    const last = acc[acc.length-1] ?? 100;
    return [...acc, last * (1 + a.ret/100)];
  }, []);
  const totalRet = (cumulative[cumulative.length-1] / 100 - 1) * 100;
  const years = annual.length;
  const cagr = (Math.pow(cumulative[cumulative.length-1] / 100, 1/years) - 1) * 100;
  // Max drawdown from yearly equity curve
  let peak = 100, maxDD = 0;
  [100, ...cumulative].forEach(v => { peak = Math.max(peak, v); maxDD = Math.min(maxDD, (v/peak - 1) * 100); });
  // Sharpe (annual, rf≈2%)
  const mean = annual.reduce((s,a) => s + a.ret, 0) / annual.length;
  const sd = Math.sqrt(annual.reduce((s,a) => s + Math.pow(a.ret - mean, 2), 0) / annual.length);
  const sharpe = sd ? (mean - 2) / sd : 0;
  const winRate = annual.filter(a => a.ret > 0).length / annual.length * 100;
  return { totalRet, cagr, maxDD, sharpe, winRate, cumulative };
}

function Backtest() {
  const [preset, setPreset] = React.useState('AI 建議');
  const tickers = [...new Set([...Object.keys(BT_WEIGHTS), ...Object.keys(BT_BENCHMARK)])];
  const { history, status, error } = useLiveHistory(tickers, { range: '10y', interval: '1mo' });

  const aiAnnual   = computePortfolioAnnual(history, BT_WEIGHTS);
  const benchAnnual = computePortfolioAnnual(history, BT_BENCHMARK);
  const aiStats    = computeStats(aiAnnual);
  const benchStats = computeStats(benchAnnual);

  const isLive = status === 'live' && aiStats;
  const bt = isLive
    ? {
        years: aiAnnual.map(a => a.year),
        portfolio: aiAnnual.map(a => a.ret),
        benchmark: benchAnnual.map(a => a.ret),
      }
    : DATA.backtest;

  const stats = isLive ? aiStats : null;

  const statusLabel = {
    idle:'準備中', loading:'正在抓取 10 年歷史資料…', live:'即時歷史資料',
    error:'歷史資料離線,顯示快照',
  }[status];
  const statusColor = status === 'live' ? 'var(--pos)' : status === 'error' ? 'var(--neg)' : 'var(--text-3)';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>歷史回測</h1>
          <p>把 AI 建議的配置,套用到過去 10 年的真實市場資料;看看如果一直按此方案執行,今天會是什麼樣子。</p>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:11, color:statusColor}}>
            <span className={'dot ' + (status==='live'?'pulse':'')} style={{width:6, height:6, borderRadius:'50%', background:statusColor, display:'inline-block'}}/>
            {statusLabel}{isLive && ` · ${tickers.filter(t=>history[t]).length}/${tickers.length} 檔`}
          </div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={14}/>匯出報告</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        {(stats ? [
          { label:`${bt.years.length} 年總報酬`, value: (stats.totalRet>=0?'+':'') + stats.totalRet.toFixed(1)+'%', c: stats.totalRet>=0?'var(--pos)':'var(--neg)' },
          { label:'年化報酬 (CAGR)', value: stats.cagr.toFixed(1)+'%', c:'var(--text-0)' },
          { label:'最大回撤', value: stats.maxDD.toFixed(1)+'%', c:'var(--neg)' },
          { label:'夏普比 (rf=2%)', value: stats.sharpe.toFixed(2), c:'var(--text-0)' },
          { label:'勝率 / 年', value: stats.winRate.toFixed(0)+'%', c:'var(--pos)' },
        ] : [
          { label:'10 年總報酬', value:'+142%', c:'var(--pos)' },
          { label:'年化報酬', value:'9.2%', c:'var(--text-0)' },
          { label:'最大回撤', value:'-18.4%', c:'var(--neg)' },
          { label:'夏普比', value:'0.72', c:'var(--text-0)' },
          { label:'勝率 / 年', value:'80%', c:'var(--pos)' },
        ]).map(k => (
          <div key={k.label} className="card">
            <div className="kpi-label">{k.label}</div>
            <div className="mono" style={{fontSize:22, marginTop:6, color:k.c}}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
        <div className="card-head">
          <div>
            <div className="card-title">累計淨值走勢</div>
            <div className="card-sub">起始 NT$100 · AI 建議 vs 基準 60/40</div>
          </div>
          <div className="seg">
            {['AI 建議','60/40','全球股 100%','目前配置'].map(p => (
              <button key={p} className={preset===p?'active':''} onClick={()=>setPreset(p)}>{p}</button>
            ))}
          </div>
        </div>
        <AreaChart
          series={[
            { label:'AI 建議', color:'var(--accent)', values: bt.portfolio.reduce((a,v) => [...a, (a[a.length-1]||100) * (1+v/100)], []) },
            { label:'基準 60/40', color:'var(--text-3)', values: bt.benchmark.reduce((a,v) => [...a, (a[a.length-1]||100) * (1+v/100)], []) },
          ]}
          width={1080} height={280}
          labels={bt.years.map(String)}
        />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--density-gap)'}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>年度報酬比較</div>
          <table className="tbl">
            <thead>
              <tr><th>年度</th><th className="num">AI 建議</th><th className="num">60/40</th><th className="num">差異</th></tr>
            </thead>
            <tbody>
              {bt.years.map((y,i) => {
                const d = bt.portfolio[i] - bt.benchmark[i];
                return (
                  <tr key={y}>
                    <td className="mono">{y}</td>
                    <td className="num" style={{color: bt.portfolio[i]>=0?'var(--pos)':'var(--neg)'}}>{fmt.pct(bt.portfolio[i])}</td>
                    <td className="num" style={{color: bt.benchmark[i]>=0?'var(--pos)':'var(--neg)'}}>{fmt.pct(bt.benchmark[i])}</td>
                    <td className="num" style={{color: d>=0?'var(--pos)':'var(--neg)'}}>{d>=0?'+':''}{d.toFixed(1)}pp</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>壓力測試 · 極端情境</div>
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            {[
              { case:'2020 COVID 崩盤', drop:-22, recover:'4 個月', note:'債券緩衝發揮作用' },
              { case:'2022 升息熊市',   drop:-12, recover:'9 個月', note:'股債齊跌 · 現金比例救援' },
              { case:'2008 金融海嘯 (模擬)', drop:-34, recover:'18 個月', note:'最大回撤情境' },
              { case:'台海地緣風險 (模擬)', drop:-28, recover:'未知', note:'全球 ETF 降低國別集中' },
            ].map((c,i) => (
              <div key={i} style={{padding:12, background:'var(--bg-2)', borderRadius:'var(--radius)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
                  <span style={{fontSize:12, color:'var(--text-0)'}}>{c.case}</span>
                  <span className="mono" style={{fontSize:13, color:'var(--neg)'}}>{c.drop}%</span>
                </div>
                <div style={{fontSize:11, color:'var(--text-3)', display:'flex', justifyContent:'space-between'}}>
                  <span>{c.note}</span>
                  <span>復原 {c.recover}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Settings({ risk, setRisk, theme, setTheme, density, setDensity }) {
  const riskLevels = [
    { id:'conservative', label:'保守型', stock:30, bond:60, other:10, note:'以保本為主,接受較低報酬' },
    { id:'moderate',     label:'穩健型', stock:60, bond:30, other:10, note:'兼顧成長與保本' },
    { id:'aggressive',   label:'積極型', stock:85, bond:10, other:5,  note:'追求長期最大化,容忍大波動' },
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>個人設定</h1>
          <p>告訴 AI 更多關於你的投資偏好 — 它會根據這些設定調整所有建議的口吻與力度。</p>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>風險偏好</div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {riskLevels.map(r => (
              <div key={r.id} onClick={()=>setRisk(r.id)}
                   style={{padding:14, border:'1px solid ' + (risk===r.id?'var(--accent)':'var(--line)'), borderRadius:'var(--radius)', cursor:'pointer', background: risk===r.id?'var(--accent-soft-2)':'transparent'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{width:14, height:14, borderRadius:'50%', border:'1px solid ' + (risk===r.id?'var(--accent)':'var(--line-2)'), display:'grid', placeItems:'center'}}>
                      {risk===r.id && <span style={{width:6, height:6, borderRadius:'50%', background:'var(--accent)'}}/>}
                    </span>
                    <span style={{fontSize:13, color:'var(--text-0)', fontWeight:500}}>{r.label}</span>
                  </div>
                  <span className="mono" style={{fontSize:11, color:'var(--text-2)'}}>{r.stock}/{r.bond}/{r.other}</span>
                </div>
                <div style={{fontSize:11, color:'var(--text-2)', marginBottom:8}}>{r.note}</div>
                <StackedBar items={[
                  { name:'股',   value:r.stock, color:'#22d3ee' },
                  { name:'債',   value:r.bond,  color:'#fbbf24' },
                  { name:'其他', value:r.other, color:'#94a3b8' },
                ]}/>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>投資目標與期限</div>
          <div style={{display:'flex', flexDirection:'column', gap:16}}>
            <div>
              <label className="field-label">投資期限</label>
              <input type="range" min="1" max="30" defaultValue="15" style={{width:'100%', accentColor:'var(--accent)'}}/>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)'}}>
                <span>1 年</span><span className="mono" style={{color:'var(--accent)', fontSize:14}}>15 年</span><span>30 年</span>
              </div>
            </div>
            <div>
              <label className="field-label">月定投金額</label>
              <input className="input" defaultValue="NT$ 30,000"/>
            </div>
            <div>
              <label className="field-label">目標金額</label>
              <input className="input" defaultValue="NT$ 15,000,000"/>
            </div>
            <div>
              <label className="field-label">不願意持有的類別</label>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {['加密貨幣','單一個股','槓桿 ETF','衍生品','高收益債'].map(t => (
                  <span key={t} className="chip" style={{cursor:'pointer'}}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
        <div className="card-title" style={{marginBottom:14}}>AI 溝通偏好</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14}}>
          {[
            { title:'通知頻率', options:['即時','每日摘要','每週','僅高優先'], default:'每日摘要' },
            { title:'解釋詳細度', options:['簡短結論','帶理由','完整推理','數據細節'], default:'帶理由' },
            { title:'AI 口吻', options:['直接','教練式','保守謹慎','數據導向'], default:'教練式' },
          ].map(g => (
            <div key={g.title}>
              <label className="field-label">{g.title}</label>
              <div style={{display:'flex', gap:4, flexDirection:'column'}}>
                {g.options.map(o => (
                  <div key={o} style={{padding:'8px 10px', border:'1px solid ' + (o===g.default?'var(--accent)':'var(--line)'), borderRadius:'var(--radius)', fontSize:12, cursor:'pointer', background: o===g.default?'var(--accent-soft-2)':'transparent', color:o===g.default?'var(--accent)':'var(--text-1)'}}>
                    {o}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{marginBottom:14}}>顯示偏好</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
          <div>
            <label className="field-label">主題</label>
            <div className="seg" style={{width:'100%'}}>
              <button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')} style={{flex:1}}>深色</button>
              <button className={theme==='light'?'active':''} onClick={()=>setTheme('light')} style={{flex:1}}>淺色</button>
            </div>
          </div>
          <div>
            <label className="field-label">資料密度</label>
            <div className="seg" style={{width:'100%'}}>
              {['compact','default','comfortable'].map(d => (
                <button key={d} className={density===d?'active':''} onClick={()=>setDensity(d)} style={{flex:1}}>
                  {{compact:'緊湊', default:'標準', comfortable:'寬鬆'}[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Chat() {
  const [msgs, setMsgs] = React.useState([
    { role:'ai', text:'嗨,我是你的投資配置助理。你可以問我任何關於目前持股、配置、市場事件的問題,我會結合你的個人資料回答。' },
    { role:'user', text:'最近美債殖利率升這麼多,我的債券部位會不會繼續套牢?要不要先出場?' },
    { role:'ai', html: true, text: `短答:<b>不建議出場,反而是長期加碼的機會</b>。<br/><br/>
原因 3 點:<br/>
1. 你的投資期限 15 年,短期殖利率波動對長期總報酬影響有限。<br/>
2. 美 10Y 殖利率目前 4.18%,意味新買入的債券能鎖定相對高的票息。<br/>
3. 你目前債券配置 13%,低於穩健型目標 20%,整體來看是「該加不該減」。<br/><br/>
<span style="color:var(--text-3); font-size:11px">參考資料:Fed 3 月會議紀要、CBOE 殖利率曲線、你的持股 BND/IEF</span>` },
  ]);
  const [input, setInput] = React.useState('');

  const send = async () => {
    if (!input.trim()) return;
    const q = input;
    const next = [...msgs, { role:'user', text: q }, { role:'ai', text:'正在分析...', loading:true }];
    setMsgs(next);
    setInput('');

    const context = `你是一位台灣的長期投資配置 AI 顧問。使用者資料:
- 姓名:${DATA.user.name},穩健型,投資期限 15 年,月定投 NT$30,000
- 總資產約 NT$2,847,650
- 目前配置:美股 34.5%、台股 30.6%、全球 9.1%、債券 13.0%、原物料 6.8%、現金 5.9%
- 目標配置:美股 30%、台股 22%、全球 12%、債券 20%、原物料 8%、現金 8%
- 主要持股:0050、006208、2330、VT、VTI、VOO、BND、IEF、GLD
- 市場:Fed 利率 4.25%、美 10Y 殖利率 4.18%、台灣 CPI 2.14%、USD/TWD 32.18

請以繁體中文回答,口吻專業但親切。回答要結構化:先「短答結論」,再列 2-3 個「原因」,最後附「參考資料」。可以用 HTML 標籤 <b>、<br/> 排版。不超過 200 字。不構成投資建議。`;

    try {
      const reply = await window.claude.complete({
        messages: [
          { role:'user', content: `${context}\n\n問題:${q}` }
        ]
      });
      setMsgs([...next.slice(0, -1), { role:'ai', html:true, text: reply.replace(/\n/g, '<br/>') }]);
    } catch (e) {
      setMsgs([...next.slice(0, -1), { role:'ai', text: '抱歉,AI 目前暫時無法回應,請稍後再試。' }]);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>對話 AI</h1>
          <p>用自然語言問問題。AI 會結合你的持股、風險偏好與 142 個資料來源即時回答。</p>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="history" size={14}/>歷史</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:'var(--density-gap)', height:'calc(100vh - 200px)'}}>
        <div className="card" style={{display:'flex', flexDirection:'column', padding:0}}>
          <div style={{flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:14}}>
            {msgs.map((m, i) => (
              <div key={i} style={{display:'flex', gap:10, alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth:'80%'}}>
                {m.role === 'ai' && <div style={{width:26, height:26, borderRadius:'50%', background:'var(--accent-soft)', color:'var(--accent)', display:'grid', placeItems:'center', flexShrink:0, fontSize:10, fontWeight:700}}>AI</div>}
                <div style={{padding:'10px 14px', borderRadius: m.role==='user'? '14px 14px 2px 14px' : '2px 14px 14px 14px',
                             background: m.role==='user' ? 'var(--accent)' : 'var(--bg-2)',
                             color: m.role==='user' ? 'var(--bg-0)' : 'var(--text-0)',
                             fontSize:13, lineHeight:1.65}}>
                  {m.loading
                    ? <span style={{display:'inline-flex', alignItems:'center', gap:8}}>正在分析 <span className="loader-dots"><i/><i/><i/></span></span>
                    : m.html ? <span dangerouslySetInnerHTML={{__html: m.text}}/> : m.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{padding:14, borderTop:'1px solid var(--line)'}}>
            <div style={{display:'flex', gap:6, marginBottom:10, flexWrap:'wrap'}}>
              {['解釋目前再平衡建議','美債要不要加碼','台股集中度問題','給我一份月度摘要'].map(s => (
                <span key={s} className="chip" style={{cursor:'pointer'}} onClick={()=>setInput(s)}>{s}</span>
              ))}
            </div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <input className="input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="問任何問題... (例:我該不該加碼 VTI?)" style={{flex:1}}/>
              <button className="btn primary" onClick={send}><Icon name="send" size={13}/>送出</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>本次對話引用的資料</div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {[
              { src:'你的持股', note:'BND 340 股 / IEF 120 股' },
              { src:'CBOE',    note:'美 10Y 殖利率 4.18%' },
              { src:'FOMC',    note:'3 月會議紀要' },
              { src:'設定',    note:'穩健型 · 15 年期限' },
              { src:'模型',    note:'利率敏感度分析' },
            ].map((c,i) => (
              <div key={i} style={{padding:10, border:'1px solid var(--line)', borderRadius:'var(--radius)', background:'var(--bg-2)'}}>
                <div className="source" style={{marginBottom:4}}><b>{c.src}</b></div>
                <div style={{fontSize:11, color:'var(--text-2)'}}>{c.note}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:10, color:'var(--text-3)', marginTop:12, lineHeight:1.6}}>
            每一則 AI 回答都可以追溯到具體資料源,避免「黑盒子」建議。
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Backtest, Settings, Chat });
