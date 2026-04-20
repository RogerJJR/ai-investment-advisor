// Data sources page
function Sources() {
  const [cat, setCat] = React.useState('全部');
  const [selected, setSelected] = React.useState(DATA.sources[1]);

  const cats = ['全部', '總經', '央行', '財報', '新聞', '評等', 'ETF', '技術', '情緒'];
  const filtered = cat === '全部' ? DATA.sources : DATA.sources.filter(s => s.cat === cat);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>資料基底</h1>
          <p>AI 所有判斷的根基是這些公開資料。透明呈現:資料源、更新頻率、最近一次抓取時間,以及每一則資料對投資組合的影響。</p>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="refresh" size={14}/>同步最新</button>
          <button className="btn"><Icon name="link" size={14}/>新增來源</button>
        </div>
      </div>

      {/* Coverage summary */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        {[
          { label:'資料源總數', value:'142', sub:'8 個類別' },
          { label:'即時串流', value:'23', sub:'央行、指數、ETF', color:'var(--accent)' },
          { label:'今日更新', value:'48', sub:'最近 4 小時 12 筆' },
          { label:'覆蓋率',  value:'94%', sub:'符合 AI 推論需求', color:'var(--pos)' },
          { label:'平均延遲', value:'2.8s', sub:'從發布到入庫' },
        ].map(k => (
          <div key={k.label} className="card">
            <div className="kpi-label">{k.label}</div>
            <div className="mono" style={{fontSize:22, marginTop:6, color: k.color || 'var(--text-0)'}}>{k.value}</div>
            <div style={{fontSize:11, color:'var(--text-3)', marginTop:4}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Source categories grid */}
      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
        <div className="card-head">
          <div>
            <div className="card-title">資料類別覆蓋</div>
            <div className="card-sub">各類別的來源數、最新更新時間、當前 AI 關注度</div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14}}>
          {[
            { name:'總經指標', count:18, providers:'DGBAS · BLS · OECD', attention:86, last:'3 分鐘前' },
            { name:'央行政策', count:12, providers:'Fed · ECB · BOJ · 台央行', attention:94, last:'2 小時前' },
            { name:'財報數字', count:32, providers:'公開資訊觀測站 · SEC', attention:62, last:'今日 15:30' },
            { name:'分析師評等', count:22, providers:'MS · GS · JPM · CITI', attention:48, last:'今日 11:00' },
            { name:'市場新聞', count:25, providers:'Reuters · Bloomberg · 鉅亨', attention:71, last:'18 分鐘前' },
            { name:'技術指標', count:14, providers:'TradingView · yfinance', attention:54, last:'即時' },
            { name:'ETF 成分', count:9,  providers:'Vanguard · iShares · 元大', attention:32, last:'昨日' },
            { name:'市場情緒', count:10, providers:'AAII · F&G · Twitter', attention:58, last:'1 小時前' },
          ].map(c => (
            <div key={c.name} style={{padding:14, border:'1px solid var(--line)', borderRadius:'var(--radius)', background:'var(--bg-2)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <span style={{fontSize:13, color:'var(--text-0)', fontWeight:500}}>{c.name}</span>
                <span className="mono" style={{fontSize:11, color:'var(--text-2)'}}>{c.count}</span>
              </div>
              <div style={{fontSize:10, color:'var(--text-3)', marginBottom:10, height:28}}>{c.providers}</div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5, fontSize:10}}>
                <span style={{color:'var(--text-3)'}}>AI 關注度</span>
                <span className="mono" style={{color:c.attention>=70?'var(--accent)':'var(--text-2)'}}>{c.attention}</span>
              </div>
              <div className="bar"><span style={{width:c.attention+'%', background: c.attention>=70?'var(--accent)':'var(--text-3)'}}/></div>
              <div style={{display:'flex', alignItems:'center', gap:6, marginTop:10, fontSize:10, color:'var(--text-3)'}}>
                <span className="dot" style={{color:'var(--pos)'}}/>
                <span>更新於 {c.last}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feed + detail */}
      <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:'var(--density-gap)'}}>
        <div className="card" style={{padding:0}}>
          <div style={{padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, overflow:'auto'}}>
            <div className="card-title" style={{margin:0, marginRight:8, whiteSpace:'nowrap'}}>即時資料流</div>
            <div className="seg">
              {cats.map(c => (
                <button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            {filtered.map((s, i) => {
              const active = selected.title === s.title;
              return (
                <div key={i} onClick={()=>setSelected(s)}
                     style={{padding:'14px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer', background: active?'var(--accent-soft-2)':'transparent', borderLeft: active?'2px solid var(--accent)':'2px solid transparent'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:4}}>
                    <span className="chip" style={{fontSize:10}}>{s.cat}</span>
                    <ImpactPill level={s.impact}/>
                    <span style={{fontSize:10, color:'var(--text-3)', marginLeft:'auto'}} className="mono">{s.ts}</span>
                  </div>
                  <div style={{fontSize:13, color:'var(--text-0)', marginBottom:4, fontWeight:500}}>{s.title}</div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <span className="source"><b>{s.provider}</b></span>
                    <span style={{fontSize:10, color:'var(--text-3)'}}>· 標籤 {s.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div style={{display:'flex', gap:8, marginBottom:10}}>
              <span className="chip">{selected.cat}</span>
              <ImpactPill level={selected.impact}/>
              <span className="source" style={{marginLeft:'auto'}}><b>{selected.provider}</b></span>
            </div>
            <h3 style={{margin:'0 0 10px', fontSize:15, fontWeight:500, lineHeight:1.4}}>{selected.title}</h3>
            <div style={{fontSize:11, color:'var(--text-3)', marginBottom:14}} className="mono">{selected.ts}</div>

            <div className="card-title" style={{fontSize:10, marginBottom:8}}>AI 摘要</div>
            <p style={{margin:'0 0 14px', fontSize:12, color:'var(--text-1)', lineHeight:1.7}}>
              Fed 3 月會議紀要顯示多數委員傾向在第二季維持利率不變,需要看到 CPI 連續 2 個月低於 2.5% 才會考慮降息。
              市場將此解讀為「偏鷹」,美債殖利率短線上升 8bps。
            </p>

            <div className="card-title" style={{fontSize:10, marginBottom:8}}>對你的投資組合影響</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                { tag:'債券 ETF', note:'殖利率上行,進場點位更佳', dir:'pos' },
                { tag:'美股', note:'高估值類股受壓;成長股比價值股敏感', dir:'neg' },
                { tag:'USD/TWD', note:'短期支撐美元', dir:'pos' },
              ].map((im,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:8, background:'var(--bg-2)', borderRadius:'var(--radius)'}}>
                  <span className="chip" style={{fontSize:10}}>{im.tag}</span>
                  <span style={{flex:1, fontSize:11, color:'var(--text-2)'}}>{im.note}</span>
                  <span style={{color: im.dir==='pos'?'var(--pos)':'var(--neg)'}}>
                    <Icon name={im.dir==='pos'?'arrow-up':'arrow-down'} size={12}/>
                  </span>
                </div>
              ))}
            </div>

            <div style={{display:'flex', gap:6, marginTop:14}}>
              <button className="btn" style={{flex:1}}><Icon name="external" size={12}/>原始出處</button>
              <button className="btn" style={{flex:1}}>觸發的訊號 (2)</button>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{marginBottom:12}}>資料採集架構</div>
            <div style={{display:'flex', flexDirection:'column', gap:8, fontSize:11}}>
              {[
                { stage:'採集', note:'每 5 分鐘 · 官方 API / 公開 RSS',  time:'23ms' },
                { stage:'清洗', note:'去重、標準化、單位轉換',             time:'48ms' },
                { stage:'標記', note:'LLM 自動標籤 · 8 類 24 標籤',        time:'2.1s' },
                { stage:'索引', note:'向量資料庫 + 結構化欄位',            time:'120ms' },
                { stage:'推論', note:'觸發 AI 建議更新',                    time:'5.8s' },
              ].map((s,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{width:22, height:22, borderRadius:4, background:'var(--bg-3)', color:'var(--accent)', display:'grid', placeItems:'center', fontSize:10, fontWeight:600}}>{i+1}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12, color:'var(--text-1)'}}>{s.stage}</div>
                    <div style={{fontSize:10, color:'var(--text-3)'}}>{s.note}</div>
                  </div>
                  <span className="mono" style={{fontSize:10, color:'var(--text-2)'}}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

window.Sources = Sources;
