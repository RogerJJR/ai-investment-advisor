// Theory page — Narrative Regimes framework (Chuang, 2026)
// Explains the theoretical basis of all AI recommendations in this app.

function Theory() {
  const regimes = [
    {
      id: 'expansion',
      name: '擴張 Expansion',
      color: '#22c55e',
      persistence: 0.95,
      summary: '股票風險溢酬為正、債券相關性低,是風險資產最受益的狀態。',
      avgEquity: '+10.0%',
      avgBond: '+2.5%',
      avgCommodity: '+5.0%',
      equityVol: '14–22%',
    },
    {
      id: 'contraction',
      name: '收縮 Contraction',
      color: '#eab308',
      persistence: 0.82,
      summary: '成長放緩、通膨降溫,公債開始 rally,股票報酬接近零或為負。',
      avgEquity: '−1.3% (avg)',
      avgBond: '+5.5%',
      avgCommodity: '−2.0%',
      equityVol: '20–28%',
    },
    {
      id: 'stress',
      name: '壓力 Stress',
      color: '#ef4444',
      persistence: 0.60,
      summary: '跨資產相關性同步趨近 1,僅主權債避險有效。最短命也最凶狠。',
      avgEquity: '−23.3% (avg)',
      avgBond: '+8.0%',
      avgCommodity: '0.0%',
      equityVol: '32–45%',
    },
  ];

  const pipeline = [
    { step: 1, title: '蒐集資訊', body: '報酬時間序列 rₜ + LLM 從新聞/央行/財報萃取的敘事訊號 sₜ。' },
    { step: 2, title: '貝氏更新 regime 後驗', body: '結合 return likelihood 與 narrative likelihood,每月更新 regime 機率分布 pₜ。' },
    { step: 3, title: '各 regime 解 MV 最適權重', body: '對每個 regime k 解 wₖ* = argmax μₖ′w − (γ/2) w′Σₖw,受 long-only 與上限 w̄ 約束。' },
    { step: 4, title: '後驗加權 + 慣性平滑', body: 'wₜ = Σ pₜ,ₖ · wₖ*,再以 λ=0.7 對前期權重平滑,減少無謂換手。' },
  ];

  const assetMap = [
    { paper: '美國股票', app: '美股 (VTI / VOO)' },
    { paper: '已開發非美股票', app: '全球 (VT)' },
    { paper: '新興市場股票', app: '台股 (0050 / 006208 / 2330)' },
    { paper: '長天期公債', app: '債券 (IEF / BND)' },
    { paper: '投資級公司債', app: '債券 (BND 含權重)' },
    { paper: '商品', app: '原物料 (GLD / SLV / IAUM)' },
    { paper: 'REITs', app: '(併入美股)' },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>

      {/* Hero */}
      <div className="card" style={{ padding: 32, marginBottom: 20 }}>
        <div className="mono-label" style={{ marginBottom: 6 }}>THEORETICAL BASIS</div>
        <h1 style={{ margin: '4px 0 10px 0', fontSize: 26, lineHeight: 1.3 }}>Narrative Regimes 框架</h1>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
          本 App 所有 AI 判斷的理論依據。以 LLM 強化型策略資產配置為核心,
          結合在線貝氏 regime filter 與 regime-policy-mix allocator,
          給長期(15 年以上)投資者使用的決策支援框架。
        </div>
        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn" href="narrative-regimes/release/narrative-regimes-v0.2.0-preprint.pdf" target="_blank" rel="noopener">
            <Icon name="download" size={12} /> <span style={{ marginLeft: 6 }}>完整論文 PDF (v0.2.0)</span>
          </a>
          <span style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center', marginLeft: 6 }}>
            Chuang, R. (2026). <i>Narrative Regimes: LLM-Augmented SAA for Long-Horizon Investors</i>.
          </span>
        </div>
      </div>

      {/* 1 Why */}
      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>1. 為什麼長期投資者需要 Narrative Regimes?</h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 10px 0' }}>
          傳統 mean-variance 與 risk parity 使用<b>無條件</b>報酬 moments,對市場情境視而不見。
          實證金融文獻(Hamilton 1989;Ang &amp; Bekaert 2002;Guidolin &amp; Timmermann 2007)顯示:
          金融市場存在持續、離散的 regime — 擴張期股票賺溢酬、收縮期公債 rally、壓力期跨資產相關性趨近 1。
          <b>能提前識別 regime 的投資者,其配置收益遠大於 MV 優化的邊際改善。</b>
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: 0 }}>
          近年 LLM 能從新聞、央行公告、研究報告萃取敘事訊號,但既有框架的三個缺陷:
          (i) look-ahead bias(LLM 訓練語料可能含評估期),
          (ii) 針對短線交易訊號、與 CRRA 長期效用機制脫節,
          (iii) 未量化「訊號品質需高到什麼程度才值得採納」。
          Narrative Regimes 框架就是為了同時處理這三件事。
        </p>
      </section>

      {/* 2 Three regimes */}
      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 14px 0' }}>2. 三個宏觀 Regime</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {regimes.map(r => (
            <div key={r.id} style={{
              border: '1px solid var(--line)', borderRadius: 8, padding: 14,
              background: 'var(--bg-2)', borderLeft: `3px solid ${r.color}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                持續性 P<sub>kk</sub> = <span className="mono">{r.persistence.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 12 }}>{r.summary}</div>
              <dl className="kv" style={{ gridTemplateColumns: '1fr auto', fontSize: 11, rowGap: 6 }}>
                <dt>股票年化</dt><dd>{r.avgEquity}</dd>
                <dt>公債年化</dt><dd>{r.avgBond}</dd>
                <dt>商品年化</dt><dd>{r.avgCommodity}</dd>
                <dt>股票波動</dt><dd>{r.equityVol}</dd>
              </dl>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-2)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
          Regime 演化為一階 Markov chain。轉移矩陣 <span className="mono">P</span> 的對角線為
          <span className="mono"> (0.95, 0.82, 0.60) </span>
          — 擴張期最持久、壓力期最短命(平均每 2.5 個月脫離)。
          完整模擬參數見論文 Appendix C。
        </div>
      </section>

      {/* 3 Bayesian filter */}
      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>3. 在線貝氏 Regime Filter</h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 14px 0' }}>
          每個月 t,根據新觀察到的報酬 rₜ 與 LLM 敘事訊號 sₜ,更新 regime 後驗機率:
        </p>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.9,
          padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 6,
          border: '1px solid var(--line)', color: 'var(--text-0)', marginBottom: 14,
          overflowX: 'auto',
        }}>
          p(zₜ = k | ℱₜ) ∝ p(zₜ = k | ℱₜ₋₁) · f(rₜ | μ̂ₖ, Σ̂ₖ) · g(sₜ | zₜ = k)
        </div>
        <dl className="kv" style={{ gridTemplateColumns: '140px 1fr', fontSize: 12, rowGap: 8 }}>
          <dt>第一項(prior)</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>由前一期後驗經 Markov 轉移矩陣 P 預測而來</dd>
          <dt>第二項(return)</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>regime-conditional 常態似然,(μ̂ₖ, Σ̂ₖ) 以 Welford 在線估計,僅用嚴格早於 t 的資訊</dd>
          <dt>第三項(narrative)</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>LLM 敘事訊號 sₜ 的似然,sₜ | zₜ=k ∼ 𝒩(eₖ, σ²I),σ² = 1/β</dd>
        </dl>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
          關鍵設計:三項嚴格分離、各自使用 t 時刻可得的資訊,杜絕 look-ahead 污染。
          β &gt; 0 是 SNR 精度參數,β 愈大表示 LLM 訊號愈可信。
        </div>
      </section>

      {/* 4 Allocator */}
      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>4. Regime-Policy-Mix 配置演算法</h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 14px 0' }}>
          有了 regime 後驗 pₜ,如何轉成權重?論文<b>不採用</b>「直接對 posterior mixture 做 MV」
          ,因為那會把 regime 異質性壓平、丟掉大部分避險訊號。改採「各 regime 解 MV、再依後驗加權」:
        </p>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.9,
          padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 6,
          border: '1px solid var(--line)', color: 'var(--text-0)', marginBottom: 14,
          overflowX: 'auto',
        }}>
          wₜ = Π_C ( Σₖ pₜ,ₖ · wₖ* ),&nbsp;&nbsp;wₖ* = argmax<sub>w∈C</sub> [ μₖ′w − (γ/2) w′Σₖw ]
        </div>
        <dl className="kv" style={{ gridTemplateColumns: '140px 1fr', fontSize: 12, rowGap: 8 }}>
          <dt>C(可行集)</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>1′w = 1、0 ≤ wᵢ ≤ w̄(long-only + 單一資產上限)</dd>
          <dt>γ(風險趨避)</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>CRRA 風險趨避參數,保守→積極對應 γ 由大到小</dd>
          <dt>μ̂ 的縮放</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>以 Ledoit–Wolf 向全域均值收縮,α = 0.2,抑制估計誤差</dd>
          <dt>權重慣性</dt><dd style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>wₜ ← λ·wₜ₋₁ + (1−λ)·wₜ,λ = 0.7 減少短期換手</dd>
        </dl>
      </section>

      {/* 5 SNR threshold */}
      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>5. 採納門檻 β* ≈ 1</h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', margin: '0 0 10px 0' }}>
          論文最務實的貢獻:量化「LLM 訊號要多準才值得用」。Monte Carlo 敏感度分析顯示
          SNR 採納門檻 β* ≈ 1。
        </p>
        <div style={{
          padding: 14, background: 'var(--bg-2)', borderRadius: 6,
          border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.75,
        }}>
          <div style={{ marginBottom: 6 }}><b style={{ color: 'var(--pos)' }}>β &gt; 1</b> — 納入 LLM 訊號提升配置品質(CRRA-CE 超越 risk parity)</div>
          <div style={{ marginBottom: 6 }}><b style={{ color: 'var(--neg)' }}>β &lt; 1</b> — 納入 LLM 訊號<b>反而傷害</b>配置,還不如不用</div>
          <div>β* ≈ 1 對應敘事訊號的 RMS 殘差 σ ≈ 1 個 regime 維度,是任何機構可用自家 pipeline 客觀評估的門檻</div>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
          基準配置下 Narrative Regimes 的 Sharpe 0.30、max drawdown −22.7%,優於 60/40(0.23, −38.7%)
          與 1/N(0.21, −41.9%),與 risk parity(0.28, −30.8%)相當但提供 regime 可解釋性。
        </div>
      </section>

      {/* 6 How it's embedded */}
      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 14px 0' }}>6. 本 App 怎麼落地?</h2>

        <h3 style={{ fontSize: 13, margin: '10px 0 8px 0', color: 'var(--text-1)' }}>6.1 七資產 → 六類別對應</h3>
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', marginBottom: 18 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--line)', fontWeight: 500, color: 'var(--text-3)' }}>論文七資產</th>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--line)', fontWeight: 500, color: 'var(--text-3)' }}>App 六類別</th>
              </tr>
            </thead>
            <tbody>
              {assetMap.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < assetMap.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <td style={{ padding: 10, color: 'var(--text-2)' }}>{row.paper}</td>
                  <td style={{ padding: 10, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.app}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 13, margin: '10px 0 8px 0', color: 'var(--text-1)' }}>6.2 配置顧問頁的四步驟</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {pipeline.map(p => (
            <div key={p.step} style={{
              display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12,
              padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 6,
              border: '1px solid var(--line)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
              }}>{p.step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)', marginBottom: 3 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          程式碼實作在 <span className="mono">realtime.js</span> 的 <span className="mono">RT.NarrativeRegimes</span> 模組,
          以及 <span className="mono">page_advisor.jsx</span> 的配置顧問頁面。Regime 後驗結果會顯示在
          <b> 配置建議 → 當前 Narrative Regime </b>卡片。
        </div>
      </section>

      {/* Footer — references */}
      <section className="card" style={{ padding: 20, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.9 }}>
        <div className="mono-label" style={{ marginBottom: 10 }}>REFERENCES</div>
        <div>Chuang, R. (2026). <i>Narrative Regimes: LLM-Augmented Strategic Asset Allocation for Long-Horizon Investors.</i> Preprint v0.2.0.</div>
        <div>Hamilton, J.D. (1989). A new approach to the economic analysis of nonstationary time series and the business cycle. <i>Econometrica.</i></div>
        <div>Ang, A., Bekaert, G. (2002). International asset allocation with regime shifts. <i>Review of Financial Studies.</i></div>
        <div>Guidolin, M., Timmermann, A. (2007). Asset allocation under multivariate regime switching. <i>Journal of Economic Dynamics and Control.</i></div>
        <div>Ledoit, O., Wolf, M. (2004). Honey, I shrunk the sample covariance matrix. <i>Journal of Portfolio Management.</i></div>
      </section>

    </div>
  );
}

window.Theory = Theory;
