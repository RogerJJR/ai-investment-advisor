// Signals / Adjustment timing page
const SIGNAL_STATE_KEY = 'ai-advisor-signal-state-v1';

function loadSignalState() {
  try {
    const raw = localStorage.getItem(SIGNAL_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const cleaned = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (v.status === 'snoozed' && v.until && v.until < now) return;
      cleaned[k] = v;
    });
    return cleaned;
  } catch { return {}; }
}
function saveSignalState(state) {
  try { localStorage.setItem(SIGNAL_STATE_KEY, JSON.stringify(state)); } catch {}
}

function Signals() {
  useNow(15000);
  const [userHoldings] = useHoldings();
  const tickers = [...new Set([...RT.holdingsToTickers(userHoldings), 'TWD=X'])];
  const { quotes, status, updatedAt } = useLiveQuotes(tickers, { intervalMs: 60000 });
  const holdings = RT.applyQuotesToHoldings(userHoldings, quotes);
  const usdTwd = quotes['TWD=X']?.price;
  const totalMV = RT.totalValueTWD(holdings, usdTwd);
  const liveAllocation = RT.computeLiveAllocation(holdings, DATA.allocation, usdTwd);

  const [sigState, setSigState] = React.useState(loadSignalState);
  const [tab, setTab] = React.useState('pending'); // pending | handled | skipped

  const allSignals = status === 'live'
    ? [
        ...RT.generateAllocationSignals(liveAllocation, totalMV),
        ...DATA.signals.filter(s => s.type !== 'rebalance' && s.type !== 'concentration'),
      ]
    : DATA.signals;

  const setOne = (id, entry) => {
    const next = { ...sigState };
    if (entry === null) delete next[id]; else next[id] = entry;
    setSigState(next);
    saveSignalState(next);
  };

  const statusOf = (id) => sigState[id]?.status || 'pending';

  const signals = allSignals.filter(s => {
    const st = statusOf(s.id);
    if (tab === 'pending') return st === 'pending';
    if (tab === 'handled') return st === 'handled';
    if (tab === 'skipped') return st === 'skipped' || st === 'snoozed';
    return true;
  });

  const [selectedId, setSelectedId] = React.useState(null);
  const selected = signals.find(s => s.id === selectedId) || signals[0] || allSignals[0] || DATA.signals[0];

  const pendingAll = allSignals.filter(s => statusOf(s.id) === 'pending');
  const counts = {
    high:   pendingAll.filter(s => s.level === 'high').length,
    medium: pendingAll.filter(s => s.level === 'medium').length,
    low:    pendingAll.filter(s => s.level === 'low').length,
  };
  const handledCount = allSignals.filter(s => statusOf(s.id) === 'handled').length;
  const skippedCount = allSignals.filter(s => ['skipped','snoozed'].includes(statusOf(s.id))).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>調整時機提醒</h1>
          <p>AI 根據市場、總經、個別標的事件即時判斷「何時該調整、何時應按兵不動」。每一則建議都附上完整的推理過程與資料來源。</p>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="bell" size={14}/>通知設定</button>
          <button className="btn"><Icon name="filter" size={14}/>篩選</button>
        </div>
      </div>

      {/* Summary row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        {[
          { label:'待處理訊號', value:String(pendingAll.length), sub:`${counts.high} 高 · ${counts.medium} 中 · ${counts.low} 低`, color:'var(--text-0)' },
          { label:'已處理', value:String(handledCount), sub:'採納或自行處理', color:'var(--pos)' },
          { label:'略過 / 暫停', value:String(skippedCount), sub:'到期後重新評估', color:'var(--text-2)' },
          { label:'行情連線', value: status==='live'?'即時':status==='loading'?'連線中':status==='error'?'離線':'待連線', sub: updatedAt ? `更新 ${RT.relTime(updatedAt)}` : '每 60 秒刷新', color: status==='live'?'var(--pos)':'var(--text-2)' },
        ].map(k => (
          <div key={k.label} className="card">
            <div className="kpi-label">{k.label}</div>
            <div style={{fontSize:24, marginTop:6, color:k.color}} className="mono">{k.value}</div>
            <div style={{fontSize:11, color:'var(--text-3)', marginTop:4}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main layout: List + Detail */}
      <div style={{display:'grid', gridTemplateColumns:'380px 1fr', gap:'var(--density-gap)'}}>
        {/* List */}
        <div className="card" style={{padding:0, overflow:'hidden', alignSelf:'start'}}>
          <div style={{padding:'12px 14px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="card-title" style={{margin:0}}>全部訊號</div>
            <div className="seg" style={{transform:'scale(0.9)', transformOrigin:'right'}}>
              <button className={tab==='pending'?'active':''} onClick={()=>setTab('pending')}>待處理 · {pendingAll.length}</button>
              <button className={tab==='handled'?'active':''} onClick={()=>setTab('handled')}>已處理 · {handledCount}</button>
              <button className={tab==='skipped'?'active':''} onClick={()=>setTab('skipped')}>略過 · {skippedCount}</button>
            </div>
          </div>
          <div>
            {signals.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon"><Icon name="check" size={18}/></div>
                <div className="empty-title">目前沒有待處理訊號</div>
                <div>AI 每 60 秒重新評估;有新訊號時會自動出現。</div>
              </div>
            )}
            {signals.map(s => {
              const active = selected.id === s.id;
              const color = s.level === 'high' ? 'var(--neg)' : s.level === 'medium' ? 'var(--warn)' : s.level === 'low' ? 'var(--accent)' : 'var(--text-3)';
              return (
                <div key={s.id} onClick={()=>setSelectedId(s.id)}
                     style={{padding:'14px', borderBottom:'1px solid var(--line)', cursor:'pointer', borderLeft: active?`2px solid var(--accent)`:'2px solid transparent', background: active?'var(--accent-soft-2)':'transparent'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                      <span style={{width:6, height:6, borderRadius:'50%', background:color}}/>
                      <span className="mono-label" style={{color}}>{s.level === 'info' ? '訊息' : s.level === 'high' ? '高優先' : s.level === 'medium' ? '中優先' : '低優先'}</span>
                      {s.live && <span className="chip accent" style={{fontSize:9, padding:'0 4px'}}><span className="dot pulse" style={{width:4, height:4}}/>即時</span>}
                    </div>
                    <span style={{fontSize:10, color:'var(--text-3)'}}>{s.time}</span>
                  </div>
                  <div style={{fontSize:13, color:'var(--text-0)', fontWeight:500, marginBottom:4}}>{s.title}</div>
                  <div style={{fontSize:11, color:'var(--text-3)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{s.summary}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div>
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
              <div style={{flex:1}}>
                <div style={{display:'flex', gap:8, marginBottom:8}}>
                  <ImpactPill level={selected.level}/>
                  <span className="chip">{selected.type}</span>
                  <span style={{fontSize:11, color:'var(--text-3)', alignSelf:'center'}}>觸發於 {selected.time}</span>
                </div>
                <h2 style={{margin:'4px 0 8px', fontSize:19, fontWeight:500, letterSpacing:'-0.01em'}}>{selected.title}</h2>
                <p style={{margin:0, fontSize:13, color:'var(--text-2)', lineHeight:1.7}}>{selected.summary}</p>
              </div>
              <div style={{textAlign:'right', marginLeft:20}}>
                <div className="mono-label">建議動作</div>
                <div className="mono" style={{fontSize:18, color: selected.action==='buy'?'var(--pos)':selected.action==='sell'?'var(--neg)':'var(--text-2)', marginTop:4}}>
                  {selected.action === 'buy' ? '加碼' : selected.action === 'sell' ? '減碼' : '持有'}
                </div>
                <div className="mono" style={{fontSize:12, color:'var(--text-0)', marginTop:2}}>{selected.magnitude}</div>
              </div>
            </div>

            <div style={{display:'flex', gap:8}}>
              <button className="btn primary" onClick={() => setOne(selected.id, { status:'handled', at: Date.now(), how:'adopted' })}><Icon name="check" size={13}/>採納建議</button>
              <button className="btn" onClick={() => setOne(selected.id, { status:'handled', at: Date.now(), how:'manual' })}>自行處理</button>
              <button className="btn ghost" onClick={() => setOne(selected.id, { status:'snoozed', at: Date.now(), until: Date.now() + 14*24*3600*1000 })}>稍後提醒 (14 天)</button>
              {statusOf(selected.id) !== 'pending' && (
                <button className="btn ghost" onClick={() => setOne(selected.id, null)}>恢復待處理</button>
              )}
              <div style={{flex:1}}/>
              <button className="btn ghost" onClick={() => setOne(selected.id, { status:'skipped', at: Date.now() })}><Icon name="close" size={13}/>略過</button>
            </div>
          </div>

          {/* Triggers */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
            <div className="card">
              <div className="card-title" style={{marginBottom:14}}>觸發條件</div>
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {[
                  { label:'債券配置 < 目標 -5pp',   met:true,  value:'-7.0pp',  source:'持股' },
                  { label:'美 10Y 殖利率 > 4.0%',  met:true,  value:'4.18%',   source:'CBOE' },
                  { label:'CPI YoY 趨緩 3 個月',   met:true,  value:'2.14%',   source:'DGBAS' },
                  { label:'VIX < 20',               met:true,  value:'17.8',    source:'CBOE' },
                  { label:'股債相關 < 0.3',         met:false, value:'0.42',    source:'模型' },
                ].map((c,i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px dashed var(--line)'}}>
                    <span style={{width:18, height:18, borderRadius:4, background: c.met?'var(--pos-soft)':'var(--bg-3)', color: c.met?'var(--pos)':'var(--text-4)', display:'grid', placeItems:'center'}}>
                      <Icon name={c.met?'check':'close'} size={11}/>
                    </span>
                    <span style={{flex:1, fontSize:12, color:'var(--text-1)'}}>{c.label}</span>
                    <span className="mono" style={{fontSize:11, color:c.met?'var(--text-0)':'var(--text-3)'}}>{c.value}</span>
                    <span className="source" style={{fontSize:9}}>{c.source}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:12, fontSize:11, color:'var(--text-3)'}}>4 / 5 條件達成,觸發閾值 = 3</div>
            </div>

            <div className="card">
              <div className="card-title" style={{marginBottom:14}}>信心分析</div>
              <div style={{display:'flex', alignItems:'center', gap:20, marginBottom:14}}>
                <div className="donut" style={{'--p': selected.confidence, '--c':'var(--accent)'}}>
                  <span>{selected.confidence}%</span>
                </div>
                <div style={{flex:1, fontSize:12, color:'var(--text-2)', lineHeight:1.7}}>
                  信心來自多重資料一致性:總經與持股分析皆指向相同方向。<br/>
                  主要不確定因子為:短期 Fed 政策路徑。
                </div>
              </div>

              <dl className="kv">
                <dt>資料一致性</dt>
                <dd style={{color:'var(--pos)'}}>91%</dd>
                <dt>歷史訊號準度</dt>
                <dd>74%</dd>
                <dt>與模型平均距離</dt>
                <dd>+0.3σ</dd>
                <dt>回測勝率 (5Y)</dt>
                <dd>68%</dd>
              </dl>
            </div>
          </div>

          {/* Impact projection */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">執行後預估影響</div>
                <div className="card-sub">若採納此建議,未來 12 個月投資組合預估變化</div>
              </div>
            </div>

            <AreaChart
              series={[
                { label:'採納建議', color:'var(--accent)', values:[100,101.2,102.8,103.1,104.4,105.9,106.8,108.2,109.0,110.4,111.1,112.4,113.6] },
                { label:'維持現狀', color:'var(--text-3)', values:[100,101.0,101.8,102.2,102.0,103.1,103.4,104.1,104.8,105.2,105.9,106.4,107.0] },
              ]}
              width={820} height={220}
              labels={['現在','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12']}
            />

            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginTop:14}}>
              {[
                { label:'預估年化報酬', a:'7.4%', b:'6.2%', delta:'+1.2pp' },
                { label:'預估波動', a:'10.1%', b:'12.8%', delta:'-2.7pp' },
                { label:'最大回撤', a:'-16%', b:'-22%', delta:'改善 6pp' },
                { label:'夏普比', a:'0.58', b:'0.41', delta:'+0.17' },
              ].map(m => (
                <div key={m.label} style={{padding:12, background:'var(--bg-2)', borderRadius:'var(--radius)'}}>
                  <div className="mono-label">{m.label}</div>
                  <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:4}}>
                    <span className="mono" style={{fontSize:16, color:'var(--accent)'}}>{m.a}</span>
                    <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>vs {m.b}</span>
                  </div>
                  <div className="mono" style={{fontSize:11, color:'var(--pos)', marginTop:2}}>{m.delta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

window.Signals = Signals;
