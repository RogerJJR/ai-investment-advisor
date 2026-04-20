# 中文摘要 — Narrative Regimes

## 題目
**敘事型 Regime:長期投資者 LLM 強化型策略資產配置**

## 摘要(約 400 字)

長期投資者(退休金、主權基金、校務基金、個人退休儲蓄)面對的決策難題,
是一個標準 mean-variance 或 risk-parity 架構處理不佳的問題:策略資產配置
(SAA)必須反映**正在演變中的總體經濟 regime**,而非陳舊的無條件動差。近年
研究顯示,大型語言模型(LLM)能從非結構化新聞中蒸餾出經濟上有意義的信號,
但現有應用多聚焦於短期交易信號,且少有人面對「LLM 訓練語料過往資料導致的
look-ahead 污染」這項方法論根本性挑戰。

本文提出 **Narrative Regimes** 決策支援框架。框架融合 LLM 蒸餾的敘事信號與
基於歷史報酬的 rolling 估計,通過一套線上貝氏 regime filter 產生 regime
posterior;再以 regime-policy-mix 配置器(對每個 regime 分別求 mean-variance
最佳權重,再按 posterior 加權)產生兼顧 regime 異質性的 CRRA 導向配置。

我們採用 Monte Carlo 評估平台,完全控制 ground truth 與信號品質,從結構上
排除 look-ahead 污染。在 30 條獨立路徑、7 資產長期配置世界的實驗中,框架將
regime 分類準確率由 50% 提升至 61%(+11 pp);在 Sharpe ratio 上達到 0.26
(SE 0.03),顯著勝過 60/40(0.23)與 1/N(0.22),並與 inverse-volatility
risk parity(0.28)相當;最大回撤較 60/40 降低 38%。CRRA 確定等值年化報酬
2.4%,勝 60/40(1.1%)與 1/N(0.7%),略低於 risk parity(2.6%),但我方
框架的每一次再平衡都具備 regime 歸因的可解釋性,是投資委員會可審查的決策
透明性。

敏感度分析進一步確立**訊雜比(SNR)採用閾值 β* ≈ 1**:當 LLM 信號品質低於
此閾值時,加入 narrative 反而有害;高於此閾值才帶來穩健效益。此閾值為機構
提供了可量化的採用準則,能在其內部 LLM pipeline 上做驗證。

**貢獻**:(1) 首度將 LLM 敘事信號嵌入長期投資者貝氏 regime 濾波 + 保留
regime 異質性的配置器;(2) 簡潔的模擬評估方法,結構上免除 look-ahead
污染;(3) 對機構提供可操作的 SNR 採用門檻;(4) 完整開源實作與複製包 (MIT
授權)。

## 關鍵字

策略資產配置、大型語言模型、regime switching、貝氏濾波、決策支援系統、
長期投資者、CRRA、交易成本敏感度。

## 主要結果速覽

| 策略 | Sharpe | Max DD | CRRA-CE | 月換手率 |
| --- | --- | --- | --- | --- |
| **Narrative Regimes** | **0.26 (0.03)** | **-24.1%** | **2.4%** | **30%** |
| Regime Only(消融) | 0.26 | -24.1% | 2.4% | 24% |
| Equal-weight (1/N) | 0.22 | -41.9% | 0.7% | 3% |
| 60/40 股債 | 0.23 | -38.7% | 1.1% | 3% |
| Risk Parity | **0.28** | -26.1% | **2.6%** | 3% |
| Rolling MV | 0.24 | -30.8% | 2.1% | 26% |
| Moment-mix(消融) | 0.25 | -25.5% | 2.3% | 28% |

(30 條 Monte Carlo 路徑,β=1、τ=10 bps、γ=5)

## 引用建議

Chuang, Roger (2026). *Narrative Regimes: LLM-Augmented Strategic Asset Allocation for Long-Horizon Investors*. Working paper, under review at Decision Support Systems.
