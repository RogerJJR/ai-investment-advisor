// Holdings page
function Holdings() {
  const [editing, setEditing] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);

  const tickers = RT.holdingsToTickers(DATA.holdings);
  const { quotes, status, updatedAt, refresh } = useLiveQuotes(tickers, { intervalMs: 60000 });
  const holdings = RT.applyQuotesToHoldings(DATA.holdings, quotes);
  const liveCount = holdings.filter(h => h.live).length;

  const totalCost = holdings.reduce((s,h) => s + h.shares * h.cost, 0);
  const totalValue = holdings.reduce((s,h) => s + h.shares * h.price, 0);
  const unrealized = totalValue - totalCost;
  const unrealizedPct = (unrealized / totalCost) * 100;

  const statusLabel = {
    idle: '待連線', loading: '連線中', live: `即時 · ${liveCount}/${holdings.length} 檔`, error: '離線 · 使用快照',
  }[status];
  const statusColor = status === 'live' ? 'var(--pos)' : status === 'error' ? 'var(--neg)' : 'var(--text-3)';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>持股管理</h1>
          <p>手動輸入或匯入券商資料。AI 會根據你的實際持股即時更新配置分析與建議。</p>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:11, color:statusColor}}>
            <span className={'dot ' + (status==='live'?'pulse':'')} style={{width:6, height:6, borderRadius:'50%', background:statusColor, display:'inline-block'}}/>
            {statusLabel}{updatedAt && ` · ${RT.relTime(updatedAt)}`}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={refresh} title="重新抓取即時行情"><Icon name="refresh" size={14}/>重新整理</button>
          <button className="btn"><Icon name="upload" size={14}/>從券商匯入</button>
          <button className="btn"><Icon name="download" size={14}/>CSV / Excel</button>
          <button className="btn primary" onClick={()=>setShowAdd(true)}><Icon name="plus" size={14}/>新增持股</button>
        </div>
      </div>

      {/* Import choices */}
      <div className="card" style={{marginBottom:'var(--density-gap)'}}>
        <div className="card-head">
          <div>
            <div className="card-title">快速匯入管道</div>
            <div className="card-sub">連接券商或上傳對帳單 · 資料僅在你的瀏覽器端處理</div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
          {[
            { name:'元大證券', type:'台股 · API', status:'connected' },
            { name:'永豐金證券', type:'台股 · API', status:'' },
            { name:'Firstrade',  type:'美股 · OAuth', status:'' },
            { name:'Interactive Brokers', type:'美股 · IBKR', status:'' },
          ].map(b => (
            <div key={b.name} style={{padding:14, border:'1px solid var(--line)', borderRadius:'var(--radius)', background:b.status?'var(--accent-soft)':'var(--bg-2)', cursor:'pointer'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <span style={{width:24, height:24, borderRadius:4, background:'var(--bg-4)', display:'grid', placeItems:'center', fontSize:10, color:'var(--text-1)'}}>證</span>
                {b.status === 'connected' && <span className="chip pos" style={{fontSize:10}}><span className="dot"/>已連接</span>}
              </div>
              <div style={{fontSize:13, color:'var(--text-0)', marginBottom:2}}>{b.name}</div>
              <div style={{fontSize:11, color:'var(--text-3)'}}>{b.type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10}}>
        <div className="seg">
          <button className="active">全部 · {DATA.holdings.length}</button>
          <button>台股 · 3</button>
          <button>美股 · 3</button>
          <button>ETF · 5</button>
          <button>債券 · 2</button>
          <button>其他 · 2</button>
        </div>
        <div style={{flex:1}}/>
        <div style={{position:'relative'}}>
          <Icon name="search" size={12} style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)'}}/>
          <input className="input" placeholder="搜尋代號 / 名稱" style={{width:220, paddingLeft:30, height:30}}/>
        </div>
        <button className="icon-btn"><Icon name="filter" size={13}/></button>
      </div>

      {/* Holdings table */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:30}}><input type="checkbox"/></th>
              <th>代號</th>
              <th>名稱</th>
              <th>類別</th>
              <th className="num">持有</th>
              <th className="num">均價</th>
              <th className="num">現價</th>
              <th className="num">市值</th>
              <th className="num">損益</th>
              <th className="num">權重</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const mv = h.shares * h.price;
              const pl = ((h.price - h.cost)/h.cost) * 100;
              const dayChg = h.changePct ?? 0;
              return (
                <tr key={h.id}>
                  <td><input type="checkbox"/></td>
                  <td>
                    <span className="mono" style={{fontSize:12, display:'inline-flex', alignItems:'center', gap:6}}>
                      {h.symbol}
                      {h.live && <span className="dot pulse" title="即時" style={{width:5, height:5, borderRadius:'50%', background:'var(--pos)', display:'inline-block'}}/>}
                    </span>
                  </td>
                  <td style={{color:'var(--text-1)'}}>{h.name}</td>
                  <td><span className="chip" style={{fontSize:10}}>{h.type}</span></td>
                  <td className="num">{h.shares.toLocaleString()}</td>
                  <td className="num" style={{color:'var(--text-2)'}}>{fmt.num(h.cost)}</td>
                  <td className="num">
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:1}}>
                      <span>{fmt.num(h.price)}</span>
                      {h.live && <span className="mono" style={{fontSize:10, color: dayChg>=0?'var(--pos)':'var(--neg)'}}>{fmt.pct(dayChg, 2)}</span>}
                    </div>
                  </td>
                  <td className="num">{fmt.tw(mv)}</td>
                  <td className="num" style={{color: pl>=0?'var(--pos)':'var(--neg)'}}>{fmt.pct(pl)}</td>
                  <td className="num">
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2}}>
                      <span>{h.weight.toFixed(1)}%</span>
                      <div className="bar" style={{width:60}}><span style={{width:h.weight*2+'%'}}/></div>
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                      <button className="icon-btn" style={{width:26, height:26}} title="編輯"><Icon name="settings" size={11}/></button>
                      <button className="icon-btn" style={{width:26, height:26}} title="移除"><Icon name="trash" size={11}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{marginTop:'var(--density-gap)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'var(--density-gap)'}}>
        <div className="card">
          <div className="card-title">總成本</div>
          <div style={{fontSize:22, marginTop:8}} className="mono">{fmt.tw(totalCost)}</div>
        </div>
        <div className="card">
          <div className="card-title">總市值</div>
          <div style={{fontSize:22, marginTop:8}} className="mono">{fmt.tw(totalValue)}</div>
        </div>
        <div className="card">
          <div className="card-title">未實現損益</div>
          <div style={{fontSize:22, marginTop:8, color: unrealized>=0?'var(--pos)':'var(--neg)'}} className="mono">
            {unrealized>=0?'+':''}{fmt.tw(unrealized)} ({fmt.pct(unrealizedPct)})
          </div>
        </div>
      </div>

      {showAdd && <AddHoldingModal onClose={()=>setShowAdd(false)}/>}
    </>
  );
}

function AddHoldingModal({ onClose }) {
  const [sym, setSym] = React.useState('');
  const [suggestions] = React.useState([
    { sym:'QQQ', name:'Invesco QQQ Trust', market:'NASDAQ' },
    { sym:'QUAL', name:'iShares MSCI Quality', market:'NYSE' },
    { sym:'2412', name:'中華電', market:'TWSE' },
  ]);

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'grid', placeItems:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:480, background:'var(--bg-1)', border:'1px solid var(--line-2)', borderRadius:'var(--radius-lg)', padding:22}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <h3 style={{margin:0, fontSize:16, fontWeight:500}}>新增持股</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
        </div>

        <label className="field-label">代號</label>
        <input className="input" placeholder="例如 2330 / VTI / 0050" value={sym} onChange={e=>setSym(e.target.value)}/>

        {sym.length > 0 && (
          <div style={{marginTop:10, border:'1px solid var(--line)', borderRadius:'var(--radius)', background:'var(--bg-2)'}}>
            {suggestions.map(s => (
              <div key={s.sym} style={{padding:'10px 12px', borderBottom:'1px solid var(--line)', cursor:'pointer'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="mono" style={{fontSize:12}}>{s.sym}</span>
                  <span style={{fontSize:10, color:'var(--text-3)'}}>{s.market}</span>
                </div>
                <div style={{fontSize:11, color:'var(--text-2)'}}>{s.name}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14}}>
          <div>
            <label className="field-label">持有股數</label>
            <input className="input" placeholder="0"/>
          </div>
          <div>
            <label className="field-label">平均成本</label>
            <input className="input" placeholder="0.00"/>
          </div>
        </div>

        <div style={{display:'flex', gap:8, marginTop:20, justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary">新增</button>
        </div>
      </div>
    </div>
  );
}

window.Holdings = Holdings;
