// Data sources page
function Sources() {
  useNow(15000);
  const [cat, setCat] = React.useState('全部');

  // Build news queries from holdings + broad market terms
  const newsQueries = React.useMemo(() => {
    const holdingSyms = DATA.holdings.map(h => RT.YAHOO_MAP[h.symbol]).filter(Boolean);
    return [...new Set([...holdingSyms.slice(0, 6), 'Fed', 'inflation'])];
  }, []);

  const { news: liveNews, status: newsStatus, updatedAt: newsUpdatedAt, refresh: refreshNews } =
    useLiveNews(newsQueries, { intervalMs: 5 * 60 * 1000, countEach: 3 });

  // Merge live news with static entries, classify category by simple heuristic
  const classify = (title) => {
    const t = (title || '').toLowerCase();
    if (/earning|revenue|profit|財報/.test(t)) return '財報';
    if (/fed|fomc|利率|央行|rate|ecb|boj/.test(t)) return '央行';
    if (/cpi|inflation|通膨|gdp|unemployment/.test(t)) return '總經';
    if (/upgrade|downgrade|target|目標價|rating/.test(t)) return '評等';
    if (/etf|成分|index/.test(t)) return 'ETF';
    if (/rsi|macd|技術|chart|breakout/.test(t)) return '技術';
    if (/sentiment|fear|greed|aaii/.test(t)) return '情緒';
    return '新聞';
  };
  const asStaticLike = liveNews.map((n) => ({
    id: n.id,
    cat: classify(n.title),
    title: n.title,
    ts: n.time ? n.time.toLocaleString('zh-TW', { hour12: false }) : '—',
    tag: (n.tickers[0] || n.query || '').toLowerCase(),
    impact: 'medium',
    provider: n.publisher,
    link: n.link,
    summary: n.summary,
    live: true,
  }));
  const allSources = [...asStaticLike, ...DATA.sources];

  const cats = ['全部', '總經', '央行', '財報', '新聞', '評等', 'ETF', '技術', '情緒'];
  const [query, setQuery] = React.useState('');
  const [timeRange, setTimeRange] = React.useState('全部');
  const q = query.trim().toLowerCase();
  const tsOf = (s) => {
    if (s.live && liveNews) {
      const ln = liveNews.find(n => n.id === s.id);
      if (ln?.time) return ln.time.getTime();
    }
    if (s.ts) { const t = new Date(s.ts).getTime(); if (!isNaN(t)) return t; }
    return null;
  };
  const now = Date.now();
  const ranges = {
    '今日':   24 * 60 * 60 * 1000,
    '近 3 天':  3 * 24 * 60 * 60 * 1000,
    '本週':   7 * 24 * 60 * 60 * 1000,
    '全部':   null,
  };
  const inRange = (s) => {
    const win = ranges[timeRange];
    if (!win) return true;
    const t = tsOf(s);
    if (t == null) return false;
    return (now - t) <= win;
  };
  const byCat = cat === '全部' ? allSources : allSources.filter(s => s.cat === cat);
  const byTime = timeRange === '全部' ? byCat : byCat.filter(inRange);
  const filtered = !q ? byTime : byTime.filter(s =>
    (s.title || '').toLowerCase().includes(q) ||
    (s.summary || '').toLowerCase().includes(q) ||
    (s.provider || '').toLowerCase().includes(q) ||
    (s.tag || '').toLowerCase().includes(q)
  );
  const rangeCounts = React.useMemo(() => {
    const r = {};
    Object.keys(ranges).forEach(k => {
      r[k] = k === '全部' ? byCat.length : byCat.filter(s => {
        const t = tsOf(s); if (t == null) return false;
        return (now - t) <= ranges[k];
      }).length;
    });
    return r;
  }, [byCat, now]);

  const highlight = (text) => {
    if (!q || !text) return text;
    const src = String(text);
    const lo = src.toLowerCase();
    const parts = [];
    let i = 0;
    while (i < src.length) {
      const idx = lo.indexOf(q, i);
      if (idx === -1) { parts.push(src.slice(i)); break; }
      if (idx > i) parts.push(src.slice(i, idx));
      parts.push(<mark key={parts.length} style={{background:'var(--accent-soft-2)', color:'var(--accent)', padding:'0 2px', borderRadius:3}}>{src.slice(idx, idx + q.length)}</mark>);
      i = idx + q.length;
    }
    return parts;
  };

  const BOOKMARK_KEY = 'ai-advisor-bookmarks-v1';
  const [bookmarks, setBookmarks] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '{}'); } catch { return {}; }
  });
  const [onlyBookmarked, setOnlyBookmarked] = React.useState(false);
  const bookmarkKeyOf = (s) => String(s.id || s.title || '').slice(0, 120);
  const toggleBookmark = (s) => {
    const k = bookmarkKeyOf(s);
    setBookmarks(prev => {
      const next = { ...prev };
      if (next[k]) {
        delete next[k];
        toast.info('已移除書籤');
      } else {
        next[k] = {
          title: s.title, provider: s.provider, cat: s.cat,
          link: s.link || null, savedAt: Date.now(),
        };
        toast.success('已加入書籤');
      }
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const isBookmarked = (s) => !!bookmarks[bookmarkKeyOf(s)];
  const bookmarkCount = Object.keys(bookmarks).length;

  const finalFiltered = onlyBookmarked ? filtered.filter(isBookmarked) : filtered;

  const [selectedId, setSelectedId] = React.useState(null);
  const selected = finalFiltered.find(s => (s.id || s.title) === selectedId) || finalFiltered[0] || DATA.sources[1];

  const liveCount = liveNews.length;
  const newsStatusLabel = {
    idle:'待連線', loading:'抓取新聞中', live:`即時 · ${liveCount} 則`, error:'新聞離線',
  }[newsStatus];
  const newsStatusColor = newsStatus === 'live' ? 'var(--pos)' : newsStatus === 'error' ? 'var(--neg)' : 'var(--text-3)';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>資料基底</h1>
          <p>AI 所有判斷的根基是這些公開資料。透明呈現:資料源、更新頻率、最近一次抓取時間,以及每一則資料對投資組合的影響。</p>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:11, color:newsStatusColor}}>
            <span className={'dot ' + (newsStatus==='live'?'pulse':'')} style={{width:6, height:6, borderRadius:'50%', background:newsStatusColor, display:'inline-block'}}/>
            {newsStatusLabel}{newsUpdatedAt && ` · ${RT.relTime(newsUpdatedAt)}`}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={refreshNews}><Icon name="refresh" size={14}/>同步最新</button>
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
            <div className="seg" title="依資料時間篩選">
              {Object.keys(ranges).map(r => (
                <button key={r} className={timeRange===r?'active':''} onClick={()=>setTimeRange(r)} title={`${r} 共 ${rangeCounts[r] ?? 0} 則`}>
                  {r}{timeRange===r && rangeCounts[r] != null && <span className="mono" style={{marginLeft:4, opacity:0.7, fontSize:10}}>{rangeCounts[r]}</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setOnlyBookmarked(v => !v)}
              title={onlyBookmarked ? '顯示全部' : '只看已收藏'}
              style={{
                padding:'4px 10px', fontSize:11,
                background: onlyBookmarked ? 'var(--accent-soft-2)' : 'var(--bg-2)',
                border:'1px solid ' + (onlyBookmarked ? 'var(--accent)' : 'var(--line)'),
                color: onlyBookmarked ? 'var(--accent)' : 'var(--text-2)',
                borderRadius:6, cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:6,
              }}
            >
              <span style={{fontSize:11}}>{onlyBookmarked ? '★' : '☆'}</span>
              書籤 {bookmarkCount > 0 && <span className="mono" style={{opacity:0.7}}>{bookmarkCount}</span>}
            </button>
            <div style={{marginLeft:'auto', position:'relative', display:'flex', alignItems:'center'}}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋標題、摘要、來源"
                style={{
                  width: 200, padding:'5px 26px 5px 10px', fontSize:11,
                  background:'var(--bg-2)', border:'1px solid var(--line)',
                  borderRadius:6, color:'var(--text-1)', outline:'none',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="清除搜尋"
                  style={{
                    position:'absolute', right:4, width:18, height:18,
                    display:'grid', placeItems:'center',
                    background:'transparent', border:0, cursor:'pointer',
                    color:'var(--text-3)',
                  }}
                ><Icon name="close" size={10}/></button>
              )}
            </div>
          </div>
          {q && (
            <div style={{padding:'6px 16px', borderBottom:'1px solid var(--line)', fontSize:10, color:'var(--text-3)', background:'var(--bg-2)'}}>
              找到 <b style={{color:'var(--text-1)'}}>{finalFiltered.length}</b> 則符合「<b style={{color:'var(--accent)'}}>{query}</b>」的資料
            </div>
          )}
          <div>
            {newsStatus === 'loading' && liveNews.length === 0 && (
              <div>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{padding:'14px 16px', borderBottom:'1px solid var(--line)'}}>
                    <div style={{display:'flex', gap:8, marginBottom:8}}>
                      <span className="skel" style={{width:34, height:16}}/>
                      <span className="skel" style={{width:48, height:16}}/>
                      <span className="skel" style={{width:70, height:12, marginLeft:'auto'}}/>
                    </div>
                    <div className="skel" style={{width:'85%', height:14, marginBottom:6}}/>
                    <div className="skel" style={{width:'35%', height:10}}/>
                  </div>
                ))}
              </div>
            )}
            {finalFiltered.length === 0 && newsStatus !== 'loading' && (
              <div className="empty-state">
                <div className="empty-icon"><Icon name="database" size={18}/></div>
                <div className="empty-title">
                  {onlyBookmarked ? '尚未收藏任何資料' : q ? '找不到符合的資料' : '此分類暫無資料'}
                </div>
                <div>
                  {onlyBookmarked ? '在任一則資料右上角點「☆」即可加入書籤。'
                    : q ? '試試其他關鍵字,或清除搜尋條件。'
                    : timeRange !== '全部' ? `試試放寬時間範圍,或切換至「全部」查看所有 ${byCat.length} 則。`
                    : '切換類別或點「同步最新」重新抓取。'}
                </div>
              </div>
            )}
            {finalFiltered.map((s, i) => {
              const key = s.id || s.title;
              const active = (selected.id || selected.title) === key;
              return (
                <div key={key || i} onClick={()=>setSelectedId(key)}
                     style={{padding:'14px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer', background: active?'var(--accent-soft-2)':'transparent', borderLeft: active?'2px solid var(--accent)':'2px solid transparent'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:4}}>
                    <span className="chip" style={{fontSize:10}}>{s.cat}</span>
                    <ImpactPill level={s.impact}/>
                    {s.live && <span className="chip accent" style={{fontSize:9, padding:'0 4px'}}><span className="dot pulse" style={{width:4, height:4}}/>即時</span>}
                    <span style={{fontSize:10, color:'var(--text-3)', marginLeft:'auto'}} className="mono">{s.ts}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(s); }}
                      aria-label={isBookmarked(s) ? '移除書籤' : '加入書籤'}
                      title={isBookmarked(s) ? '移除書籤' : '加入書籤'}
                      style={{
                        background:'transparent', border:0, padding:'0 2px',
                        cursor:'pointer', fontSize:13,
                        color: isBookmarked(s) ? 'var(--warn)' : 'var(--text-4)',
                      }}
                    >{isBookmarked(s) ? '★' : '☆'}</button>
                  </div>
                  <div style={{fontSize:13, color:'var(--text-0)', marginBottom:4, fontWeight:500}}>{highlight(s.title)}</div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <span className="source"><b>{highlight(s.provider)}</b></span>
                    <span style={{fontSize:10, color:'var(--text-3)'}}>· 標籤 {highlight(s.tag)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:'var(--density-gap)'}}>
            <div style={{display:'flex', gap:8, marginBottom:10, alignItems:'center'}}>
              <span className="chip">{selected.cat}</span>
              <ImpactPill level={selected.impact}/>
              <button
                onClick={() => toggleBookmark(selected)}
                title={isBookmarked(selected) ? '移除書籤' : '加入書籤'}
                aria-label={isBookmarked(selected) ? '移除書籤' : '加入書籤'}
                style={{
                  background:'transparent', border:'1px solid var(--line)',
                  padding:'2px 8px', fontSize:11, borderRadius:4, cursor:'pointer',
                  color: isBookmarked(selected) ? 'var(--warn)' : 'var(--text-3)',
                  display:'inline-flex', alignItems:'center', gap:4,
                }}
              >
                <span style={{fontSize:12}}>{isBookmarked(selected) ? '★' : '☆'}</span>
                {isBookmarked(selected) ? '已收藏' : '加入書籤'}
              </button>
              <span className="source" style={{marginLeft:'auto'}}><b>{selected.provider}</b></span>
            </div>
            <h3 style={{margin:'0 0 10px', fontSize:15, fontWeight:500, lineHeight:1.4}}>{highlight(selected.title)}</h3>
            <div style={{fontSize:11, color:'var(--text-3)', marginBottom:14}} className="mono">{selected.ts}</div>

            <div className="card-title" style={{fontSize:10, marginBottom:8}}>{selected.live ? '原文摘要' : 'AI 摘要'}</div>
            <p style={{margin:'0 0 14px', fontSize:12, color:'var(--text-1)', lineHeight:1.7}}>
              {selected.summary ? highlight(selected.summary) : 'Fed 3 月會議紀要顯示多數委員傾向在第二季維持利率不變,需要看到 CPI 連續 2 個月低於 2.5% 才會考慮降息。市場將此解讀為「偏鷹」,美債殖利率短線上升 8bps。'}
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
              {selected.link ? (
                <a className="btn" style={{flex:1, textDecoration:'none'}} href={selected.link} target="_blank" rel="noopener noreferrer"><Icon name="external" size={12}/>原始出處</a>
              ) : (
                <button className="btn" style={{flex:1}} disabled><Icon name="external" size={12}/>原始出處</button>
              )}
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
