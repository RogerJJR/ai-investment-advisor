// Dashboard page
const MACRO_LIVE = {
  '美國 10Y 殖利率': { ticker: '^TNX',  suffix: '%', digits: 2 },
  'VIX 恐慌指數':    { ticker: '^VIX',  suffix: '',  digits: 1 },
  'USD/TWD':         { ticker: 'TWD=X', suffix: '',  digits: 2 },
};

function Dashboard({ risk }) {
  const [userHoldings] = useHoldings();
  const holdingTickers = RT.holdingsToTickers(userHoldings);
  const macroTickers = Object.values(MACRO_LIVE).map(m => m.ticker);
  const allTickers = [...new Set([...holdingTickers, ...macroTickers])];
  const { quotes, status, updatedAt, refresh } = useLiveQuotes(allTickers, { intervalMs: 60000 });
  const holdings = RT.applyQuotesToHoldings(userHoldings, quotes);
  const liveCount = holdings.filter(h => h.live).length;
  const usdTwd = quotes['TWD=X']?.price;
  const liveAllocation = RT.computeLiveAllocation(holdings, DATA.allocation, usdTwd);
  const totalMV = RT.totalValueTWD(holdings, usdTwd);
  const liveSignals = status === 'live'
    ? [...RT.generateAllocationSignals(liveAllocation, totalMV), ...DATA.signals.filter(s => s.type !== 'rebalance' && s.type !== 'concentration')]
    : DATA.signals;
  const absDeviation = liveAllocation.reduce((s,a) => s + Math.abs(a.current - a.target), 0);
  const needRebalance = liveAllocation.filter(a => Math.abs(a.current - a.target) >= 3).length;

  const totalCost = RT.totalCostTWD(holdings, usdTwd);
  const totalValue = totalMV;
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost ? (pnl/totalCost)*100 : 0;
  const ytd = 10.8;

  const spark = [92,94,93,96,98,97,100,103,102,105,108,107,110,112,111,114];

  const riskLabel = { conservative: '保守型', moderate: '穩健型', aggressive: '積極型' }[risk];

  const liveLabel = status === 'live'
    ? `即時 · ${liveCount}/${holdings.length} 檔已連線 · ${RT.relTime(updatedAt)}`
    : status === 'loading' ? '正在連線行情…'
    : status === 'error' ? '行情離線,顯示快照'
    : '待連線';
  const liveColor = status === 'live' ? 'var(--pos)' : status === 'error' ? 'var(--neg)' : 'var(--text-3)';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>早安,{DATA.user.name} · 這是你的 4 月總覽</h1>
          <p>AI 已同步最新資料,整體配置相對目標有 3 項需要調整。投資期限尚餘 15 年,距離下一次再平衡建議執行日還有 12 天。</p>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:11, color:liveColor}}>
            <span className={'dot ' + (status==='live'?'pulse':'')} style={{width:6, height:6, borderRadius:'50%', background:liveColor, display:'inline-block'}}/>
            {liveLabel}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={refresh} title="重新抓取即時行情"><Icon name="refresh" size={14}/>重新整理</button>
          <button className="btn"><Icon name="download" size={14}/>匯出月報</button>
          <button className="btn primary"><Icon name="sparkles" size={14}/>產生 AI 月度摘要</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        <div className="card">
          <div className="kpi-label">總資產</div>
          <div className="kpi-value">{fmt.tw(totalValue)}</div>
          <div className="kpi-delta pos"><Icon name="arrow-up" size={12}/>{fmt.tw(pnl)} · {fmt.pct(pnlPct)}</div>
          <div style={{marginTop:14}}><Sparkline values={spark} width={240} height={36} /></div>
        </div>

        <div className="card">
          <div className="kpi-label">年初至今 (YTD)</div>
          <div className="kpi-value" style={{color:'var(--pos)'}}>{fmt.pct(ytd)}</div>
          <div className="kpi-delta">vs 基準 <span style={{color:'var(--text-1)'}}>60/40</span> 8.4%</div>
          <div style={{marginTop:14, display:'flex', alignItems:'center', gap:8}}>
            <div className="bar" style={{flex:1}}><span style={{width:'72%', background:'var(--pos)'}}/></div>
            <span className="mono" style={{fontSize:10, color:'var(--text-3)'}}>+2.4pp</span>
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">配置偏離度</div>
          <div className="kpi-value" style={{color: absDeviation > 10 ? 'var(--warn)' : 'var(--pos)'}}>{absDeviation.toFixed(1)}<span style={{fontSize:14, color:'var(--text-3)', marginLeft:4}}>pp</span></div>
          <div className="kpi-delta">需要再平衡的項目 <span style={{color:'var(--text-1)'}}>{needRebalance} / {liveAllocation.length}</span></div>
          <div style={{marginTop:14}}>
            <StackedBar items={[
              { name:'對齊', value: 3, color: 'var(--pos)' },
              { name:'輕微', value: 2, color: 'var(--warn)' },
              { name:'明顯', value: 1, color: 'var(--neg)' },
            ]}/>
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">AI 整體信心</div>
          <div className="kpi-value">78<span style={{fontSize:14, color:'var(--text-3)', marginLeft:4}}>/100</span></div>
          <div className="kpi-delta">基於 <span style={{color:'var(--text-1)'}}>142</span> 筆資料來源</div>
          <div style={{marginTop:14}}><ConfidenceMeter value={78}/></div>
        </div>
      </div>

      {/* Row 2: Allocation + Signals */}
      <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">資產配置 · 現況 vs 目標</div>
              <div className="card-sub">長條表示目前比例,虛線為 AI 建議的目標權重</div>
            </div>
            <div className="seg">
              <button className="active">權重</button>
              <button>金額</button>
              <button>盈虧</button>
            </div>
          </div>
          <BarChart items={liveAllocation} width={640} height={220}/>
          <div style={{display:'flex', gap:14, marginTop:14, flexWrap:'wrap'}}>
            {liveAllocation.map(a => (
              <div key={a.name} style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-2)'}}>
                <span style={{width:8, height:8, borderRadius:2, background:a.color}}/>
                <span>{a.name}</span>
                <span className="mono" style={{color:'var(--text-0)'}}>{a.current.toFixed(1)}%</span>
                <span className="mono" style={{color:'var(--text-3)'}}>→ {a.target}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">AI 訊號佇列</div>
              <div className="card-sub">優先級由高至低 · 點擊查看推理</div>
            </div>
            <span className="chip accent"><span className="dot pulse"/>即時</span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {liveSignals.slice(0,3).map(s => (
              <SignalMini key={s.id} sig={s}/>
            ))}
            <button className="btn ghost" style={{alignSelf:'flex-start'}}>查看全部 {liveSignals.length} 個訊號<Icon name="arrow-right" size={12}/></button>
          </div>
        </div>
      </div>

      {/* Row 3: Macro snapshot + holdings summary */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1.3fr', gap:'var(--density-gap)'}}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">總經快照</div>
              <div className="card-sub">AI 判斷的核心變量 · 即時</div>
            </div>
            <button className="btn ghost" style={{height:28, fontSize:11}} onClick={refresh}><Icon name="refresh" size={11}/>{updatedAt ? RT.relTime(updatedAt) : '重新整理'}</button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            {DATA.macro.map(m => {
              const live = MACRO_LIVE[m.label];
              const q = live ? quotes[live.ticker] : null;
              const isLive = q && q.price != null;
              const value = isLive
                ? q.price.toFixed(live.digits) + live.suffix
                : m.value;
              const chg = isLive ? q.changePct : null;
              const trend = isLive
                ? (chg > 0.05 ? 'up' : chg < -0.05 ? 'down' : 'flat')
                : m.trend;
              const delta = isLive
                ? (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'
                : m.delta;
              return (
                <div key={m.label} style={{display:'flex', flexDirection:'column', gap:4, padding:'8px 0', borderBottom:'1px dashed var(--line)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)'}}>
                    <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      {m.label}
                      {isLive && <span className="dot pulse" style={{width:5, height:5, borderRadius:'50%', background:'var(--pos)', display:'inline-block'}}/>}
                    </span>
                    <span className="source"><b>{isLive ? 'Yahoo' : m.source}</b></span>
                  </div>
                  <div style={{display:'flex', alignItems:'baseline', gap:8}}>
                    <span className="mono" style={{fontSize:18, color:'var(--text-0)'}}>{value}</span>
                    <span className="mono" style={{fontSize:11, color: trend==='up'?'var(--pos)':trend==='down'?'var(--neg)':'var(--text-3)'}}>
                      {trend==='up'?'▲':trend==='down'?'▼':'—'} {delta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">持倉前 6 大</div>
              <div className="card-sub">含損益與 AI 短評</div>
            </div>
            <button className="btn ghost" style={{height:28, fontSize:11}}>全部 {DATA.holdings.length}<Icon name="arrow-right" size={11}/></button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>標的</th><th>類別</th>
                <th className="num">市值</th>
                <th className="num">日漲跌</th>
                <th className="num">損益%</th>
                <th className="num">權重</th>
                <th>AI 短評</th>
              </tr>
            </thead>
            <tbody>
              {holdings.slice(0,6).map(h => {
                const mv = RT.holdingMarketValueTWD(h, usdTwd);
                const pl = h.cost ? ((h.price - h.cost)/h.cost) * 100 : 0;
                const comment = pl > 30 ? '評價已反映' : pl < -5 ? '建議逢低' : '持有';
                const dayChg = h.changePct ?? 0;
                return (
                  <tr key={h.id}>
                    <td>
                      <div style={{display:'flex', flexDirection:'column'}}>
                        <span className="mono" style={{fontSize:12, display:'flex', alignItems:'center', gap:6}}>
                          {h.symbol}
                          {h.live && <span className="dot pulse" style={{width:5, height:5, borderRadius:'50%', background:'var(--pos)', display:'inline-block'}}/>}
                        </span>
                        <span style={{fontSize:11, color:'var(--text-3)'}}>{h.name}</span>
                      </div>
                    </td>
                    <td><span className="chip" style={{fontSize:10}}>{h.type}</span></td>
                    <td className="num">{fmt.tw(mv)}</td>
                    <td className="num" style={{color: dayChg>=0?'var(--pos)':'var(--neg)'}}>{h.live ? fmt.pct(dayChg, 2) : '—'}</td>
                    <td className="num" style={{color: pl>=0?'var(--pos)':'var(--neg)'}}>{fmt.pct(pl)}</td>
                    <td className="num">{h.weight.toFixed(1)}%</td>
                    <td style={{fontSize:11, color:'var(--text-2)'}}>{comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="disclaimer" style={{marginTop:24}}>
        本網站所有建議皆來自公開市場資料與 AI 模型推論,不構成投資建議;投資有風險,過去績效不代表未來結果。
      </div>
    </>
  );
}

function SignalMini({ sig }) {
  const levelMap = {
    high: { color:'var(--neg)', bg:'var(--neg-soft)', label:'高' },
    medium: { color:'var(--warn)', bg:'var(--warn-soft)', label:'中' },
    low: { color:'var(--accent)', bg:'var(--accent-soft)', label:'低' },
    info: { color:'var(--text-3)', bg:'var(--bg-2)', label:'訊息' },
  };
  const L = levelMap[sig.level];
  const actionColor = sig.action === 'buy' ? 'var(--pos)' : sig.action === 'sell' ? 'var(--neg)' : 'var(--text-2)';
  const actionLabel = { buy:'加碼', sell:'減碼', hold:'持有' }[sig.action];

  return (
    <div style={{padding:12, border:'1px solid var(--line)', borderLeft:`2px solid ${L.color}`, borderRadius:'var(--radius)', background:'var(--bg-2)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:6}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <span style={{padding:'1px 6px', borderRadius:3, background:L.bg, color:L.color, fontSize:10, fontWeight:600, letterSpacing:'0.04em'}}>{L.label}</span>
          <span style={{fontSize:10, color:'var(--text-3)'}}>{sig.time}</span>
        </div>
        <span className="mono" style={{fontSize:10, color: actionColor, fontWeight:600}}>{actionLabel} {sig.magnitude}</span>
      </div>
      <div style={{fontSize:13, color:'var(--text-0)', marginBottom:6, fontWeight:500}}>{sig.title}</div>
      <div style={{fontSize:11, color:'var(--text-2)', lineHeight:1.6}}>{sig.summary}</div>
      <div style={{display:'flex', alignItems:'center', gap:10, marginTop:8}}>
        <span className="mono-label">信心 {sig.confidence}%</span>
        <ConfidenceMeter value={sig.confidence}/>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, SignalMini });
