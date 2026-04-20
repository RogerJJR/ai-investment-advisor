// AI Advisor page - deep
const REBALANCE_HISTORY_KEY = 'ai-advisor-rebalance-history-v1';

function Advisor({ risk }) {
  const [selectedSlice, setSelectedSlice] = React.useState('債券');
  const [timeframe, setTimeframe] = React.useState('3M');
  const [excluded, setExcluded] = React.useState({});
  const [rebalanceHistory, setRebalanceHistory] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(REBALANCE_HISTORY_KEY) || '[]'); } catch { return []; }
  });

  const [userHoldings, setHoldings] = useHoldings();
  const tickers = [...new Set([...RT.holdingsToTickers(userHoldings), 'TWD=X'])];
  const { quotes, status, refresh } = useLiveQuotes(tickers, { intervalMs: 60000 });
  const holdings = RT.applyQuotesToHoldings(userHoldings, quotes);
  const usdTwd = quotes['TWD=X']?.price;

  const riskTargets = React.useMemo(() => RT.targetsForRisk(DATA.allocation, risk), [risk]);
  const target = RT.computeLiveAllocation(holdings, riskTargets, usdTwd);
  const selected = target.find(a => a.name === selectedSlice) || target[0];
  const diff = selected.target - selected.current;

  const livePlanAll = status === 'live' ? RT.generateRebalancePlan(holdings, target) : DATA.rebalancePlan;
  const livePlan    = livePlanAll.filter(p => !excluded[p.symbol]);
  const totalOut = livePlan.filter(p => p.action === 'sell').reduce((s,p) => s + p.amount, 0);
  const totalIn  = livePlan.filter(p => p.action === 'buy') .reduce((s,p) => s + p.amount, 0);
  const netFlow  = totalIn - totalOut;
  const fee = Math.round((totalIn + totalOut) * 0.001425);

  const applyPlan = () => {
    if (livePlan.length === 0) { toast.info('沒有要套用的調整項目。'); return; }
    if (!confirm(`將套用 ${livePlan.length} 項調整到持股。確定?`)) return;
    const bySymbol = Object.fromEntries(userHoldings.map(h => [h.symbol, h]));
    livePlan.forEach(p => {
      const cur = bySymbol[p.symbol];
      const delta = p.action === 'buy' ? p.shares : -p.shares;
      if (cur) {
        const next = Math.max(0, (cur.shares || 0) + delta);
        bySymbol[p.symbol] = { ...cur, shares: next };
      } else if (p.action === 'buy') {
        const unit = p.amount && p.shares ? p.amount / p.shares : 0;
        bySymbol[p.symbol] = {
          id: 'p' + Date.now().toString(36) + p.symbol,
          symbol: p.symbol, name: p.name,
          type: '其他', sector: '其他',
          shares: p.shares, price: unit, cost: unit, weight: 0,
        };
      }
    });
    setHoldings(Object.values(bySymbol).filter(h => h.shares > 0 || h.symbol === 'CASH'));

    const absDevBefore = target.reduce((s, a) => s + Math.abs(a.current - a.target), 0);
    const snapshot = {
      id: 't' + Date.now().toString(36),
      ts: Date.now(),
      risk,
      items: livePlan.length,
      totalIn, totalOut, netFlow, fee,
      absDeviationBefore: absDevBefore,
      timeframe,
      slices: target.map(a => ({ name: a.name, from: +a.current.toFixed(1), to: a.target })),
      topActions: livePlan.slice(0, 3).map(p => ({ symbol: p.symbol, action: p.action, amount: p.amount })),
    };
    const nextHistory = [snapshot, ...rebalanceHistory].slice(0, 20);
    setRebalanceHistory(nextHistory);
    try { localStorage.setItem(REBALANCE_HISTORY_KEY, JSON.stringify(nextHistory)); } catch {}
    setExcluded({});
    toast.success(`已套用 ${livePlan.length} 項再平衡調整`, '再平衡完成');
  };

  const clearHistory = () => {
    if (!confirm('確定清除所有再平衡歷史紀錄?此動作無法復原。')) return;
    setRebalanceHistory([]);
    try { localStorage.removeItem(REBALANCE_HISTORY_KEY); } catch {}
    toast.info('已清除再平衡歷史紀錄');
  };

  const exportPlan = () => {
    if (livePlanAll.length === 0) { toast.info('目前沒有可匯出的調整項目。'); return; }
    const header = ['symbol','name','action','shares','amount_twd','weight_change_pp','reason'];
    const rows = livePlanAll.map(p => [p.symbol, p.name, p.action, p.shares, p.amount, p.pct, p.reason]);
    const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rebalance-plan-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`已匯出 ${livePlanAll.length} 項調整方案`, '匯出完成');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI 配置建議</h1>
          <p>基於你目前的 {holdings.length} 檔持股、風險偏好「穩健型」、以及 142 筆公開資料來源,AI 生成以下長期配置建議。</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={refresh} title="重新抓取即時行情並重算建議"><Icon name="refresh" size={14}/>重新推論</button>
          <button className="btn" onClick={exportPlan} title="匯出建議為 CSV"><Icon name="download" size={14}/>匯出方案</button>
          <button className="btn primary" onClick={applyPlan} title="依建議更新持股股數"><Icon name="lightning" size={14}/>一鍵套用再平衡</button>
        </div>
      </div>

      {/* Hero - AI Recommendation */}
      <div className="card" style={{background:'linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%)', padding:24, marginBottom:'var(--density-gap)', borderLeft:'2px solid var(--accent)'}}>
        <div style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:28, alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <Donut slices={target.map(a => ({ value: a.target, color: a.color }))} size={160} thick={22}/>
            <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center', textAlign:'center'}}>
              <div>
                <div className="mono-label">建議</div>
                <div style={{fontSize:22, fontFamily:'var(--font-mono)', color:'var(--text-0)'}}>6:2:2</div>
                <div style={{fontSize:10, color:'var(--text-3)'}}>股 / 債 / 另類</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <span className="chip accent"><Icon name="sparkles" size={10}/>AI 結論</span>
              <span style={{fontSize:11, color:'var(--text-3)'}}>模型 v2.4 · 26 秒前完成推論</span>
            </div>
            <h2 style={{margin:'0 0 10px', fontSize:20, fontWeight:500, letterSpacing:'-0.01em', color:'var(--text-0)'}}>
              建議分 3 個月,將配置由 <span className="mono" style={{color:'var(--warn)'}}>65/26/9</span> 漸進調整至 <span className="mono" style={{color:'var(--accent)'}}>60/28/12</span>
            </h2>
            <p style={{margin:0, fontSize:13, color:'var(--text-2)', lineHeight:1.7, maxWidth:720}}>
              在 15 年投資期限與穩健風險偏好下,現階段股票占比略高於合宜區間上緣。同時,美 10Y 殖利率已回升至 4.18%,提供較佳的長期債券進場位置。建議分批將部分台股與美股轉入 BND、IEF、以及全球 ETF,降低集中度。
            </p>
            <div style={{display:'flex', gap:10, marginTop:14, alignItems:'center'}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span className="mono-label">整體信心</span>
                <ConfidenceMeter value={78}/>
                <span className="mono" style={{fontSize:12, color:'var(--text-0)'}}>78%</span>
              </div>
              <span style={{width:1, height:14, background:'var(--line)'}}/>
              <span style={{fontSize:11, color:'var(--text-3)'}}>預估年化報酬 <b className="mono" style={{color:'var(--text-0)'}}>7.2%</b></span>
              <span style={{fontSize:11, color:'var(--text-3)'}}>標準差 <b className="mono" style={{color:'var(--text-0)'}}>10.4%</b></span>
              <span style={{fontSize:11, color:'var(--text-3)'}}>最大回撤 <b className="mono" style={{color:'var(--text-0)'}}>-18%</b></span>
            </div>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            <button className="btn primary" style={{width:160}}><Icon name="check" size={13}/>採納建議</button>
            <button className="btn" style={{width:160}}>自行微調...</button>
            <button className="btn ghost" style={{width:160, color:'var(--text-3)'}}>暫不處理</button>
          </div>
        </div>
      </div>

      {/* Cash buffer recommendation */}
      {(() => {
        let prefs = {};
        try { prefs = JSON.parse(localStorage.getItem('ai-advisor-prefs-v1') || '{}'); } catch {}
        const horizon = Number(prefs.horizon) || 15;
        const monthly = Number(prefs.monthly) || 30000;
        const totalMV = target.reduce((s, a) => s + (a.mv || 0), 0) || RT.totalValueTWD(holdings, usdTwd);
        const riskBuffer = { conservative: 12, moderate: 6, aggressive: 3 }[risk] || 6;
        const recommendedCash = monthly * riskBuffer;
        const cashNow = holdings.filter(h => h.symbol === 'CASH' || h.sector === '現金')
          .reduce((s, h) => s + RT.holdingMarketValueTWD(h, usdTwd), 0);
        const ratioNow  = totalMV > 0 ? (cashNow / totalMV) * 100 : 0;
        const ratioRec  = totalMV > 0 ? (recommendedCash / totalMV) * 100 : 0;
        const gap       = recommendedCash - cashNow;
        const status = Math.abs(gap) < monthly ? 'ok' : gap > 0 ? 'low' : 'high';
        const statusColor = status === 'ok' ? 'var(--pos)' : status === 'low' ? 'var(--warn)' : 'var(--accent)';
        const statusLabel = status === 'ok' ? '現金部位適中' : status === 'low' ? '現金緩衝偏低' : '現金部位偏高';
        const rationale = status === 'ok'
          ? `目前現金約當 ${riskBuffer - 0.5}~${riskBuffer + 0.5} 個月月定投,屬合理區間。`
          : status === 'low'
            ? `建議補足至約 ${riskBuffer} 個月的月定投金額,以因應短期市場波動或突發支出需求。`
            : `現金占比較高,長期而言機會成本上升,可考慮分批投入核心配置以加快資產累積。`;
        return (
          <div className="card" style={{marginBottom:'var(--density-gap)', borderLeft:`2px solid ${statusColor}`}}>
            <div className="card-head">
              <div>
                <div className="card-title">現金緩衝建議</div>
                <div className="card-sub">考量你的風險等級 · 月定投 {fmt.tw(monthly)} · 投資期限 {horizon} 年</div>
              </div>
              <span className="chip" style={{color:statusColor, borderColor:statusColor}}>
                <span className="dot" style={{background:statusColor}}/>{statusLabel}
              </span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginBottom:12}}>
              <div>
                <div className="mono-label">目前現金部位</div>
                <div className="mono" style={{fontSize:18, color:'var(--text-0)', marginTop:4}}>{fmt.tw(cashNow)}</div>
                <div style={{fontSize:10, color:'var(--text-3)', marginTop:2}}>占總資產 {ratioNow.toFixed(1)}%</div>
              </div>
              <div>
                <div className="mono-label">建議現金部位</div>
                <div className="mono" style={{fontSize:18, color:'var(--accent)', marginTop:4}}>{fmt.tw(recommendedCash)}</div>
                <div style={{fontSize:10, color:'var(--text-3)', marginTop:2}}>約 {riskBuffer} 個月月定投 · {ratioRec.toFixed(1)}%</div>
              </div>
              <div>
                <div className="mono-label">{gap >= 0 ? '建議補足' : '建議釋出'}</div>
                <div className="mono" style={{fontSize:18, color: gap >= 0 ? 'var(--warn)' : 'var(--accent)', marginTop:4}}>
                  {gap >= 0 ? '+' : '-'}{fmt.tw(Math.abs(gap))}
                </div>
                <div style={{fontSize:10, color:'var(--text-3)', marginTop:2}}>差 {Math.abs(ratioRec - ratioNow).toFixed(1)}pp</div>
              </div>
              <div>
                <div className="mono-label">依風險等級</div>
                <div className="mono" style={{fontSize:14, color:'var(--text-0)', marginTop:4}}>
                  {{ conservative:'保守 12 個月', moderate:'穩健 6 個月', aggressive:'積極 3 個月' }[risk] || '穩健 6 個月'}
                </div>
                <div style={{fontSize:10, color:'var(--text-3)', marginTop:2}}>對應月定投倍數</div>
              </div>
            </div>
            <div style={{fontSize:11.5, color:'var(--text-2)', lineHeight:1.65, padding:'10px 12px', background:'var(--bg-2)', borderRadius:'var(--radius)'}}>
              {rationale}
            </div>
          </div>
        );
      })()}

      {/* Deviation map */}
      {(() => {
        const MAX_SCALE = Math.max(60, ...target.map(a => Math.max(a.current, a.target)) );
        const aligned  = target.filter(a => Math.abs(a.current - a.target) < 2).length;
        const minor    = target.filter(a => { const d = Math.abs(a.current - a.target); return d >= 2 && d < 5; }).length;
        const major    = target.filter(a => Math.abs(a.current - a.target) >= 5).length;
        const absDev   = target.reduce((s,a) => s + Math.abs(a.current - a.target), 0);
        return (
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div className="card-head">
              <div>
                <div className="card-title">配置偏離地圖</div>
                <div className="card-sub">每一列:目前比例(色塊)與建議目標(▼ 標記)的距離一目了然</div>
              </div>
              <div style={{display:'flex', gap:14, alignItems:'center', fontSize:11}}>
                <span style={{color:'var(--text-3)'}}>對齊 <b className="mono" style={{color:'var(--pos)'}}>{aligned}</b></span>
                <span style={{color:'var(--text-3)'}}>輕微 <b className="mono" style={{color:'var(--warn)'}}>{minor}</b></span>
                <span style={{color:'var(--text-3)'}}>明顯 <b className="mono" style={{color:'var(--neg)'}}>{major}</b></span>
                <span style={{width:1, height:12, background:'var(--line)'}}/>
                <span style={{color:'var(--text-3)'}}>總偏離 <b className="mono" style={{color:'var(--text-0)'}}>{absDev.toFixed(1)}pp</b></span>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {target.map(a => {
                const d = a.target - a.current;
                const absD = Math.abs(d);
                const severity = absD < 2 ? 'aligned' : absD < 5 ? 'minor' : 'major';
                const sevColor = { aligned:'var(--pos)', minor:'var(--warn)', major:'var(--neg)' }[severity];
                const sevLabel = { aligned:'對齊', minor:'輕微偏離', major:'明顯偏離' }[severity];
                const action = d > 0.5 ? '建議加碼' : d < -0.5 ? '建議減碼' : '維持';
                const actionColor = d > 0.5 ? 'var(--pos)' : d < -0.5 ? 'var(--neg)' : 'var(--text-2)';
                return (
                  <div key={a.name}
                       onClick={() => setSelectedSlice(a.name)}
                       style={{
                         display:'grid', gridTemplateColumns:'110px 1fr 90px 90px', gap:14,
                         alignItems:'center', padding:'10px 12px',
                         border:'1px solid ' + (selectedSlice === a.name ? 'var(--accent)' : 'var(--line)'),
                         background: selectedSlice === a.name ? 'var(--accent-soft-2)' : 'var(--bg-2)',
                         borderRadius:'var(--radius)', cursor:'pointer',
                       }}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{width:10, height:10, borderRadius:2, background:a.color}}/>
                      <span style={{fontSize:12, color:'var(--text-0)', fontWeight:500}}>{a.name}</span>
                    </div>
                    <div style={{position:'relative', height:18}}>
                      <div style={{position:'absolute', inset:'7px 0', background:'var(--bg-3)', borderRadius:999}}/>
                      <div style={{
                        position:'absolute', left:0, top:7, bottom:7,
                        width:(a.current / MAX_SCALE * 100)+'%',
                        background:a.color, borderRadius:999, opacity:0.85,
                      }}/>
                      <div title={`目標 ${a.target}%`} style={{
                        position:'absolute', left:`calc(${a.target / MAX_SCALE * 100}% - 5px)`,
                        top:-1, fontSize:10, color:sevColor, lineHeight:1,
                      }}>▼</div>
                      <div style={{
                        position:'absolute', left:`${a.target / MAX_SCALE * 100}%`,
                        top:8, bottom:0, width:1, background:sevColor,
                      }}/>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                      <div className="mono" style={{fontSize:13, color:'var(--text-0)'}}>
                        {a.current.toFixed(1)}% <span style={{color:'var(--text-3)', fontSize:10}}>/ {a.target}%</span>
                      </div>
                      <div className="mono" style={{fontSize:10, color: d>0?'var(--pos)':d<0?'var(--neg)':'var(--text-3)'}}>
                        {d>=0?'+':''}{d.toFixed(1)}pp
                      </div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                      <span style={{
                        fontSize:9, padding:'1px 6px', borderRadius:3, letterSpacing:'0.04em',
                        background: severity === 'aligned' ? 'var(--pos-soft)' : severity === 'minor' ? 'var(--warn-soft)' : 'var(--neg-soft)',
                        color: sevColor,
                      }}>{sevLabel}</span>
                      <span style={{fontSize:10, color:actionColor, fontWeight:500}}>{action}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 3 columns: allocation interactive, rationale, factors */}
      <div style={{display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        {/* Allocation breakdown */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">配置細項 · 點擊類別查看推理</div>
              <div className="card-sub">左:目前 · 右:建議 · 色塊寬度 = 比例</div>
            </div>
          </div>

          <table className="tbl">
            <thead>
              <tr><th>資產類別</th><th className="num">現況</th><th></th><th className="num">建議</th><th className="num">調整</th></tr>
            </thead>
            <tbody>
              {target.map(a => {
                const d = a.target - a.current;
                const sel = selectedSlice === a.name;
                return (
                  <tr key={a.name} onClick={()=>setSelectedSlice(a.name)} style={{cursor:'pointer', background: sel ? 'var(--accent-soft-2)' : undefined}}>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{width:10, height:10, borderRadius:2, background:a.color}}/>
                        <span style={{color:'var(--text-0)', fontWeight: sel?500:400}}>{a.name}</span>
                      </div>
                    </td>
                    <td className="num">{a.current.toFixed(1)}%</td>
                    <td style={{width:120}}>
                      <div style={{display:'flex', alignItems:'center', gap:4}}>
                        <div style={{flex:1, height:3, background:'var(--bg-3)', borderRadius:999, position:'relative'}}>
                          <div style={{position:'absolute', left:0, top:0, bottom:0, width:a.current*2+'%', background:a.color, borderRadius:999, opacity:0.6}}/>
                          <div style={{position:'absolute', left: a.target*2+'%', top:-3, width:2, height:9, background:a.color}}/>
                        </div>
                      </div>
                    </td>
                    <td className="num">{a.target}%</td>
                    <td className="num" style={{color: d>0?'var(--pos)':d<0?'var(--neg)':'var(--text-3)'}}>{d>0?'+':''}{d.toFixed(1)}pp</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Reasoning */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">推理過程 · {selectedSlice}</div>
              <div className="card-sub">AI 如何得到這個結論 · 資料 → 因子 → 結論</div>
            </div>
            <span className="chip accent"><Icon name="sparkles" size={10}/>信心 82%</span>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:0}}>
            {[
              { step:'觀察', text:'你目前債券配置為 13.0%,低於長期穩健型目標 20%,差距 -7.0pp。', sources:['持股', 'DGBAS'] },
              { step:'資料', text:'美 10Y 殖利率近 30 天 +22bps 至 4.18%,BND/IEF 價格相對 2024 年高點回落 4.6%。', sources:['CBOE','Fed'] },
              { step:'因子', text:'利率上行 → 債券殖利率上升 → 長期進場風險報酬比提升。你的投資期限 15 年,足以承受短期波動。', sources:['模型'] },
              { step:'結論', text:'建議分 3 次(12 週)加碼 BND (60%) + IEF (40%),總額約 NT$186,000。', sources:[] },
            ].map((r, i, arr) => (
              <div key={i} style={{display:'flex', gap:14, position:'relative', paddingBottom: i < arr.length - 1 ? 14 : 0}}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                  <div style={{width:24, height:24, borderRadius:'50%', background:'var(--accent-soft)', color:'var(--accent)', display:'grid', placeItems:'center', fontSize:10, fontWeight:600}}>{i+1}</div>
                  {i < arr.length - 1 && <div style={{flex:1, width:1, background:'var(--line)', minHeight:20, marginTop:4}}/>}
                </div>
                <div style={{flex:1, paddingTop:2, paddingBottom:10}}>
                  <div className="mono-label" style={{marginBottom:4}}>{r.step}</div>
                  <div style={{fontSize:12, color:'var(--text-1)', lineHeight:1.6}}>{r.text}</div>
                  {r.sources.length > 0 && (
                    <div style={{display:'flex', gap:4, marginTop:6, flexWrap:'wrap'}}>
                      {r.sources.map(s => <span key={s} className="source">{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Proposed orders */}
      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
        <div className="card-head">
          <div>
            <div className="card-title">建議執行清單</div>
            <div className="card-sub">分 3 個月執行;點擊可調整數量或排除項目</div>
          </div>
          <div className="seg">
            {['1M','3M','6M'].map(t => (
              <button key={t} className={timeframe===t?'active':''} onClick={()=>setTimeframe(t)}>{t} 分批</button>
            ))}
          </div>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>標的</th><th>動作</th>
              <th className="num">建議股數</th>
              <th className="num">預估金額</th>
              <th className="num">權重變化</th>
              <th>理由</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {livePlan.length === 0 && (
              <tr><td colSpan={7} style={{textAlign:'center', padding:24, color:'var(--text-3)'}}>目前配置與目標偏離小於 2pp,不建議調整。</td></tr>
            )}
            {livePlan.map(p => {
              const isBuy = p.action === 'buy';
              return (
                <tr key={p.symbol}>
                  <td>
                    <div style={{display:'flex', flexDirection:'column'}}>
                      <span className="mono" style={{fontSize:12}}>{p.symbol}</span>
                      <span style={{fontSize:11, color:'var(--text-3)'}}>{p.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="chip" style={{background: isBuy?'var(--pos-soft)':'var(--neg-soft)', color:isBuy?'var(--pos)':'var(--neg)', borderColor:'transparent'}}>
                      <Icon name={isBuy?'arrow-up':'arrow-down'} size={10}/> {isBuy?'加碼':'減碼'}
                    </span>
                  </td>
                  <td className="num">{p.shares}</td>
                  <td className="num">{fmt.tw(p.amount)}</td>
                  <td className="num" style={{color: p.pct>0?'var(--pos)':'var(--neg)'}}>{fmt.pct(p.pct)}</td>
                  <td style={{fontSize:12, color:'var(--text-2)'}}>{p.reason}</td>
                  <td>
                    <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                      <button className="icon-btn" style={{width:26, height:26}} title="排除此項" onClick={() => setExcluded({...excluded, [p.symbol]: true})}><Icon name="close" size={11}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, padding:'12px 14px', background:'var(--bg-2)', borderRadius:'var(--radius)'}}>
          <div style={{display:'flex', gap:24}}>
            <div>
              <div className="mono-label">總出金</div>
              <div className="mono" style={{fontSize:16, color:'var(--neg)'}}>-{fmt.tw(totalOut)}</div>
            </div>
            <div>
              <div className="mono-label">總入金</div>
              <div className="mono" style={{fontSize:16, color:'var(--pos)'}}>+{fmt.tw(totalIn)}</div>
            </div>
            <div>
              <div className="mono-label">{netFlow >= 0 ? '淨支出' : '淨回收'}</div>
              <div className="mono" style={{fontSize:16, color:'var(--text-0)'}}>{fmt.tw(Math.abs(netFlow))}</div>
            </div>
            <div>
              <div className="mono-label">預估手續費</div>
              <div className="mono" style={{fontSize:16, color:'var(--text-2)'}}>{fmt.tw(fee)}</div>
            </div>
          </div>
          <button className="btn primary" onClick={applyPlan}><Icon name="check" size={13}/>套用此方案</button>
        </div>
      </div>

      {/* Tranche scheduler */}
      {livePlan.length > 0 && (() => {
        const tranches = { '1M': 1, '3M': 3, '6M': 6 }[timeframe] || 3;
        const now = new Date();
        const monthLabel = (offset) => {
          const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
          return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        };
        const schedule = Array.from({ length: tranches }, (_, i) => {
          const share = 1 / tranches;
          const items = livePlan.map(p => ({
            symbol: p.symbol,
            action: p.action,
            shares: Math.max(1, Math.round(p.shares * share)),
            amount: Math.round(p.amount * share),
          }));
          const subIn  = items.filter(x => x.action === 'buy') .reduce((s,x) => s + x.amount, 0);
          const subOut = items.filter(x => x.action === 'sell').reduce((s,x) => s + x.amount, 0);
          return { label: monthLabel(i), items, subIn, subOut };
        });
        return (
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div className="card-head">
              <div>
                <div className="card-title">分批執行排程 · {timeframe}</div>
                <div className="card-sub">把總調整金額平均分成 {tranches} 批,在未來 {tranches} 個月逐月執行,可攤平進場成本與情緒風險</div>
              </div>
              <span className="chip accent">每期約 {fmt.tw((totalIn + totalOut) / tranches)}</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:`repeat(${tranches}, 1fr)`, gap:10}}>
              {schedule.map((t, idx) => (
                <div key={idx} style={{
                  padding:12, borderRadius:'var(--radius)', background:'var(--bg-2)',
                  borderLeft: `2px solid ${idx === 0 ? 'var(--accent)' : 'var(--text-3)'}`,
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
                    <span className="mono-label" style={{color: idx === 0 ? 'var(--accent)' : 'var(--text-3)'}}>{idx === 0 ? '本月 · 第 1 期' : `第 ${idx + 1} 期`}</span>
                    <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>{t.label}</span>
                  </div>
                  <div style={{display:'flex', gap:10, fontSize:11, marginBottom:8}}>
                    <span style={{color:'var(--neg)'}}>-{fmt.tw(t.subOut)}</span>
                    <span style={{color:'var(--pos)'}}>+{fmt.tw(t.subIn)}</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:4}}>
                    {t.items.map((x, j) => (
                      <div key={j} style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-2)'}}>
                        <span>
                          <span className="mono" style={{fontSize:10, padding:'0 4px', borderRadius:2,
                            background: x.action==='buy'?'var(--pos-soft)':'var(--neg-soft)',
                            color: x.action==='buy'?'var(--pos)':'var(--neg)', marginRight:4,
                          }}>{x.action==='buy'?'買':'賣'}</span>
                          {x.symbol}
                        </span>
                        <span className="mono" style={{color:'var(--text-3)'}}>{x.shares} 股</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11, color:'var(--text-3)', marginTop:10, lineHeight:1.6}}>
              「套用此方案」目前會一次執行全部數量;若想分批,建議每月手動執行一次本期建議,並在下個月點「重新推論」更新下一期數量。
            </div>
          </div>
        );
      })()}

      {/* Rebalance history */}
      {rebalanceHistory.length > 0 && (
        <div className="card" style={{marginBottom:'var(--density-gap)'}}>
          <div className="card-head">
            <div>
              <div className="card-title">再平衡歷史</div>
              <div className="card-sub">每次套用方案後自動保存 · 保留最近 20 筆 · 僅儲存於本機瀏覽器</div>
            </div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <span className="chip">{rebalanceHistory.length} 筆紀錄</span>
              <button className="btn ghost" style={{height:28, fontSize:11, color:'var(--neg)'}} onClick={clearHistory}>
                <Icon name="trash" size={11}/>清除
              </button>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {rebalanceHistory.slice(0, 8).map(s => {
              const d = new Date(s.ts);
              const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
              const riskLabel = { conservative:'保守', moderate:'穩健', aggressive:'積極' }[s.risk] || s.risk;
              return (
                <div key={s.id} style={{
                  display:'grid', gridTemplateColumns:'150px 80px 1fr 1fr 1fr', gap:14, alignItems:'center',
                  padding:'10px 12px', background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--line)',
                }}>
                  <div>
                    <div style={{fontSize:11, color:'var(--text-3)'}}>{dateStr}</div>
                    <div style={{fontSize:11, color:'var(--text-1)', marginTop:2}}>{riskLabel} · {s.timeframe || '3M'}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div className="mono" style={{fontSize:16, color:'var(--accent)'}}>{s.items}</div>
                    <div style={{fontSize:10, color:'var(--text-3)'}}>項調整</div>
                  </div>
                  <div>
                    <div className="mono-label">出/入金</div>
                    <div className="mono" style={{fontSize:11, marginTop:2}}>
                      <span style={{color:'var(--neg)'}}>-{fmt.tw(s.totalOut || 0)}</span>
                      <span style={{color:'var(--text-3)', margin:'0 4px'}}>/</span>
                      <span style={{color:'var(--pos)'}}>+{fmt.tw(s.totalIn || 0)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="mono-label">淨流 / 手續費</div>
                    <div className="mono" style={{fontSize:11, color:'var(--text-0)', marginTop:2}}>
                      {fmt.tw(Math.abs(s.netFlow || 0))} · 費 {fmt.tw(s.fee || 0)}
                    </div>
                  </div>
                  <div style={{fontSize:11, color:'var(--text-2)'}}>
                    {s.topActions && s.topActions.length > 0 ? (
                      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                        {s.topActions.map((a, i) => (
                          <span key={i} className="mono" style={{fontSize:10, padding:'1px 6px', borderRadius:3,
                            background: a.action==='buy'?'var(--pos-soft)':'var(--neg-soft)',
                            color: a.action==='buy'?'var(--pos)':'var(--neg)',
                          }}>{a.action==='buy'?'買':'賣'} {a.symbol}</span>
                        ))}
                      </div>
                    ) : <span style={{color:'var(--text-3)'}}>—</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {rebalanceHistory.length > 8 && (
            <div style={{textAlign:'center', fontSize:11, color:'var(--text-3)', marginTop:10}}>還有 {rebalanceHistory.length - 8} 筆較舊紀錄</div>
          )}
        </div>
      )}

      {/* Factor grid */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">決策因子 · 權重分布</div>
            <div className="card-sub">AI 在此次配置建議中各因子的影響力</div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14}}>
          {[
            { name:'總經環境', w:28, note:'利率上行、CPI 趨穩' },
            { name:'估值水位', w:22, note:'S&P 本益比 21.4 偏高' },
            { name:'技術面',   w:12, note:'台股 MACD 背離' },
            { name:'集中度',   w:18, note:'台股權重 +8.6pp' },
            { name:'情緒',     w: 6, note:'AAII 看多 28%' },
            { name:'央行政策', w:10, note:'Fed data-dependent' },
            { name:'相關性',   w: 4, note:'股債相關正向' },
            { name:'其他',     w: 0, note:'—' },
          ].map(f => (
            <div key={f.name} style={{padding:12, border:'1px solid var(--line)', borderRadius:'var(--radius)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                <span style={{fontSize:12, color:'var(--text-1)'}}>{f.name}</span>
                <span className="mono" style={{fontSize:13, color:'var(--text-0)'}}>{f.w}%</span>
              </div>
              <div className="bar" style={{margin:'8px 0 6px'}}><span style={{width:f.w*3+'%', background: f.w>=20?'var(--accent)':'var(--text-3)'}}/></div>
              <div style={{fontSize:10, color:'var(--text-3)'}}>{f.note}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

window.Advisor = Advisor;
