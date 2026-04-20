// Shared mock data for the whole app
const DATA = {
  user: {
    name: '王冠宇',
    initials: '冠',
    riskLevel: 'moderate', // conservative | moderate | aggressive
    totalAssets: 2847650,   // TWD
    monthlyContribution: 30000,
    horizon: 15, // years
  },

  // Current allocation
  holdings: [
    { id: 'h1', symbol: '0050',    name: '元大台灣50',         type: '台股ETF',  shares: 3200,  price: 178.45, cost: 142.30, sector: '台股',   weight: 20.0 },
    { id: 'h2', symbol: '006208',  name: '富邦台50',           type: '台股ETF',  shares: 2100,  price: 105.80, cost: 88.40,  sector: '台股',   weight: 7.8  },
    { id: 'h3', symbol: '2330',    name: '台積電',             type: '台股',     shares: 80,    price: 985.00, cost: 620.00, sector: '台股',   weight: 2.8  },
    { id: 'h4', symbol: 'VT',      name: 'Vanguard Total World',type: '全球ETF', shares: 220,   price: 118.20, cost: 92.40,  sector: '全球',   weight: 9.1  },
    { id: 'h5', symbol: 'VTI',     name: 'Vanguard Total US',  type: '美股ETF',  shares: 180,   price: 272.10, cost: 215.60, sector: '美股',   weight: 17.2 },
    { id: 'h6', symbol: 'VOO',     name: 'Vanguard S&P 500',   type: '美股ETF',  shares: 95,    price: 518.40, cost: 398.20, sector: '美股',   weight: 17.3 },
    { id: 'h7', symbol: 'BND',     name: 'Vanguard Total Bond',type: '債券ETF',  shares: 340,   price: 74.80,  cost: 77.20,  sector: '債券',   weight: 8.9  },
    { id: 'h8', symbol: 'IEF',     name: '7-10年美債 ETF',     type: '債券ETF',  shares: 120,   price: 96.40,  cost: 99.30,  sector: '債券',   weight: 4.1  },
    { id: 'h9', symbol: 'GLD',     name: 'SPDR Gold',          type: '黃金ETF',  shares: 80,    price: 238.60, cost: 185.00, sector: '原物料', weight: 6.8  },
    { id: 'h10',symbol: 'CASH',    name: '台幣活存 / 定存',    type: '現金',     shares: 1,     price: 168500,cost: 168500,  sector: '現金',   weight: 5.9  },
  ],

  // Asset class targets (AI 建議 vs 現況)
  allocation: [
    { name: '美股',   current: 34.5, target: 30, color: '#22d3ee' },
    { name: '台股',   current: 30.6, target: 22, color: '#a78bfa' },
    { name: '全球',   current:  9.1, target: 12, color: '#60a5fa' },
    { name: '債券',   current: 13.0, target: 20, color: '#fbbf24' },
    { name: '原物料', current:  6.8, target:  8, color: '#f472b6' },
    { name: '現金',   current:  5.9, target:  8, color: '#94a3b8' },
  ],

  // 宏觀資料 (snapshot)
  macro: [
    { label: '台灣 CPI',       value: '2.14%',  delta: '-0.08',  trend: 'down',  source: 'DGBAS',       updated: '2026/04' },
    { label: '美國 CPI',       value: '3.02%',  delta: '+0.11',  trend: 'up',    source: 'BLS',         updated: '2026/04' },
    { label: 'Fed 基準利率',   value: '4.25%',  delta: '0',      trend: 'flat',  source: 'FOMC',        updated: '2026/03' },
    { label: '央行重貼現率',   value: '2.00%',  delta: '0',      trend: 'flat',  source: '中央銀行',    updated: '2026/03' },
    { label: '美國 10Y 殖利率',value: '4.18%',  delta: '+0.22',  trend: 'up',    source: 'CBOE',        updated: '2026/04' },
    { label: 'VIX 恐慌指數',   value: '17.8',   delta: '+2.1',   trend: 'up',    source: 'CBOE',        updated: '2026/04' },
    { label: 'USD/TWD',        value: '32.18',  delta: '-0.08',  trend: 'down',  source: 'TPEX',        updated: '2026/04' },
    { label: 'CRB 商品指數',   value: '318.4',  delta: '+1.8',   trend: 'up',    source: 'CRB',         updated: '2026/04' },
  ],

  // AI 判斷事件
  signals: [
    {
      id: 's1',
      level: 'high',
      type: 'rebalance',
      title: '債券部位低於目標配置 7 個百分點',
      summary: '美 10Y 殖利率回升至 4.18%,債券價格下修,但你的債券部位仍低於長期目標 20%。建議分批加碼 BND / IEF 約 NT$186,000。',
      confidence: 82,
      triggers: ['yield-rise', 'under-weight'],
      action: 'buy',
      magnitude: 'NT$186,000',
      time: '2 小時前',
    },
    {
      id: 's2',
      level: 'medium',
      type: 'concentration',
      title: '台股部位偏高,集中風險提升',
      summary: '現金加計 0050/006208/2330 合計已佔 30.6%,超過目標 8.6pp。Fed 與台央行利差擴大可能帶動資金外流,建議分 3 個月減碼。',
      confidence: 68,
      triggers: ['over-weight', 'correlation-up'],
      action: 'sell',
      magnitude: 'NT$244,000',
      time: '今日 09:12',
    },
    {
      id: 's3',
      level: 'info',
      type: 'news',
      title: '台積電 Q1 財報優於預期,HBM 營收年增 162%',
      summary: '財報顯示毛利率回升至 53.4%,但已反映於股價(近月 +18%)。不影響長期持有判斷,不建議加碼。',
      confidence: 91,
      triggers: ['earnings'],
      action: 'hold',
      magnitude: '—',
      time: '昨日 14:40',
    },
    {
      id: 's4',
      level: 'low',
      type: 'macro',
      title: '黃金創新高後動能放緩',
      summary: 'GLD 已達目標配置 8% 附近,短期 RSI 過熱(78)。可等待回落 3-5% 再補,不急於追高。',
      confidence: 74,
      triggers: ['rsi-high', 'target-reached'],
      action: 'hold',
      magnitude: '—',
      time: '2 天前',
    },
  ],

  // Rebalance plan
  rebalancePlan: [
    { symbol: '2330',  name: '台積電',      action: 'sell', shares: 20,  amount: 19700,  pct: -0.7, reason: '集中度過高' },
    { symbol: '0050',  name: '元大台灣50',  action: 'sell', shares: 800, amount: 142760, pct: -5.0, reason: '超過目標權重' },
    { symbol: 'BND',   name: 'Total Bond',  action: 'buy',  shares: 420, amount: 101218, pct: +3.5, reason: '低於目標權重' },
    { symbol: 'IEF',   name: '7-10Y Treas', action: 'buy',  shares: 200, amount: 62026,  pct: +2.1, reason: '再平衡' },
    { symbol: 'VT',    name: 'Total World', action: 'buy',  shares:  45, amount: 171140, pct: +2.9, reason: '擴大全球曝險' },
  ],

  // Data source feed
  sources: [
    { cat: '總經', title: '主計總處 4 月 CPI 年增率', ts: '2026/04/18 09:30', tag: 'macro',  impact: 'low',    provider: 'DGBAS' },
    { cat: '央行', title: 'Fed 3 月會議紀要:利率維持 data-dependent', ts: '2026/04/16 02:00', tag: 'policy', impact: 'high', provider: 'FOMC' },
    { cat: '財報', title: 'TSMC Q1 EPS NT$14.32,高於市場預期 8%', ts: '2026/04/17 15:30', tag: 'earnings', impact: 'medium', provider: 'Reuters' },
    { cat: '評等', title: '大摩上修台積電目標價至 NT$1,180', ts: '2026/04/17 11:00', tag: 'analyst', impact: 'low', provider: 'Morgan Stanley' },
    { cat: '新聞', title: '美國對半導體加徵關稅案再延後', ts: '2026/04/16 22:10', tag: 'news', impact: 'medium', provider: 'Bloomberg' },
    { cat: 'ETF', title: 'VT 新增成分股 24 檔,剔除 8 檔',  ts: '2026/04/15 00:00', tag: 'etf',  impact: 'low', provider: 'Vanguard' },
    { cat: '情緒', title: 'AAII 散戶看多比例降至 28%,低於歷史均值', ts: '2026/04/14', tag: 'sentiment', impact: 'low', provider: 'AAII' },
    { cat: '技術', title: '台股加權指數 MACD 出現背離訊號', ts: '2026/04/17', tag: 'technical', impact: 'medium', provider: 'TradingView' },
  ],

  // Backtest years
  backtest: {
    years: [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    portfolio: [8.2, 14.1, -4.8, 19.6, 15.4, 22.1, -12.3, 18.9, 14.2, 10.8],
    benchmark: [10.2, 12.8, -6.1, 22.3, 18.7, 18.5, -18.2, 21.4, 16.1, 8.4],
  },
};

window.DATA = DATA;

// Helper formatters
window.fmt = {
  tw: (n) => 'NT$' + Math.round(n).toLocaleString(),
  pct: (n, digits=1) => (n>=0?'+':'') + n.toFixed(digits) + '%',
  num: (n, digits=2) => n.toLocaleString(undefined, {minimumFractionDigits: digits, maximumFractionDigits: digits}),
};
