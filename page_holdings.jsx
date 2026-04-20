// Holdings page
const SECTOR_OPTIONS = ['台股','美股','全球','債券','原物料','現金'];
const TYPE_OPTIONS   = ['台股','台股ETF','美股','美股ETF','全球ETF','債券ETF','黃金ETF','現金','其他'];

function guessSectorType(symbol) {
  const s = (symbol || '').toUpperCase();
  if (/^\d{4,6}$/.test(s)) return { sector: '台股', type: /^00/.test(s) ? '台股ETF' : '台股' };
  if (['VT'].includes(s))  return { sector: '全球', type: '全球ETF' };
  if (['BND','IEF','TLT','AGG'].includes(s)) return { sector: '債券', type: '債券ETF' };
  if (['GLD','SLV','IAU'].includes(s)) return { sector: '原物料', type: '黃金ETF' };
  if (['VTI','VOO','QQQ','SPY','DIA'].includes(s)) return { sector: '美股', type: '美股ETF' };
  if (s === 'CASH') return { sector: '現金', type: '現金' };
  return { sector: '美股', type: '美股' };
}

function Holdings() {
  useNow(15000);
  const [userHoldings, setHoldings] = useHoldings();
  const [editing, setEditing] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [search, setSearch]   = React.useState('');
  const [filterSector, setFilterSector] = React.useState('全部');
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [sort, setSort] = React.useState({ col: 'weight', dir: 'desc' });
  const cycleSort = (col) => {
    setSort(prev => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: 'weight', dir: 'desc' };
    });
  };
  const toggleSel = (id) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const removeSelected = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定移除選取的 ${selectedIds.size} 檔?此動作無法復原。`)) return;
    setHoldings(userHoldings.filter(h => !selectedIds.has(h.id)));
    setSelectedIds(new Set());
  };

  const tickers = [...new Set([...RT.holdingsToTickers(userHoldings), 'TWD=X'])];
  const { quotes, status, updatedAt, refresh } = useLiveQuotes(tickers, { intervalMs: 60000 });
  const trendTickers = RT.holdingsToTickers(userHoldings);
  const { history: trendHistory } = useLiveHistory(trendTickers, { range: '3mo', interval: '1d' });
  const holdings = RT.applyQuotesToHoldings(userHoldings, quotes);
  const liveCount = holdings.filter(h => h.live).length;
  const usdTwd = quotes['TWD=X']?.price;

  const totalCost = RT.totalCostTWD(holdings, usdTwd);
  const totalValue = RT.totalValueTWD(holdings, usdTwd) || 1;
  const unrealized = totalValue - totalCost;
  const unrealizedPct = totalCost ? (unrealized / totalCost) * 100 : 0;

  const holdingsWithWeight = holdings.map((h) => ({ ...h, weight: (RT.holdingMarketValueTWD(h, usdTwd) / totalValue) * 100 }));
  const sectorCounts = holdingsWithWeight.reduce((acc, h) => { acc[h.sector] = (acc[h.sector]||0)+1; return acc; }, {});

  const filtered = holdingsWithWeight.filter((h) => {
    if (filterSector !== '全部' && h.sector !== filterSector) return false;
    if (search && !(`${h.symbol} ${h.name}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const sortKeyFor = (h, col) => {
    switch (col) {
      case 'symbol':  return h.symbol;
      case 'name':    return h.name;
      case 'type':    return h.type;
      case 'shares':  return h.shares || 0;
      case 'cost':    return h.cost || 0;
      case 'price':   return h.price || 0;
      case 'mv':      return RT.holdingMarketValueTWD(h, usdTwd);
      case 'pl':      return h.cost ? ((h.price - h.cost) / h.cost) * 100 : 0;
      case 'weight':  return h.weight || 0;
      default:        return 0;
    }
  };
  filtered.sort((a, b) => {
    const av = sortKeyFor(a, sort.col);
    const bv = sortKeyFor(b, sort.col);
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ col, children, num }) => {
    const active = sort.col === col;
    const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '';
    return (
      <th
        className={num ? 'num' : undefined}
        onClick={() => cycleSort(col)}
        style={{cursor:'pointer', userSelect:'none', color: active ? 'var(--accent)' : undefined}}
        title="點擊切換排序(desc → asc → 預設)"
      >
        {children}
        <span className="mono" style={{marginLeft:4, fontSize:9, opacity: active ? 1 : 0.25}}>{arrow || '↕'}</span>
      </th>
    );
  };

  const addHolding = (data) => {
    const guess = guessSectorType(data.symbol);
    const h = {
      id: 'u' + Date.now().toString(36),
      symbol: data.symbol.toUpperCase(),
      name:   data.name || data.symbol.toUpperCase(),
      type:   data.type   || guess.type,
      sector: data.sector || guess.sector,
      shares: Number(data.shares) || 0,
      price:  Number(data.price)  || Number(data.cost) || 0,
      cost:   Number(data.cost)   || 0,
      weight: 0,
      notes:  data.notes || '',
    };
    setHoldings([...userHoldings, h]);
  };

  const updateHolding = (id, patch) => {
    setHoldings(userHoldings.map(h => h.id === id ? { ...h, ...patch } : h));
  };

  const removeHolding = (id) => {
    if (!confirm('確定移除這檔持股?此動作無法復原。')) return;
    setHoldings(userHoldings.filter(h => h.id !== id));
  };

  const resetToSample = () => {
    if (!confirm('恢復為示範持股?會覆蓋你目前的持股資料。')) return;
    RT.resetHoldings();
  };

  const fileInputRef = React.useRef(null);

  const exportCSV = () => {
    const header = ['symbol','name','type','sector','shares','cost','price','notes'];
    const rows = userHoldings.map(h => [
      h.symbol, h.name, h.type, h.sector,
      h.shares ?? '', h.cost ?? '', h.price ?? '', h.notes ?? '',
    ]);
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdings-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const parseCSV = (text) => {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const parseLine = (line) => {
      const out = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ',') { out.push(cur); cur = ''; }
          else cur += c;
        }
      }
      out.push(cur);
      return out;
    };
    const header = parseLine(lines[0]).map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cols = parseLine(line);
      const o = {};
      header.forEach((h, i) => { o[h] = (cols[i] ?? '').trim(); });
      return o;
    });
  };

  const importCSV = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result || ''));
        if (!rows.length) { toast.error('CSV 為空或無法解析。'); return; }
        const imported = rows
          .filter(r => r.symbol)
          .map((r, i) => {
            const sym = r.symbol.toUpperCase();
            const guess = guessSectorType(sym);
            return {
              id: 'i' + Date.now().toString(36) + i,
              symbol: sym,
              name:   r.name   || sym,
              type:   r.type   || guess.type,
              sector: r.sector || guess.sector,
              shares: Number(r.shares) || 0,
              cost:   Number(r.cost)   || 0,
              price:  Number(r.price)  || Number(r.cost) || 0,
              weight: 0,
              notes:  r.notes  || '',
            };
          });
        if (!imported.length) { toast.error('沒有可匯入的列(需要至少 symbol 欄位)。'); return; }
        const replace = confirm(`將匯入 ${imported.length} 筆。按「確定」覆蓋現有持股,「取消」合併新增。`);
        setHoldings(replace ? imported : [...userHoldings, ...imported]);
        toast.success(`已${replace ? '覆蓋' : '合併'}匯入 ${imported.length} 筆持股`, '匯入完成');
      } catch (e) {
        toast.error('CSV 解析失敗: ' + e.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const statusLabel = {
    idle: '待連線', loading: '連線中', live: `即時 · ${liveCount}/${holdings.length} 檔`, error: '離線 · 使用快照',
  }[status];
  const statusColor = status === 'live' ? 'var(--pos)' : status === 'error' ? 'var(--neg)' : 'var(--text-3)';

  const STALE_MS = 10 * 60 * 1000;
  const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null;
  const isStale = status === 'error' || (ageMs != null && ageMs > STALE_MS);
  const staleMinutes = ageMs != null ? Math.floor(ageMs / 60000) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>持股管理</h1>
          <p>手動輸入或匯入券商資料(儲存在你的瀏覽器,不會上傳)。AI 會根據你的實際持股即時更新配置分析與建議。</p>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:11, color:statusColor}}>
            <span className={'dot ' + (status==='live'?'pulse':'')} style={{width:6, height:6, borderRadius:'50%', background:statusColor, display:'inline-block'}}/>
            {statusLabel}{updatedAt && ` · ${RT.relTime(updatedAt)}`}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={refresh} title="重新抓取即時行情"><Icon name="refresh" size={14}/>重新整理</button>
          <button className="btn" onClick={resetToSample} title="恢復示範持股">恢復示範</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{display:'none'}}
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ''; }}/>
          <button className="btn" onClick={() => fileInputRef.current?.click()} title="匯入 CSV (欄位: symbol,name,type,sector,shares,cost,price)"><Icon name="upload" size={14}/>匯入 CSV</button>
          <button className="btn" onClick={exportCSV} title="匯出為 CSV"><Icon name="download" size={14}/>匯出 CSV</button>
          <button className="btn primary" onClick={()=>setShowAdd(true)}><Icon name="plus" size={14}/>新增持股</button>
        </div>
      </div>

      {isStale && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 14px', marginBottom:'var(--density-gap)',
          border:'1px solid var(--neg)', borderLeft:'3px solid var(--neg)',
          background:'var(--bg-2)', borderRadius:'var(--radius)',
          fontSize:12, color:'var(--text-1)',
        }}>
          <Icon name="alert" size={14} style={{color:'var(--neg)', flexShrink:0}}/>
          <div style={{flex:1}}>
            <b>行情可能過時</b>
            <span style={{color:'var(--text-3)', marginLeft:8}}>
              {status === 'error' ? '連線失敗,顯示為最後一次成功抓取的快照。' :
                `上一次成功更新為 ${staleMinutes} 分鐘前。`}
              {' '}市值與損益數字僅供參考。
            </span>
          </div>
          <button className="btn" onClick={refresh}><Icon name="refresh" size={12}/>立即重試</button>
        </div>
      )}

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
          <button className={filterSector==='全部'?'active':''} onClick={()=>setFilterSector('全部')}>全部 · {holdings.length}</button>
          {SECTOR_OPTIONS.map(s => (
            sectorCounts[s] ? <button key={s} className={filterSector===s?'active':''} onClick={()=>setFilterSector(s)}>{s} · {sectorCounts[s]}</button> : null
          ))}
        </div>
        <div style={{flex:1}}/>
        <div style={{position:'relative'}}>
          <Icon name="search" size={12} style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)'}}/>
          <input className="input" placeholder="搜尋代號 / 名稱" value={search} onChange={e=>setSearch(e.target.value)} style={{width:220, paddingLeft:30, height:30}}/>
        </div>
        {selectedIds.size > 0 && (
          <>
            <span style={{fontSize:11, color:'var(--text-2)'}}>已選 {selectedIds.size} 檔</span>
            <button className="btn" onClick={() => setSelectedIds(new Set())}>取消選取</button>
            <button className="btn" style={{color:'var(--neg)'}} onClick={removeSelected}><Icon name="trash" size={13}/>批次移除</button>
          </>
        )}
        <button className="icon-btn" aria-label="進階篩選"><Icon name="filter" size={13}/></button>
      </div>

      {/* Holdings table */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:30}}>
                <input type="checkbox"
                       checked={filtered.length > 0 && filtered.every(h => selectedIds.has(h.id))}
                       onChange={(e) => {
                         const n = new Set(selectedIds);
                         if (e.target.checked) filtered.forEach(h => n.add(h.id));
                         else filtered.forEach(h => n.delete(h.id));
                         setSelectedIds(n);
                       }}/>
              </th>
              <SortHeader col="symbol">代號</SortHeader>
              <SortHeader col="name">名稱</SortHeader>
              <SortHeader col="type">類別</SortHeader>
              <SortHeader col="shares" num>持有</SortHeader>
              <SortHeader col="cost" num>均價</SortHeader>
              <SortHeader col="price" num>現價</SortHeader>
              <SortHeader col="mv" num>市值</SortHeader>
              <SortHeader col="pl" num>損益</SortHeader>
              <SortHeader col="weight" num>權重</SortHeader>
              <th>3M 走勢</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12}>
                <div className="empty-state">
                  <div className="empty-icon"><Icon name="portfolio" size={18}/></div>
                  <div className="empty-title">{userHoldings.length === 0 ? '尚未建立持股' : '沒有符合條件的持股'}</div>
                  <div>{userHoldings.length === 0 ? '按右上角「新增持股」或「恢復示範資料」開始。' : '調整搜尋或類別篩選條件。'}</div>
                </div>
              </td></tr>
            )}
            {filtered.map(h => {
              const mv = RT.holdingMarketValueTWD(h, usdTwd);
              const pl = h.cost ? ((h.price - h.cost)/h.cost) * 100 : 0;
              const dayChg = h.changePct ?? 0;
              return (
                <tr key={h.id}>
                  <td><input type="checkbox" checked={selectedIds.has(h.id)} onChange={() => toggleSel(h.id)}/></td>
                  <td>
                    <span className="mono" style={{fontSize:12, display:'inline-flex', alignItems:'center', gap:6}}>
                      {h.symbol}
                      {h.live && <span className="dot pulse" title="即時" style={{width:5, height:5, borderRadius:'50%', background:'var(--pos)', display:'inline-block'}}/>}
                    </span>
                  </td>
                  <td style={{color:'var(--text-1)'}}>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <span>{h.name}</span>
                      {h.notes && (
                        <span title={h.notes} style={{
                          fontSize:9, padding:'1px 5px', borderRadius:3,
                          background:'var(--accent-soft-2)', color:'var(--accent)',
                          cursor:'help', letterSpacing:'0.02em',
                        }}>備註</span>
                      )}
                    </div>
                  </td>
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
                      <div className="bar" style={{width:60}}><span style={{width:Math.min(h.weight*2, 100)+'%'}}/></div>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const tk = RT.YAHOO_MAP[h.symbol];
                      const pts = tk && trendHistory[tk];
                      if (!pts || pts.length < 2) return <span style={{fontSize:10, color:'var(--text-4)'}}>—</span>;
                      const values = pts.map(p => p.close);
                      const up = values[values.length-1] >= values[0];
                      return <Sparkline values={values} width={110} height={28} color={up?'var(--pos)':'var(--neg)'}/>;
                    })()}
                  </td>
                  <td>
                    <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                      <button className="icon-btn" style={{width:26, height:26}} title="編輯" onClick={()=>setEditing(h)}><Icon name="settings" size={11}/></button>
                      <button className="icon-btn" style={{width:26, height:26}} title="移除" onClick={()=>removeHolding(h.id)}><Icon name="trash" size={11}/></button>
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

      {showAdd && <HoldingFormModal onClose={()=>setShowAdd(false)} onSave={(d)=>{ addHolding(d); setShowAdd(false); }}/>}
      {editing && <HoldingFormModal holding={editing} onClose={()=>setEditing(null)} onSave={(d)=>{ updateHolding(editing.id, d); setEditing(null); }}/>}
    </>
  );
}

function HoldingFormModal({ holding, onClose, onSave }) {
  const isEdit = !!holding;
  const [sym,    setSym]    = React.useState(holding?.symbol || '');
  const [name,   setName]   = React.useState(holding?.name   || '');
  const [shares, setShares] = React.useState(holding ? String(holding.shares) : '');
  const [cost,   setCost]   = React.useState(holding ? String(holding.cost)   : '');
  const [sector, setSector] = React.useState(holding?.sector || '');
  const [type,   setType]   = React.useState(holding?.type   || '');
  const [notes,  setNotes]  = React.useState(holding?.notes  || '');
  const [lookupStatus, setLookupStatus] = React.useState('idle');
  const [lookupPrice, setLookupPrice]   = React.useState(null);

  // On blur of symbol, try to lookup via Yahoo to auto-fill name + current price
  const doLookup = async () => {
    if (!sym || isEdit) return;
    const ticker = RT.YAHOO_MAP[sym.toUpperCase()] || (/^\d{4,6}$/.test(sym) ? sym + '.TW' : sym.toUpperCase());
    setLookupStatus('loading');
    try {
      const q = await RT.fetchYahooQuote(ticker);
      setLookupPrice(q.price);
      const guess = guessSectorType(sym);
      if (!sector) setSector(guess.sector);
      if (!type)   setType(guess.type);
      setLookupStatus('ok');
    } catch (e) {
      setLookupStatus('error');
    }
  };

  const save = () => {
    if (!sym || !shares) return;
    onSave({
      symbol: sym,
      name: name || sym,
      shares,
      cost: cost || lookupPrice || 0,
      price: lookupPrice || cost || 0,
      sector: sector || guessSectorType(sym).sector,
      type:   type   || guessSectorType(sym).type,
      notes: notes.trim(),
    });
  };

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'grid', placeItems:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:520, background:'var(--bg-1)', border:'1px solid var(--line-2)', borderRadius:'var(--radius-lg)', padding:22}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <h3 style={{margin:0, fontSize:16, fontWeight:500}}>{isEdit ? '編輯持股' : '新增持股'}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
        </div>

        <label className="field-label">代號{isEdit && <span style={{color:'var(--text-3)', marginLeft:6, fontSize:10}}>(編輯模式不可變)</span>}</label>
        <div style={{display:'flex', gap:8}}>
          <input className="input" placeholder="例如 2330 / VTI / 0050" value={sym} disabled={isEdit}
                 onChange={e=>setSym(e.target.value)} onBlur={doLookup} style={{flex:1}}/>
          {!isEdit && <button className="btn" onClick={doLookup} disabled={!sym || lookupStatus==='loading'}>查價</button>}
        </div>
        {lookupStatus === 'loading' && <div style={{fontSize:10, color:'var(--text-3)', marginTop:4}}>查詢中…</div>}
        {lookupStatus === 'ok' && lookupPrice != null && <div style={{fontSize:10, color:'var(--pos)', marginTop:4}}>目前價 {fmt.num(lookupPrice)}</div>}
        {lookupStatus === 'error' && <div style={{fontSize:10, color:'var(--neg)', marginTop:4}}>查不到此代號,請手動填資料</div>}

        <label className="field-label" style={{marginTop:14}}>名稱</label>
        <input className="input" placeholder="元大台灣50" value={name} onChange={e=>setName(e.target.value)}/>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14}}>
          <div>
            <label className="field-label">持有股數</label>
            <input className="input" type="number" placeholder="0" value={shares} onChange={e=>setShares(e.target.value)}/>
          </div>
          <div>
            <label className="field-label">平均成本</label>
            <input className="input" type="number" step="0.01" placeholder="0.00" value={cost} onChange={e=>setCost(e.target.value)}/>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14}}>
          <div>
            <label className="field-label">資產類別</label>
            <select className="input" value={sector} onChange={e=>setSector(e.target.value)}>
              <option value="">自動判斷</option>
              {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">持股類型</label>
            <select className="input" value={type} onChange={e=>setType(e.target.value)}>
              <option value="">自動判斷</option>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label" style={{marginTop:14}}>備註 <span style={{color:'var(--text-3)', fontSize:10, marginLeft:4}}>(選填 · 僅自己可見)</span></label>
        <textarea
          className="input"
          placeholder="例如:長期持有核心部位,除非跌破 200 日均線不出場"
          value={notes}
          onChange={e=>setNotes(e.target.value)}
          rows={3}
          style={{resize:'vertical', fontFamily:'inherit', minHeight:60, padding:8}}
        />

        <div style={{display:'flex', gap:8, marginTop:20, justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={save} disabled={!sym || !shares}>{isEdit ? '儲存' : '新增'}</button>
        </div>
      </div>
    </div>
  );
}

window.Holdings = Holdings;
