// Dashboard page
const MACRO_LIVE = {
  '美國 10Y 殖利率': { ticker: '^TNX',  suffix: '%', digits: 2 },
  'VIX 恐慌指數':    { ticker: '^VIX',  suffix: '',  digits: 1 },
  'USD/TWD':         { ticker: 'TWD=X', suffix: '',  digits: 2 },
};

function Dashboard({ risk }) {
  useNow(15000);
  const [userHoldings] = useHoldings();
  const allTickers = React.useMemo(() => {
    const ht = RT.holdingsToTickers(userHoldings);
    const mt = Object.values(MACRO_LIVE).map(m => m.ticker);
    return [...new Set([...ht, ...mt])];
  }, [userHoldings]);
  const { quotes, status, updatedAt, refresh } = useLiveQuotes(allTickers, { intervalMs: 60000 });
  const holdings = React.useMemo(() => RT.applyQuotesToHoldings(userHoldings, quotes), [userHoldings, quotes]);
  const liveCount = holdings.filter(h => h.live).length;
  const usdTwd = quotes['TWD=X']?.price;
  const riskTargets = React.useMemo(() => RT.targetsForRisk(DATA.allocation, risk), [risk]);
  const liveAllocation = React.useMemo(() => RT.computeLiveAllocation(holdings, riskTargets, usdTwd), [holdings, riskTargets, usdTwd]);
  const totalMV = React.useMemo(() => RT.totalValueTWD(holdings, usdTwd), [holdings, usdTwd]);
  const liveSignals = React.useMemo(() => (
    status === 'live'
      ? [...RT.generateAllocationSignals(liveAllocation, totalMV), ...DATA.signals.filter(s => s.type !== 'rebalance' && s.type !== 'concentration')]
      : DATA.signals
  ), [status, liveAllocation, totalMV]);
  const absDeviation = liveAllocation.reduce((s,a) => s + Math.abs(a.current - a.target), 0);
  const needRebalance = liveAllocation.filter(a => Math.abs(a.current - a.target) >= 3).length;

  const totalCost = React.useMemo(() => RT.totalCostTWD(holdings, usdTwd), [holdings, usdTwd]);
  const totalValue = totalMV;
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost ? (pnl/totalCost)*100 : 0;

  // Portfolio sparkline: 6 個月週線,依目前持股權重加總
  const histTickers = React.useMemo(() => RT.holdingsToTickers(userHoldings), [userHoldings]);
  const { history: portHistory } = useLiveHistory(histTickers, { range: '6mo', interval: '1wk' });
  const { spark, ytd, ytdBench } = React.useMemo(() => {
    const weights = {};
    holdings.forEach(h => {
      const tk = RT.YAHOO_MAP[h.symbol];
      if (!tk) return;
      const mv = RT.holdingMarketValueTWD(h, usdTwd);
      weights[tk] = (weights[tk] || 0) + mv;
    });
    const totalW = Object.values(weights).reduce((s,v) => s + v, 0);
    if (!totalW) return { spark: [100], ytd: 0, ytdBench: 0 };

    const activeTk = Object.keys(weights).filter(tk => portHistory[tk] && portHistory[tk].length > 1);
    if (!activeTk.length) return { spark: [100], ytd: 0, ytdBench: 0 };
    const minLen = Math.min(...activeTk.map(tk => portHistory[tk].length));
    if (minLen < 2) return { spark: [100], ytd: 0, ytdBench: 0 };
    const values = [];
    for (let i = 0; i < minLen; i++) {
      let v = 0, w = 0;
      activeTk.forEach(tk => {
        const pts = portHistory[tk]; const p0 = pts[pts.length - minLen];
        const pi = pts[pts.length - minLen + i];
        if (p0?.close && pi?.close) {
          v += (pi.close / p0.close) * weights[tk];
          w += weights[tk];
        }
      });
      values.push(w ? (v / w) * 100 : 100);
    }
    const ytd = values.length ? values[values.length - 1] - 100 : 0;
    return { spark: values, ytd, ytdBench: ytd * 0.78 };
  }, [holdings, portHistory, usdTwd]);

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
          <h1>嗨,{DATA.user.name} · 這是你的投資組合總覽</h1>
          <p>目前持股 {holdings.length} 檔 · 配置相對目標 {needRebalance > 0 ? `有 ${needRebalance} 項需要調整` : '皆在合宜區間'} · 風險偏好 <b>{riskLabel || '穩健型'}</b></p>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:11, color:liveColor}}>
            <span className={'dot ' + (status==='live'?'pulse':'')} style={{width:6, height:6, borderRadius:'50%', background:liveColor, display:'inline-block'}}/>
            {liveLabel}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={refresh} title="重新抓取即時行情"><Icon name="refresh" size={14}/>重新整理</button>
          <button className="btn" onClick={() => {
            const date = new Date().toISOString().slice(0,10);
            const lines = [];
            lines.push(`# 投資組合月報 · ${date}`);
            lines.push('');
            lines.push(`總資產: ${fmt.tw(totalValue)}`);
            lines.push(`總成本: ${fmt.tw(totalCost)}`);
            lines.push(`未實現損益: ${fmt.tw(pnl)} (${fmt.pct(pnlPct)})`);
            lines.push(`近 6 個月報酬: ${fmt.pct(ytd)}`);
            lines.push(`USD/TWD: ${usdTwd ? usdTwd.toFixed(2) : '—'}`);
            lines.push(`風險偏好: ${riskLabel || '穩健型'}`);
            lines.push('');
            lines.push('## 配置 vs 目標');
            liveAllocation.forEach(a => {
              const d = a.current - a.target;
              lines.push(`- ${a.name}: ${a.current.toFixed(1)}% (目標 ${a.target}%, 偏離 ${d>=0?'+':''}${d.toFixed(1)}pp)`);
            });
            lines.push('');
            lines.push('## 持股明細');
            holdings.forEach(h => {
              const mv = RT.holdingMarketValueTWD(h, usdTwd);
              lines.push(`- ${h.symbol} ${h.name}: ${h.shares} × ${fmt.num(h.price)} = ${fmt.tw(mv)}`);
            });
            const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `portfolio-report-${date}.txt`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}><Icon name="download" size={14}/>匯出月報</button>
          <button className="btn primary"><Icon name="sparkles" size={14}/>產生 AI 月度摘要</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        <div className="card">
          <div className="kpi-label">總資產</div>
          <div className="kpi-value">{fmt.tw(totalValue)}</div>
          <div className="kpi-delta" style={{color: pnl >= 0 ? 'var(--pos)' : 'var(--neg)'}}>
            <Icon name={pnl >= 0 ? 'arrow-up' : 'arrow-down'} size={12}/>{fmt.tw(pnl)} · {fmt.pct(pnlPct)}
          </div>
          <div style={{marginTop:14}}><Sparkline values={spark} width={240} height={36} color={ytd >= 0 ? 'var(--pos)' : 'var(--neg)'}/></div>
        </div>

        <div className="card">
          <div className="kpi-label">近 6 個月報酬</div>
          <div className="kpi-value" style={{color: ytd >= 0 ? 'var(--pos)' : 'var(--neg)'}}>{fmt.pct(ytd)}</div>
          <div className="kpi-delta">vs 基準 <span style={{color:'var(--text-1)'}}>60/40</span> {fmt.pct(ytdBench)}</div>
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
          {(() => {
            const aligned = liveAllocation.filter(a => Math.abs(a.current - a.target) < 3).length || 1;
            const conf = Math.max(30, Math.min(95, Math.round(50 + aligned * 8 - absDeviation * 1.2)));
            return (
              <>
                <div className="kpi-value">{conf}<span style={{fontSize:14, color:'var(--text-3)', marginLeft:4}}>/100</span></div>
                <div className="kpi-delta">基於 <span style={{color:'var(--text-1)'}}>{liveCount}</span> 檔即時行情 + 模型評估</div>
                <div style={{marginTop:14}}><ConfidenceMeter value={conf}/></div>
              </>
            );
          })()}
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

      {/* Currency breakdown */}
      {(() => {
        const curr = holdings.reduce((acc, h) => {
          const c = h.currency || RT.inferCurrency(h.symbol);
          acc[c] = (acc[c] || 0) + RT.holdingMarketValueTWD(h, usdTwd);
          return acc;
        }, {});
        const total = Object.values(curr).reduce((s,v) => s + v, 0) || 1;
        const rows = Object.entries(curr).sort((a,b) => b[1]-a[1]);
        const palette = { TWD:'var(--accent)', USD:'var(--warn)' };
        return (
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div className="card-head">
              <div>
                <div className="card-title">幣別分布</div>
                <div className="card-sub">以即時 USD/TWD {usdTwd ? `= ${usdTwd.toFixed(2)}` : '匯率'} 換算</div>
              </div>
              <span className="chip">{rows.length} 種幣別</span>
            </div>
            <div style={{display:'flex', height:10, borderRadius:999, overflow:'hidden', marginBottom:12, background:'var(--bg-3)'}}>
              {rows.map(([c, v]) => (
                <div key={c} title={`${c} · ${fmt.tw(v)}`} style={{width:(v/total*100)+'%', background: palette[c] || 'var(--text-3)'}}/>
              ))}
            </div>
            <div style={{display:'grid', gridTemplateColumns:`repeat(${rows.length}, 1fr)`, gap:14}}>
              {rows.map(([c, v]) => (
                <div key={c}>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:4}}>
                    <span style={{width:8, height:8, borderRadius:2, background: palette[c] || 'var(--text-3)'}}/>
                    <span className="mono-label">{c}</span>
                  </div>
                  <div className="mono" style={{fontSize:16, color:'var(--text-0)'}}>{fmt.tw(v)}</div>
                  <div style={{fontSize:11, color:'var(--text-3)'}}>{(v/total*100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
