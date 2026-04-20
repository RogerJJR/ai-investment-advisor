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

const BT_TICKER_LABEL = {
  'VTI':    '美股整體',
  '0050.TW':'台股 50',
  'VT':     '全球股',
  'BND':    '美國綜合債',
  'GLD':    '黃金',
};

function rollingCAGR(annual, window) {
  if (annual.length < window) return [];
  const out = [];
  for (let i = window - 1; i < annual.length; i++) {
    let prod = 1;
    for (let j = i - window + 1; j <= i; j++) prod *= 1 + (annual[j].ret / 100);
    out.push({ year: annual[i].year, ret: (Math.pow(prod, 1 / window) - 1) * 100 });
  }
  return out;
}

function Backtest() {
  const [preset, setPreset] = React.useState('AI 建議');
  const [excluded, setExcluded] = React.useState(() => new Set());
  const [rangeYears, setRangeYears] = React.useState(10); // 3 | 5 | 10 | 0(all)
  const [rollWindow, setRollWindow] = React.useState(3); // 3 | 5
  const tickers = [...new Set([...Object.keys(BT_WEIGHTS), ...Object.keys(BT_BENCHMARK)])];
  const { history, status, error } = useLiveHistory(tickers, { range: '10y', interval: '1mo' });

  const effectiveWeights = React.useMemo(() => {
    const active = Object.entries(BT_WEIGHTS).filter(([t]) => !excluded.has(t));
    const total = active.reduce((s, [, w]) => s + w, 0) || 1;
    return Object.fromEntries(active.map(([t, w]) => [t, w / total]));
  }, [excluded]);

  const clipRange = (annual) => (rangeYears > 0 && annual.length > rangeYears) ? annual.slice(-rangeYears) : annual;
  const aiAnnual    = clipRange(computePortfolioAnnual(history, effectiveWeights));
  const benchAnnual = clipRange(computePortfolioAnnual(history, BT_BENCHMARK));
  const aiStats    = computeStats(aiAnnual);
  const benchStats = computeStats(benchAnnual);

  const toggleTicker = (t) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      if (next.size === Object.keys(BT_WEIGHTS).length) {
        toast.error('至少需要保留一檔標的');
        return prev;
      }
      return next;
    });
  };

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
          <div className="seg" title="回測期間(從最新的那一年往回推)">
            {[
              { y: 3,  label: '3 年' },
              { y: 5,  label: '5 年' },
              { y: 10, label: '10 年' },
              { y: 0,  label: '全部' },
            ].map(r => (
              <button key={r.y} className={rangeYears===r.y?'active':''} onClick={()=>setRangeYears(r.y)}>{r.label}</button>
            ))}
          </div>
          <button className="btn"><Icon name="download" size={14}/>匯出報告</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'var(--density-gap)', marginBottom:'var(--density-gap)'}}>
        {(isLive ? [
          { label:`${bt.years.length} 年總報酬`, v: stats.totalRet, b: benchStats?.totalRet, unit:'%', c: stats.totalRet>=0?'var(--pos)':'var(--neg)' },
          { label:'年化報酬 (CAGR)',           v: stats.cagr,     b: benchStats?.cagr,     unit:'%', c:'var(--text-0)' },
          { label:'最大回撤',                  v: stats.maxDD,    b: benchStats?.maxDD,    unit:'%', c:'var(--neg)' },
          { label:'夏普比 (rf=2%)',             v: stats.sharpe,   b: benchStats?.sharpe,   unit:'',  c:'var(--text-0)' },
          { label:'勝率 / 年',                  v: stats.winRate,  b: benchStats?.winRate,  unit:'%', c:'var(--pos)' },
        ] : [
          { label:'10 年總報酬', v:142, b:102, unit:'%', c:'var(--pos)' },
          { label:'年化報酬',    v:9.2, b:7.1, unit:'%', c:'var(--text-0)' },
          { label:'最大回撤',    v:-18.4, b:-22.1, unit:'%', c:'var(--neg)' },
          { label:'夏普比',      v:0.72, b:0.58, unit:'', c:'var(--text-0)' },
          { label:'勝率 / 年',    v:80,  b:70, unit:'%', c:'var(--pos)' },
        ]).map(k => {
          const fmtN = (x) => x == null ? '—' : (k.unit === '%' ? (x>=0?'+':'') + x.toFixed(1) + '%' : x.toFixed(2));
          const delta = (k.v != null && k.b != null) ? (k.v - k.b) : null;
          return (
            <div key={k.label} className="card">
              <div className="kpi-label">{k.label}</div>
              <div className="mono" style={{fontSize:22, marginTop:6, color:k.c}}>{fmtN(k.v)}</div>
              <div style={{fontSize:11, color:'var(--text-3)', marginTop:4}}>
                基準 60/40: <span className="mono" style={{color:'var(--text-2)'}}>{fmtN(k.b)}</span>
                {delta != null && <span className="mono" style={{marginLeft:6, color: delta>=0?'var(--pos)':'var(--neg)'}}>
                  {delta>=0?'+':''}{k.unit==='%' ? delta.toFixed(1)+'pp' : delta.toFixed(2)}
                </span>}
              </div>
            </div>
          );
        })}
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

      {/* Rolling annualized returns */}
      {isLive && (() => {
        const rollAI    = rollingCAGR(aiAnnual, rollWindow);
        const rollBench = rollingCAGR(benchAnnual, rollWindow);
        if (rollAI.length === 0) return null;
        const beats = rollAI.filter((r, i) => rollBench[i] && r.ret >= rollBench[i].ret).length;
        const winPct = (beats / rollAI.length) * 100;
        const maxAbs = Math.max(1, ...rollAI.map(r => Math.abs(r.ret)), ...rollBench.map(r => Math.abs(r.ret)));
        return (
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div className="card-head">
              <div>
                <div className="card-title">滾動 {rollWindow} 年化報酬</div>
                <div className="card-sub">每個年份代表「截至當年為止的前 {rollWindow} 年」複利年化報酬 · AI 勝出基準 {beats}/{rollAI.length} 年 ({winPct.toFixed(0)}%)</div>
              </div>
              <div className="seg">
                {[3, 5].map(w => (
                  <button key={w} className={rollWindow===w?'active':''} onClick={()=>setRollWindow(w)} disabled={aiAnnual.length < w}>{w} 年視窗</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {rollAI.map((r, i) => {
                const b = rollBench[i]?.ret ?? 0;
                const aiPct = (Math.abs(r.ret) / maxAbs) * 50;
                const bPct  = (Math.abs(b)     / maxAbs) * 50;
                const winAI = r.ret >= b;
                return (
                  <div key={r.year} style={{display:'grid', gridTemplateColumns:'50px 1fr 70px 70px 60px', gap:10, alignItems:'center', padding:'4px 0'}}>
                    <span className="mono" style={{fontSize:11, color:'var(--text-2)'}}>{r.year}</span>
                    <div style={{position:'relative', height:18}}>
                      <div style={{position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'var(--line-2)'}}/>
                      <div title={`AI ${r.ret.toFixed(1)}%`} style={{
                        position:'absolute', top:2, height:6,
                        ...(r.ret >= 0
                          ? { left:'50%', width: aiPct + '%' }
                          : { right:'50%', width: aiPct + '%' }),
                        background:'var(--accent)', borderRadius:3,
                      }}/>
                      <div title={`基準 ${b.toFixed(1)}%`} style={{
                        position:'absolute', bottom:2, height:6,
                        ...(b >= 0
                          ? { left:'50%', width: bPct + '%' }
                          : { right:'50%', width: bPct + '%' }),
                        background:'var(--text-3)', borderRadius:3, opacity:0.75,
                      }}/>
                    </div>
                    <span className="mono" style={{fontSize:11, textAlign:'right', color: r.ret >= 0 ? 'var(--pos)' : 'var(--neg)'}}>{r.ret >= 0 ? '+' : ''}{r.ret.toFixed(1)}%</span>
                    <span className="mono" style={{fontSize:11, textAlign:'right', color:'var(--text-3)'}}>{b >= 0 ? '+' : ''}{b.toFixed(1)}%</span>
                    <span className="mono" style={{fontSize:10, textAlign:'right', color: winAI ? 'var(--pos)' : 'var(--neg)'}}>
                      {winAI ? '贏' : '輸'} {Math.abs(r.ret - b).toFixed(1)}pp
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex', gap:14, marginTop:12, fontSize:11, color:'var(--text-3)'}}>
              <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
                <span style={{width:12, height:6, background:'var(--accent)', borderRadius:2}}/>AI 建議
              </span>
              <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
                <span style={{width:12, height:6, background:'var(--text-3)', borderRadius:2, opacity:0.75}}/>基準 60/40
              </span>
            </div>
          </div>
        );
      })()}

      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
        <div className="card-head">
          <div>
            <div className="card-title">AI 建議成分</div>
            <div className="card-sub">勾選可加入回測,取消則權重自動歸一化分配到其餘標的</div>
          </div>
          <div style={{fontSize:11, color:'var(--text-3)'}}>
            啟用 <b className="mono" style={{color:'var(--text-1)'}}>{Object.keys(effectiveWeights).length}</b> / {Object.keys(BT_WEIGHTS).length} 檔
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10}}>
          {Object.entries(BT_WEIGHTS).map(([t, baseW]) => {
            const on = !excluded.has(t);
            const effW = effectiveWeights[t] ?? 0;
            const hasData = !!history[t];
            return (
              <label key={t}
                     style={{
                       display:'flex', alignItems:'center', gap:10, padding:10,
                       border:'1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                       borderRadius:'var(--radius)',
                       background: on ? 'var(--accent-soft-2)' : 'var(--bg-2)',
                       cursor:'pointer', opacity: hasData ? 1 : 0.55,
                     }}>
                <input type="checkbox" checked={on} onChange={() => toggleTicker(t)}
                       style={{accentColor:'var(--accent)', width:14, height:14}}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                    <span className="mono" style={{fontSize:12, color:'var(--text-0)', fontWeight:500}}>{t}</span>
                    <span className="mono" style={{fontSize:11, color: on ? 'var(--accent)' : 'var(--text-3)'}}>
                      {on ? (effW * 100).toFixed(0) + '%' : '—'}
                    </span>
                  </div>
                  <div style={{fontSize:10, color:'var(--text-3)', marginTop:2, display:'flex', justifyContent:'space-between'}}>
                    <span>{BT_TICKER_LABEL[t] || t}</span>
                    <span>原 {(baseW * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        {excluded.size > 0 && (
          <div style={{marginTop:12, display:'flex', justifyContent:'flex-end'}}>
            <button className="btn" onClick={() => setExcluded(new Set())}>
              <Icon name="refresh" size={12}/>重設為完整組合
            </button>
          </div>
        )}
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

      {/* DCA vs Lump-sum */}
      {isLive && aiAnnual.length >= 2 && (() => {
        let prefs = {};
        try { prefs = JSON.parse(localStorage.getItem('ai-advisor-prefs-v1') || '{}'); } catch {}
        const monthly = Number(prefs.monthly) || 30000;
        const years = aiAnnual.length;
        const annual = monthly * 12;
        const totalInvested = annual * years;

        // DCA: contribute 'annual' at the start of each year, grow by that year's return
        let dcaValue = 0;
        const dcaPath = [];
        aiAnnual.forEach(a => {
          dcaValue = (dcaValue + annual) * (1 + a.ret / 100);
          dcaPath.push(dcaValue);
        });

        // Lump-sum: invest totalInvested at start of year 1, grow each year
        let lsValue = totalInvested;
        const lsPath = [];
        aiAnnual.forEach(a => {
          lsValue = lsValue * (1 + a.ret / 100);
          lsPath.push(lsValue);
        });

        const dcaFinal = dcaPath[dcaPath.length - 1];
        const lsFinal  = lsPath[lsPath.length - 1];
        const dcaGain = dcaFinal - totalInvested;
        const lsGain  = lsFinal  - totalInvested;
        const winner  = lsFinal > dcaFinal ? 'LS' : 'DCA';
        const gap = Math.abs(lsFinal - dcaFinal);
        const maxPath = Math.max(...dcaPath, ...lsPath);

        return (
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div className="card-head">
              <div>
                <div className="card-title">定期定額 vs 一次投入</div>
                <div className="card-sub">以月定投 {fmt.tw(monthly)} (設定頁)、{years} 年、AI 建議配置模擬 · 兩者總投入皆為 {fmt.tw(totalInvested)}</div>
              </div>
              <span className="chip" style={{color: winner==='LS'?'var(--accent)':'var(--pos)'}}>
                {winner==='LS' ? '一次投入勝' : '定期定額勝'} · 差 {fmt.tw(gap)}
              </span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14}}>
              <div style={{padding:12, borderRadius:'var(--radius)', background:'var(--bg-2)', borderLeft:`2px solid ${winner==='DCA'?'var(--pos)':'var(--text-3)'}`}}>
                <div className="mono-label">定期定額 (DCA)</div>
                <div className="mono" style={{fontSize:22, color:'var(--text-0)', marginTop:4}}>{fmt.tw(dcaFinal)}</div>
                <div style={{fontSize:11, color: dcaGain>=0?'var(--pos)':'var(--neg)', marginTop:2}}>
                  收益 {dcaGain>=0?'+':''}{fmt.tw(dcaGain)} ({((dcaGain/totalInvested)*100).toFixed(1)}%)
                </div>
                <div style={{fontSize:10, color:'var(--text-3)', marginTop:4}}>每年年初投入 {fmt.tw(annual)}</div>
              </div>
              <div style={{padding:12, borderRadius:'var(--radius)', background:'var(--bg-2)', borderLeft:`2px solid ${winner==='LS'?'var(--accent)':'var(--text-3)'}`}}>
                <div className="mono-label">一次投入 (Lump Sum)</div>
                <div className="mono" style={{fontSize:22, color:'var(--text-0)', marginTop:4}}>{fmt.tw(lsFinal)}</div>
                <div style={{fontSize:11, color: lsGain>=0?'var(--pos)':'var(--neg)', marginTop:2}}>
                  收益 {lsGain>=0?'+':''}{fmt.tw(lsGain)} ({((lsGain/totalInvested)*100).toFixed(1)}%)
                </div>
                <div style={{fontSize:10, color:'var(--text-3)', marginTop:4}}>首年一次性投入 {fmt.tw(totalInvested)}</div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {aiAnnual.map((a, i) => {
                const dcaPct = (dcaPath[i] / maxPath) * 100;
                const lsPct  = (lsPath[i]  / maxPath) * 100;
                return (
                  <div key={a.year} style={{display:'grid', gridTemplateColumns:'50px 1fr 110px 110px', gap:10, alignItems:'center', fontSize:11}}>
                    <span className="mono" style={{color:'var(--text-2)'}}>{a.year}</span>
                    <div style={{position:'relative', height:14}}>
                      <div title={`DCA ${fmt.tw(dcaPath[i])}`} style={{position:'absolute', left:0, top:0, height:6, width:dcaPct+'%', background:'var(--pos)', borderRadius:2, opacity:0.85}}/>
                      <div title={`LS ${fmt.tw(lsPath[i])}`}   style={{position:'absolute', left:0, top:8, height:6, width:lsPct+'%',  background:'var(--accent)', borderRadius:2, opacity:0.85}}/>
                    </div>
                    <span className="mono" style={{textAlign:'right', color:'var(--text-1)'}}>{fmt.tw(dcaPath[i])}</span>
                    <span className="mono" style={{textAlign:'right', color:'var(--text-1)'}}>{fmt.tw(lsPath[i])}</span>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex', gap:14, marginTop:10, fontSize:11, color:'var(--text-3)'}}>
              <span style={{display:'inline-flex', alignItems:'center', gap:5}}><span style={{width:12, height:6, background:'var(--pos)', borderRadius:2}}/>DCA 年末資產</span>
              <span style={{display:'inline-flex', alignItems:'center', gap:5}}><span style={{width:12, height:6, background:'var(--accent)', borderRadius:2}}/>LS 年末資產</span>
              <span style={{marginLeft:'auto'}}>{winner==='LS' ? '上漲市場通常一次投入領先;' : '震盪或先跌後漲時定期定額較穩健;'}實際決策請依資金流與風險承受度。</span>
            </div>
          </div>
        );
      })()}
    </>
  );
}

const PREFS_KEY = 'ai-advisor-prefs-v1';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}
function savePrefs(patch) {
  const cur = loadPrefs();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function Settings({ risk, setRisk, theme, setTheme, density, setDensity }) {
  const riskLevels = [
    { id:'conservative', label:'保守型', stock:30, bond:60, other:10, note:'以保本為主,接受較低報酬' },
    { id:'moderate',     label:'穩健型', stock:60, bond:30, other:10, note:'兼顧成長與保本' },
    { id:'aggressive',   label:'積極型', stock:85, bond:10, other:5,  note:'追求長期最大化,容忍大波動' },
  ];
  const initial = React.useMemo(loadPrefs, []);
  const [horizon, setHorizon]   = React.useState(initial.horizon ?? 15);
  const [monthly, setMonthly]   = React.useState(initial.monthly ?? 30000);
  const [target,  setTarget]    = React.useState(initial.target  ?? 15000000);
  const [avoid,   setAvoid]     = React.useState(initial.avoid   ?? []);
  const [notify,  setNotify]    = React.useState(initial.notify  ?? '每日摘要');
  const [detail,  setDetail]    = React.useState(initial.detail  ?? '帶理由');
  const [tone,    setTone]      = React.useState(initial.tone    ?? '教練式');
  React.useEffect(() => { savePrefs({ horizon, monthly, target, avoid, notify, detail, tone }); },
    [horizon, monthly, target, avoid, notify, detail, tone]);
  const toggleAvoid = (t) => setAvoid(avoid.includes(t) ? avoid.filter(x => x !== t) : [...avoid, t]);
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
              <input type="range" min="1" max="30" value={horizon} onChange={e=>setHorizon(+e.target.value)} style={{width:'100%', accentColor:'var(--accent)'}}/>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)'}}>
                <span>1 年</span><span className="mono" style={{color:'var(--accent)', fontSize:14}}>{horizon} 年</span><span>30 年</span>
              </div>
            </div>
            <div>
              <label className="field-label">月定投金額 (NT$)</label>
              <input className="input" type="number" value={monthly} onChange={e=>setMonthly(+e.target.value||0)}/>
            </div>
            <div>
              <label className="field-label">目標金額 (NT$)</label>
              <input className="input" type="number" value={target} onChange={e=>setTarget(+e.target.value||0)}/>
            </div>
            <div>
              <label className="field-label">不願意持有的類別</label>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {['加密貨幣','單一個股','槓桿 ETF','衍生品','高收益債'].map(t => (
                  <span key={t} className={'chip' + (avoid.includes(t)?' accent':'')} onClick={()=>toggleAvoid(t)} style={{cursor:'pointer'}}>{t}</span>
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
            { title:'通知頻率',   options:['即時','每日摘要','每週','僅高優先'], value:notify, set:setNotify },
            { title:'解釋詳細度', options:['簡短結論','帶理由','完整推理','數據細節'], value:detail, set:setDetail },
            { title:'AI 口吻',   options:['直接','教練式','保守謹慎','數據導向'], value:tone,   set:setTone },
          ].map(g => (
            <div key={g.title}>
              <label className="field-label">{g.title}</label>
              <div style={{display:'flex', gap:4, flexDirection:'column'}}>
                {g.options.map(o => (
                  <div key={o} onClick={()=>g.set(o)}
                       style={{padding:'8px 10px', border:'1px solid ' + (o===g.value?'var(--accent)':'var(--line)'), borderRadius:'var(--radius)', fontSize:12, cursor:'pointer', background: o===g.value?'var(--accent-soft-2)':'transparent', color:o===g.value?'var(--accent)':'var(--text-1)'}}>
                    {o}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
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

      <BackupRestoreCard/>
    </>
  );
}

const BACKUP_KEYS = [
  { key: 'ai-advisor-holdings-v1',     label: '持股資料' },
  { key: 'ai-advisor-prefs-v1',        label: '偏好設定' },
  { key: 'ai-advisor-signal-state-v1', label: '訊號處理紀錄' },
  { key: 'ai-advisor-chat-v1',         label: '對話紀錄' },
  { key: 'ai-advisor-theme-v1',        label: '主題偏好' },
  { key: 'ai-advisor-bookmarks-v1',    label: '資料書籤' },
  { key: 'ai-advisor-rebalance-history-v1', label: '再平衡歷史' },
];

function BackupRestoreCard() {
  const fileRef = React.useRef(null);

  const exportBackup = () => {
    const data = {};
    BACKUP_KEYS.forEach(({ key }) => {
      const v = localStorage.getItem(key);
      if (v != null) data[key] = v;
    });
    const payload = {
      app: 'ai-investment-advisor',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ai-advisor-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`已匯出 ${Object.keys(data).length} 項設定`, '備份完成');
  };

  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!parsed || parsed.app !== 'ai-investment-advisor' || !parsed.data) {
          toast.error('檔案格式不符合此應用的備份格式。'); return;
        }
        const keys = Object.keys(parsed.data).filter(k => BACKUP_KEYS.find(b => b.key === k));
        if (!keys.length) { toast.error('備份內容為空,沒有可還原的項目。'); return; }
        if (!confirm(`將還原 ${keys.length} 項設定,並覆蓋你目前在瀏覽器中的資料。確定?`)) return;
        keys.forEach(k => {
          const v = parsed.data[k];
          if (typeof v === 'string') localStorage.setItem(k, v);
        });
        toast.success('已還原設定,頁面即將重新整理以套用。', '還原完成');
        setTimeout(() => location.reload(), 900);
      } catch (e) {
        toast.error('備份檔解析失敗:' + e.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const clearAll = () => {
    if (!confirm('確定要清除所有在瀏覽器中的資料?包含持股、偏好、對話與訊號紀錄,且無法復原。')) return;
    BACKUP_KEYS.forEach(({ key }) => { try { localStorage.removeItem(key); } catch {} });
    toast.success('已清除所有本地資料,頁面即將重新整理。');
    setTimeout(() => location.reload(), 900);
  };

  const sizes = BACKUP_KEYS.map(({ key, label }) => {
    const v = localStorage.getItem(key);
    return { key, label, bytes: v ? new Blob([v]).size : 0, present: v != null };
  });
  const totalBytes = sizes.reduce((s, i) => s + i.bytes, 0);
  const fmtBytes = (b) => b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">備份與還原</div>
          <div className="card-sub">所有資料僅存在你的瀏覽器。備份為 JSON 檔案,可用於換裝置或清除快取前留存。</div>
        </div>
        <span className="chip">{fmtBytes(totalBytes)}</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10, marginBottom:14}}>
        {sizes.map(s => (
          <div key={s.key} style={{padding:10, background:'var(--bg-2)', borderRadius:'var(--radius)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontSize:11, color:'var(--text-1)'}}>{s.label}</div>
              <div style={{fontSize:10, color:s.present?'var(--text-3)':'var(--text-4)'}} className="mono">
                {s.present ? fmtBytes(s.bytes) : '尚無資料'}
              </div>
            </div>
            <span className="dot" style={{width:6, height:6, borderRadius:'50%', background: s.present?'var(--pos)':'var(--text-4)', display:'inline-block'}}/>
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{display:'none'}}
               onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }}/>
        <button className="btn" onClick={exportBackup}><Icon name="download" size={13}/>匯出備份 JSON</button>
        <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={13}/>從備份還原</button>
        <div style={{flex:1}}/>
        <button className="btn" onClick={clearAll} style={{color:'var(--neg)'}}><Icon name="trash" size={13}/>清除所有本地資料</button>
      </div>
    </div>
  );
}

const CHAT_KEY = 'ai-advisor-chat-v1';
const CHAT_INTRO = { role:'ai', text:'嗨,我是你的投資配置助理。你可以問我任何關於目前持股、配置、市場事件的問題,我會結合你的個人資料與即時行情回答。' };
function loadChat() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [CHAT_INTRO];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed.map(m => ({ ...m, loading: false })) : [CHAT_INTRO];
  } catch { return [CHAT_INTRO]; }
}
function saveChat(msgs) {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.filter(m => !m.loading))); } catch {}
}

function Chat() {
  const [userHoldings] = useHoldings();
  const tickers = RT.holdingsToTickers(userHoldings);
  const macroTickers = ['^TNX', '^VIX', 'TWD=X'];
  const { quotes } = useLiveQuotes([...new Set([...tickers, ...macroTickers])], { intervalMs: 60000 });
  const holdings = RT.applyQuotesToHoldings(userHoldings, quotes);
  const usdTwd = quotes['TWD=X']?.price;
  const totalMV = RT.totalValueTWD(holdings, usdTwd);
  const liveAllocation = RT.computeLiveAllocation(holdings, DATA.allocation, usdTwd);

  const [msgs, setMsgs] = React.useState(loadChat);
  React.useEffect(() => { saveChat(msgs); }, [msgs]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);
  const clearChat = () => {
    if (!confirm('清除對話紀錄?此動作無法復原。')) return;
    setMsgs([CHAT_INTRO]);
  };

  const buildContext = () => {
    const allocLine = liveAllocation.map(a => `${a.name} ${a.current.toFixed(1)}%`).join('、');
    const targetLine = liveAllocation.map(a => `${a.name} ${a.target}%`).join('、');
    const holdingLine = holdings.filter(h => h.symbol !== 'CASH').map(h => h.symbol).join('、');
    const us10y = quotes['^TNX']?.price;
    const vix   = quotes['^VIX']?.price;
    const usdtwd= quotes['TWD=X']?.price;
    const macro = [
      us10y != null ? `美 10Y 殖利率 ${us10y.toFixed(2)}%` : null,
      vix   != null ? `VIX ${vix.toFixed(1)}` : null,
      usdtwd!= null ? `USD/TWD ${usdtwd.toFixed(2)}` : null,
    ].filter(Boolean).join('、');

    return `你是一位台灣的長期投資配置 AI 顧問。使用者資料(即時):
- 姓名:${DATA.user.name},穩健型,投資期限 15 年,月定投 NT$30,000
- 總資產約 ${fmt.tw(totalMV)}
- 目前配置:${allocLine}
- 目標配置:${targetLine}
- 主要持股:${holdingLine}
- 即時市場:${macro || '(行情讀取中)'}

請以繁體中文回答,口吻專業但親切。回答要結構化:先「短答結論」,再列 2-3 個「原因」,最後附「參考資料」。可以用 HTML 標籤 <b>、<br/> 排版。不超過 200 字。不構成投資建議。`;
  };

  const send = async () => {
    if (!input.trim()) return;
    const q = input;
    const next = [...msgs, { role:'user', text: q }, { role:'ai', text:'正在分析...', loading:true }];
    setMsgs(next);
    setInput('');

    const context = buildContext();

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

  const escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mdToHtml = (raw) => {
    const lines = String(raw).split(/\r?\n/);
    const out = []; let buf = []; let inList = false;
    const flush = () => { if (buf.length) { out.push(buf.join('<br/>')); buf = []; } };
    lines.forEach(ln => {
      if (/^\s*[-•]\s+/.test(ln)) {
        if (!inList) { flush(); out.push('<ul>'); inList = true; }
        out.push('<li>' + escHtml(ln.replace(/^\s*[-•]\s+/, '')) + '</li>');
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        buf.push(escHtml(ln));
      }
    });
    if (inList) out.push('</ul>');
    flush();
    return out.join('')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  };
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>對話 AI</h1>
          <p>用自然語言問問題。AI 會結合你的持股、風險偏好與即時行情回答。</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={clearChat} title="清除對話紀錄"><Icon name="trash" size={14}/>清除</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:'var(--density-gap)', height:'calc(100vh - 200px)'}}>
        <div className="card" style={{display:'flex', flexDirection:'column', padding:0}}>
          <div ref={scrollRef} style={{flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:14}}>
            {msgs.length <= 1 && (() => {
              const topSym = holdings.filter(h => h.symbol !== 'CASH').sort((a,b) => (b.weight||0) - (a.weight||0))[0]?.symbol;
              const needRebalance = liveAllocation.filter(a => Math.abs(a.current - a.target) >= 3).length;
              const catalog = [
                {
                  title: '配置檢查',
                  icon: 'dashboard',
                  prompts: [
                    needRebalance > 0 ? `目前有 ${needRebalance} 項偏離目標,建議優先處理哪一項?` : '目前配置與目標很接近,有什麼潛在風險?',
                    '我的股債比合理嗎?為什麼?',
                    '幫我檢視這個月是否需要再平衡',
                  ],
                },
                {
                  title: '市場解讀',
                  icon: 'sparkles',
                  prompts: [
                    '最近美債殖利率變化對我的投資組合有什麼影響?',
                    'VIX 現在的水位代表什麼?',
                    'USD/TWD 走勢會影響我的海外部位嗎?',
                  ],
                },
                {
                  title: '持股操作',
                  icon: 'portfolio',
                  prompts: [
                    topSym ? `${topSym} 權重偏高,是否該部分獲利了結?` : '我有單一持股權重過高的問題嗎?',
                    '若加碼 BND 30 萬元,對整體風險的影響?',
                    '有哪些持股可以考慮汰換為更適合的 ETF?',
                  ],
                },
                {
                  title: '長期規劃',
                  icon: 'history',
                  prompts: [
                    '以目前進度,我能在目標年限達到設定金額嗎?',
                    '若我把月定投從 3 萬提高到 5 萬,差多少?',
                    '給我一份本月的投資組合摘要',
                  ],
                },
              ];
              return (
                <div style={{margin:'8px 0'}}>
                  <div style={{fontSize:11, color:'var(--text-3)', marginBottom:10, letterSpacing:'0.04em'}}>💡 試試這些起始問題,或直接輸入你的問題</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                    {catalog.map(cat => (
                      <div key={cat.title} style={{padding:12, border:'1px solid var(--line)', borderRadius:'var(--radius)', background:'var(--bg-2)'}}>
                        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8, color:'var(--accent)'}}>
                          <Icon name={cat.icon} size={12}/>
                          <span style={{fontSize:11, fontWeight:500, letterSpacing:'0.04em'}}>{cat.title}</span>
                        </div>
                        <div style={{display:'flex', flexDirection:'column', gap:6}}>
                          {cat.prompts.map((p, idx) => (
                            <button
                              key={idx}
                              onClick={() => setInput(p)}
                              style={{
                                textAlign:'left', padding:'6px 8px', fontSize:11.5,
                                color:'var(--text-1)', background:'transparent',
                                border:'1px solid var(--line)', borderRadius:4,
                                cursor:'pointer', lineHeight:1.5,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--accent-soft)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--line)'; }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {msgs.map((m, i) => {
              const rendered = m.loading ? null : (m.html ? m.text : mdToHtml(m.text));
              return (
                <div key={i} style={{display:'flex', gap:10, alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth:'80%'}}>
                  {m.role === 'ai' && <div style={{width:26, height:26, borderRadius:'50%', background:'var(--accent-soft)', color:'var(--accent)', display:'grid', placeItems:'center', flexShrink:0, fontSize:10, fontWeight:700}}>AI</div>}
                  <div style={{position:'relative', padding:'10px 14px', borderRadius: m.role==='user'? '14px 14px 2px 14px' : '2px 14px 14px 14px',
                               background: m.role==='user' ? 'var(--accent)' : 'var(--bg-2)',
                               color: m.role==='user' ? 'var(--bg-0)' : 'var(--text-0)',
                               fontSize:13, lineHeight:1.65}}>
                    {m.loading
                      ? <span style={{display:'inline-flex', alignItems:'center', gap:8}}>正在分析 <span className="loader-dots"><i/><i/><i/></span></span>
                      : <span dangerouslySetInnerHTML={{__html: rendered}}/>}
                    {!m.loading && m.role === 'ai' && (
                      <button className="icon-btn" onClick={() => copyText(m.text.replace(/<[^>]+>/g,''))}
                              aria-label="複製" title="複製"
                              style={{position:'absolute', top:4, right:4, width:22, height:22, opacity:0.6}}>
                        <Icon name="link" size={10}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
