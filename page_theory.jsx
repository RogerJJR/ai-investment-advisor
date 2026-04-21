// Theory page — Narrative Regimes (Chuang 2026) 白話版
// Source: Narrative-Regimes-Investor-Deck.pptx (15 slides)

const NR_GLOSSARY = [
  ['SAA 戰略資產配置', '決定長期要把錢分成多少比例放股、債、商品、現金。'],
  ['60/40', '最經典的配置:60% 股、40% 債,一路擺。'],
  ['1/N 等權重', '每個資產類別平均分配。'],
  ['風險平價 Risk Parity', '讓每類資產對投組的「風險貢獻」相同,而不是金額相同。'],
  ['Regime 體制', '市場狀態。本框架分 3 種:擴張、收縮、壓力。'],
  ['貝式濾波器', '用「新證據」更新「機率」的方法。這裡是更新「現在處於哪個 regime」的機率。'],
  ['後驗機率 p(z|F)', '看完所有資訊後,各 regime 的機率分布(例如擴張 52% / 收縮 35% / 壓力 13%)。'],
  ['前視偏差 Look-ahead bias', 'AI 偷看到未來答案。很多 AI 金融論文被這個污染,績效被高估。'],
  ['Welford 遞迴', '只用「現在之前」的資料做在線統計,不會偷看未來。'],
  ['Ledoit-Wolf 收縮', '把估計的均值/共變異往「全體平均」拉一點,減少雜訊。'],
  ['CRRA 效用', '長期投資人標準的效用函數。懲罰大賠,不怕小賠。'],
  ['CRRA-CE 確定性等值', '「相當於多少無風險報酬」。2.8% CE ≈ 這個波動策略 = 無風險穩穩拿 2.8%。'],
  ['Sharpe Ratio', '每多冒一單位風險、可換到多少超額報酬。越大越好。'],
  ['最大回撤 Max Drawdown', '從高點跌到低點的最大跌幅。越接近 0 越好。'],
  ['換手率 Turnover', '每月買賣金額佔投組比例。越低交易成本越省。'],
  ['β(訊噪比)', 'AI 訊號的「準度」。β 越大越準;β* ≈ 1 是採用門檻。'],
  ['Monte-Carlo 蒙地卡羅', '用電腦隨機模擬多條路徑,看策略表現的分布。'],
  ['消融實驗 Ablation', '把某個元件拿掉,看績效差多少,用來驗證那個元件真的有貢獻。'],
  ['Markov chain', '一種狀態演化規則:下一期只跟當期有關,不回頭看更早。'],
  ['權重慣性 λ', '新權重與上期權重混合比例。λ=0.7 表示 70% 沿用上期、30% 採用新建議。'],
];

function Section({ title, children, num }) {
  return (
    <section className="card" style={{ padding: 24, marginBottom: 16 }}>
      {num && <div className="mono-label" style={{ marginBottom: 4 }}>SECTION {num}</div>}
      <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>{title}</h2>
      {children}
    </section>
  );
}

function Plain({ children }) {
  return (
    <div style={{
      padding: '10px 14px', background: 'rgba(34,197,94,0.08)',
      borderLeft: '3px solid #22c55e', borderRadius: 4,
      fontSize: 12, color: 'var(--text-1)', lineHeight: 1.7, margin: '8px 0',
    }}>
      <b style={{ color: '#22c55e', fontSize: 11 }}>白話</b> &nbsp;{children}
    </div>
  );
}

function Jargon({ term, children }) {
  return (
    <span title={children} style={{
      borderBottom: '1px dotted var(--text-3)', cursor: 'help',
    }}>{term}</span>
  );
}

function Theory() {
  const [showGlossary, setShowGlossary] = React.useState(false);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>

      {/* Hero */}
      <div className="card" style={{ padding: 32, marginBottom: 20 }}>
        <div className="mono-label" style={{ marginBottom: 6 }}>RESEARCH BRIEFING · 2026</div>
        <h1 style={{ margin: '4px 0 10px 0', fontSize: 28, lineHeight: 1.25 }}>Narrative Regimes</h1>
        <div style={{ fontSize: 15, color: 'var(--text-1)', lineHeight: 1.65, marginBottom: 14 }}>
          以 AI 敘事訊號強化長期投資人的戰略資產配置
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 16px 0' }}>
          給主權基金、退休金、大學捐贈基金、長期家族辦公室與個人退休投資者的一份<b>決策支援框架</b> —
          可審計、可復現、可量化「AI 訊號何時才值得採用」的門檻。
          本 App 所有 AI 配置建議的理論依據。
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn" href="Narrative-Regimes-Investor-Deck.pptx" target="_blank" rel="noopener">
            <Icon name="download" size={12} /> <span style={{ marginLeft: 6 }}>投資人簡報 PPTX</span>
          </a>
          <a className="btn" href="narrative-regimes/release/narrative-regimes-v0.2.0-preprint.pdf" target="_blank" rel="noopener">
            <Icon name="download" size={12} /> <span style={{ marginLeft: 6 }}>學術論文 PDF</span>
          </a>
          <button className="btn ghost" onClick={() => setShowGlossary(v => !v)}>
            <Icon name="book" size={12}/> <span style={{ marginLeft: 6 }}>{showGlossary ? '隱藏' : '開啟'}名詞白話表</span>
          </button>
        </div>
      </div>

      {/* Plain summary */}
      <div className="card" style={{ padding: 24, marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: 14, margin: '0 0 10px 0' }}>一分鐘看懂</h3>
        <p style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--text-2)', margin: 0 }}>
          把市場分成三種狀態 — <b>擴張、收縮、壓力</b>,每個月用「報酬數據 + AI 從新聞讀出的訊號」
          更新「現在最像哪種狀態」的機率;再為每種狀態分別算最佳資產配置、按機率混合。
          和主流「一種配置吃天下」(60/40、風險平價)相比,最大回撤接近減半,報酬/風險比全面勝出。
          <b>每一次調整都能追溯到「是哪個狀態、多少信心、哪條新聞觸發的」</b>,不是黑盒子。
        </p>
      </div>

      {/* Section 1: Problem */}
      <Section num="01" title="問題:長期投資最重要的決策,目前還在用「不分景氣」的工具">
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 10px 0' }}>
          主流配置工具 — <Jargon term="60/40">60% 股、40% 債,長期不變</Jargon>、
          <Jargon term="1/N">每類資產平均分配</Jargon>、
          <Jargon term="風險平價">讓每類資產的風險貢獻相等</Jargon>、
          Markowitz 均值變異數 — 全部有同一個盲點:
          <b>把「擴張、收縮、壓力」三種完全不同的市場,當成同一個市場來最佳化。</b>
        </p>
        <Plain>
          你不會用同一套開車方式應對晴天、下雨、颱風 —
          那為什麼要用同一個資產配置比例應對 2017 年擴張、2022 年通膨收縮、與 2020 年疫情壓力?
        </Plain>
        <dl className="kv" style={{ gridTemplateColumns: '140px 1fr', fontSize: 12, rowGap: 8, marginTop: 12 }}>
          <dt>體制真的會切換</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>
            Hamilton (1989)、Ang &amp; Bekaert (2002) 的實證:市場確實有離散體制,報酬、相關性、波動都不同。
          </dd>
          <dt>利益很大</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>
            Guidolin &amp; Timmermann (2007):能在市場反應「轉折」前先辨識體制,
            收益比任何 MV 優化的邊際改善大一個數量級。
          </dd>
          <dt>但機構沒工具</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>
            體制訊號散在央行語言、分析師筆記、總體報告裡,投委會無法即時整合 — 只能事後歸因。
          </dd>
        </dl>
      </Section>

      {/* Section 2: Why now / 3 traps */}
      <Section num="02" title="為什麼是現在?AI 帶來機會,但多數「AI + 投資」有三個陷阱">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            ['陷阱 01', '看空未來(Look-Ahead)', 'AI 訓練資料已包含未來,Glasserman & Lin (2023) 證明這讓已發表績效嚴重高估。許多爆款論文都有此問題。'],
            ['陷阱 02', '只關心短線', '多數 AI 金融研究聚焦「下一週股價方向」,沒接上長期投資人的 CRRA 效用與跨期避險決策機器。'],
            ['陷阱 03', '沒給採用門檻', '要不要導入 AI 訊號?幾乎所有論文只給「vs 基準的超額報酬」,從未回答「我的 AI 要多準,才值得用?」'],
          ].map(([tag, title, body], i) => (
            <div key={i} style={{
              padding: 14, border: '1px solid var(--line)', borderRadius: 8,
              background: 'var(--bg-2)',
            }}>
              <div className="mono-label" style={{ marginBottom: 6, color: 'var(--neg)' }}>{tag}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-2)', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.75 }}>
          <b style={{ color: 'var(--text-1)' }}>真正的問題</b>:投委會想知道「要不要把 AI 嵌入 SAA 流程、什麼條件下值得、出問題能不能追溯」 —
          這是<b>決策支援問題</b>,不是預測準確率競賽。
        </div>
      </Section>

      {/* Section 3: Solution 3 parts */}
      <Section num="03" title="解法:三件事合起來,而且每一件都「不偷看未來」">
        <Plain>
          我們把整個問題拆成三個小工具,每個都有明確任務、可以單獨驗證。
          三個合起來就是一台「會自己判斷景氣、也會自己換配置」的決策機器。
        </Plain>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
          {[
            {
              tag: '工具 A',
              title: '線上貝式濾波器',
              plain: '每個月拿「這個月的報酬」和「這個月的新聞訊號」更新一次:現在最像哪個 regime 的機率分布。',
              detail: <><Jargon term="Welford 遞迴">只用過去資料做統計,絕不看未來</Jargon>。輸出是 <Jargon term="後驗機率 p(z|F)">看完所有證據後,各 regime 的機率</Jargon>。</>
            },
            {
              tag: '工具 B',
              title: 'Regime 條件混合配置',
              plain: '為「擴張、收縮、壓力」分別算好最佳權重;當下配置 = 機率加權混合 + 70% 沿用上月。',
              detail: <><Jargon term="權重慣性 λ">λ = 0.7</Jargon> 降低換手、<Jargon term="Ledoit-Wolf 收縮">共變異收縮</Jargon>降低雜訊、長多不放空、單一資產上限 60%。</>
            },
            {
              tag: '工具 C',
              title: '可復現 Monte-Carlo 沙盒',
              plain: '用電腦模擬一萬條未來市場路徑,統計策略在各種情境下的表現分布,不只看單一歷史。',
              detail: <>每條路徑用<Jargon term="Markov chain">Markov 轉移</Jargon>生成 regime 序列,再模擬報酬與訊號;<Jargon term="Monte-Carlo 蒙地卡羅">Monte-Carlo</Jargon>看分布,不是看單一樣本。</>
            },
          ].map((x, i) => (
            <div key={i} style={{
              padding: 14, border: '1px solid var(--line)', borderRadius: 8,
              background: 'var(--bg-2)',
            }}>
              <div className="mono-label" style={{ marginBottom: 6, color: 'var(--accent)' }}>{x.tag}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{x.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.75, marginBottom: 8 }}>{x.plain}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, paddingTop: 8, borderTop: '1px dashed var(--line)' }}>{x.detail}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 4: 4-step plain */}
      <Section num="04" title="運作四步驟:每個月一次,四件事做完換完配置">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 4 }}>
          {[
            { n: '01', h: '讀市場', body: '統計這個月的報酬、波動、相關性;用 Welford 只看過去,不偷看未來。' },
            { n: '02', h: '讀新聞', body: '把央行語言、總體報告、分析師筆記交給 LLM,萃取「擴張 / 收縮 / 壓力」三類敘事強度。' },
            { n: '03', h: '更新機率', body: '貝式濾波器把「報酬證據」與「新聞證據」合起來更新:現在是哪個 regime、機率多少。' },
            { n: '04', h: '混合配置', body: '用機率加權三個 regime 的最佳權重,加上 70% 沿用上月,產出本月的目標配置。' },
          ].map((x, i) => (
            <div key={i} style={{
              padding: 12, border: '1px solid var(--line)', borderRadius: 8,
              background: 'var(--bg-2)', position: 'relative',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>STEP {x.n}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{x.h}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.7 }}>{x.body}</div>
            </div>
          ))}
        </div>
        <Plain>
          關鍵在第 3 步:不是直接「猜」一個 regime,而是輸出「機率分布」—
          這樣第 4 步才能平滑混合,避免某個月突然從 60/40 跳到全壓股票、下個月又跳回來的劇烈換手。
        </Plain>
      </Section>

      {/* Section 5: Results */}
      <Section num="05" title="實測結果:最大回撤接近減半,報酬/風險比全面勝出">
        <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 6, marginBottom: 12 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                {['策略', '年化報酬', 'Sharpe', '最大回撤', '換手率/月', 'CRRA-CE'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--line)', fontWeight: 500, color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['60/40',          '5.8%', '0.24', '-34.2%', '0.8%', '2.11%', false],
                ['1/N 等權重',     '6.4%', '0.22', '-38.9%', '1.2%', '1.98%', false],
                ['風險平價',       '5.2%', '0.28', '-22.4%', '2.4%', '2.43%', false],
                ['Narrative Regime (本框架)', '7.1%', '0.32', '-18.7%', '3.1%', '3.04%', true],
              ].map(([name, ret, sh, mdd, to, ce, highlight], i) => (
                <tr key={i} style={{
                  borderBottom: i < 3 ? '1px solid var(--line)' : 'none',
                  background: highlight ? 'rgba(34,197,94,0.06)' : 'transparent',
                }}>
                  <td style={{ padding: '10px 12px', fontWeight: highlight ? 600 : 400, color: highlight ? 'var(--pos)' : 'var(--text-1)' }}>{name}</td>
                  <td style={{ padding: '10px 12px' }} className="mono">{ret}</td>
                  <td style={{ padding: '10px 12px' }} className="mono">{sh}</td>
                  <td style={{ padding: '10px 12px' }} className="mono">{mdd}</td>
                  <td style={{ padding: '10px 12px' }} className="mono">{to}</td>
                  <td style={{ padding: '10px 12px', fontWeight: highlight ? 600 : 400 }} className="mono">{ce}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Plain>
          <b>CRRA-CE 3.04%</b> 的意思:對長期投資人而言,這套策略相當於「無風險穩穩每年拿 3.04%」 —
          贏過風險平價(2.43%)、60/40(2.11%)。最大回撤 -18.7% vs 60/40 的 -34.2%,幾乎砍半。
          <br/>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>資料期間:2000-01 ~ 2024-12,月頻再平衡,含 0.2% 單邊交易成本。</span>
        </Plain>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
          {[
            { v: '+43%', h: 'CRRA-CE 提升', sub: '相對 60/40,對長期投資人等效於「每年多拿 0.93%」無風險報酬' },
            { v: '-15.5pp', h: '最大回撤改善', sub: '-34.2% → -18.7%,壓力期損失接近減半' },
            { v: '>70%', h: 'Regime 辨識準度', sub: '關鍵轉折點(2008、2020、2022)全部提前 1-2 個月辨識' },
          ].map((x, i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)' }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--pos)', marginBottom: 4 }}>{x.v}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{x.h}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.65 }}>{x.sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 6: β* threshold */}
      <Section num="06" title="β* 採用門檻:「AI 訊號要多準才值得用」—— 第一次有明確答案">
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 10px 0' }}>
          以往投委會導入 AI 訊號都只能憑直覺 — 這份研究用 <Jargon term="β(訊噪比)">訊噪比 β</Jargon> 量化「訊號精準度」,
          直接告訴你不同 β 下該不該採用:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
          {[
            {
              label: 'β ≤ 0.5',
              verdict: '不要用',
              color: 'var(--neg)',
              body: '訊號雜訊多於資訊,強行納入反而拖累 CRRA-CE。保守做法:繼續使用風險平價即可。',
            },
            {
              label: 'β ≈ 1',
              verdict: '門檻',
              color: 'var(--text-1)',
              body: 'CRRA-CE 開始顯著超越基準。這是論文推薦的最低採用門檻 β*,也是本 App 的採用前提。',
            },
            {
              label: 'β ≥ 2',
              verdict: '強烈推薦',
              color: 'var(--pos)',
              body: '每提升一單位 β,CRRA-CE 約多 0.3-0.5%。長期複利下差距驚人。',
            },
          ].map((x, i) => (
            <div key={i} style={{
              padding: 14, border: `1px solid ${x.color === 'var(--text-1)' ? 'var(--line)' : x.color}`, borderRadius: 8,
              background: 'var(--bg-2)',
            }}>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: x.color, marginBottom: 4 }}>{x.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: x.color, marginBottom: 8 }}>{x.verdict}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.7 }}>{x.body}</div>
            </div>
          ))}
        </div>
        <Plain>
          這是方法論上的突破:從「AI 信不信得過?」(感性問題)變成「β 有沒有過 1?」(可度量問題)。
          本 App 採用的 LLM pipeline 實測 β ≈ 1.2,剛好過門檻 — 因此配置建議會真實採用 AI 訊號,
          但若 β 退化到 {'<'} 1,系統會自動退回到 regime-agnostic 基準配置,保守先行。
        </Plain>
      </Section>

      {/* Section 7: 5 principles */}
      <Section num="07" title="投委會導入原則:五件事缺一不可">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            ['01', '可審計 Auditable', '每一次配置調整都要能回答「是哪個 regime、信心多少、哪些證據觸發」,不是黑盒子。'],
            ['02', '可復現 Reproducible', '同樣資料 + 同樣程式,不同人跑出同樣結果。本研究釋出完整 code + seed。'],
            ['03', '無前視偏差 No Look-ahead', '所有統計、模型、訊號,一律只用 t 時點之前的資訊 — Welford、rolling window、walk-forward 驗證。'],
            ['04', '有明確採用門檻 β*', '不過 β* 就不採用。拒絕「因為是 AI 所以就用」的心態。'],
            ['05', '風險先行', '長多不放空、單一資產上限、交易成本全計入、CRRA 效用下評估 — 不是追求帳面 Sharpe 最大化。'],
          ].map(([n, h, body]) => (
            <div key={n} style={{
              padding: 14, border: '1px solid var(--line)', borderRadius: 8,
              background: 'var(--bg-2)', display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div className="mono" style={{
                fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                minWidth: 28, textAlign: 'center',
              }}>{n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{h}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 8: Honest disclosure */}
      <Section num="08" title="誠實揭露:這個框架不適合什麼,限制是什麼">
        <Plain>
          這不是穩賺不賠的聖杯。以下限制都坦白告訴你 —
          若你的需求落在「不適合」那邊,請不要採用,或採用前先自行加上保護措施。
        </Plain>
        <dl className="kv" style={{ gridTemplateColumns: '160px 1fr', fontSize: 12, rowGap: 10, marginTop: 12 }}>
          <dt style={{ color: 'var(--neg)' }}>不適合短線交易</dt>
          <dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)', lineHeight: 1.75 }}>
            本框架月頻再平衡、為長期 CRRA 效用設計。日內 / 週頻的 Alpha 策略請別套用。
          </dd>
          <dt style={{ color: 'var(--neg)' }}>Regime 切換慢一拍</dt>
          <dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)', lineHeight: 1.75 }}>
            貝式濾波器是「平滑」不是「預測」— 快速閃崩(如 2020/03)會承受 1-2 個月的滯後,
            雖然透過權重慣性 λ 與長多限制壓低損失,但無法完全避免。
          </dd>
          <dt style={{ color: 'var(--neg)' }}>新聞訊號會失效</dt>
          <dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)', lineHeight: 1.75 }}>
            若 LLM 品質退化、新聞來源污染、語言分布偏移,β 會下降。系統會在 β &lt; β* 時自動退回基準配置,
            但投委會仍應每季重新校準 β。
          </dd>
          <dt style={{ color: 'var(--neg)' }}>未納入流動性風險</dt>
          <dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)', lineHeight: 1.75 }}>
            6 類資產都假設流動性充足。若配置涵蓋私募 / 另類投資,需另行計入流動性折價。
          </dd>
          <dt style={{ color: 'var(--neg)' }}>不保證未來</dt>
          <dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)', lineHeight: 1.75 }}>
            2000-2024 的回測結果不代表未來必然複製。若市場結構發生質變(如 regime 數從 3 變 5),
            需重新訓練濾波器。
          </dd>
        </dl>
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
          <b style={{ color: 'var(--pos)' }}>本 App 的定位</b>:這不是自動交易系統,而是<b>決策支援介面</b>。
          所有建議都可追溯到 regime、信心度、驅動因子,投委會保留最終決策權。
          AI 是副駕駛,不是主駕駛。
        </div>
      </Section>

      {showGlossary && (
        <Section num="ℹ" title="專業名詞白話對照表">
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--line)', fontWeight: 500, color: 'var(--text-3)', width: 180 }}>術語</th>
                  <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--line)', fontWeight: 500, color: 'var(--text-3)' }}>白話</th>
                </tr>
              </thead>
              <tbody>
                {NR_GLOSSARY.map(([term, plain], i) => (
                  <tr key={i} style={{ borderBottom: i < NR_GLOSSARY.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <td style={{ padding: 10, color: 'var(--text-1)', fontWeight: 500 }}>{term}</td>
                    <td style={{ padding: 10, color: 'var(--text-2)', lineHeight: 1.7 }}>{plain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

window.Theory = Theory;
window.NR_GLOSSARY = NR_GLOSSARY;
