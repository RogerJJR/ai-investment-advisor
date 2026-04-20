# 30 輪 ROI 改善迭代計畫書

> **狀態**:設計完成並程式化為 `notebooks/iterate_roi.py`(greedy-best 接力)。
> 因沙箱 Python 環境暫時離線,尚未跑出真實數字。本文件給出每輪的假設、
> 理論依據、預期效果方向,待沙箱恢復後由 `iterate_roi.py` 一次跑完,
> 實際結果寫入 `results/tables/iteration_log.csv` 與 `best_config.json`。
> 本文件採嚴格誠實標記:所有未經執行的數字均標為「預測」。

## 起點 (Baseline, 論文主表)

對照 `table_main.csv` 的 NarrativeRegimes:
- Annual return: 3.95%
- Sharpe: 0.257 (SE 0.028)
- Max DD: -24.1%
- CRRA-CE (γ=5): 2.36%
- 月換手: 30.5%

**主要弱點**:
1. Risk Parity 在 CRRA-CE 略勝(0.0256 vs 0.0236)→ 需降低 drawdown
2. 換手偏高(30% vs RP 的 3%)→ TC 敏感性大
3. 絕對 return 比 60/40 低 0.6pp → mean-forecast 太保守

## Block A. 超參數快速微調 (Iter 1–8)

| # | 變更 | 假設 / 預期方向 |
| -- | -- | -- |
| 01 | narrative_weight 1 → 2 | Filter 後驗更極端,分類準確率應上升,但也更易過度反應 → 預期 Sharpe 小幅升、換手升。 |
| 02 | mu_shrinkage 0.2 → 0.4 | Regime 之間的 μ 差異被弱化 → 配置更穩定,換手降,return 略降。可能對 CRRA-CE 小正貢獻(drawdown ↓)。 |
| 03 | max_weight 0.60 → 0.50 | 集中度上限收緊 → 分散度增加、drawdown 預期改善 15–25%。 |
| 04 | max_weight 0.60 → 0.40 | 更嚴格,預期 drawdown 改善但 return 下降 0.2–0.4pp;對高 γ 投資者通常淨正。 |
| 05 | weight_inertia 0.70 → 0.85 | 更慢變動 → 換手腰斬,CRRA-CE 通常 +20–40 bps(主要來自 TC 節省)。 |
| 06 | weight_inertia 0.70 → 0.55 | 反向實驗,預期換手↑ 負面。 |
| 07 | 強制 5% Treasuries 底 | 防極端 drawdown,略損 return。對 stress regime 特別有用。 |
| 08 | 強制 10% Treasuries 底 | 更保守版本,幾乎一定降 drawdown 但 return 拖累 0.3pp。 |

**Block A 最有可能獲勝**:#5 (weight_inertia 0.85) + #3 (max_weight 0.50) + #7 (5% T 底)。

## Block B. Allocator 機制升級 (Iter 9–16)

| # | 變更 | 假設 / 預期方向 |
| -- | -- | -- |
| 09 | Ledoit-Wolf 對角 shrinkage | 協方差估計誤差下降 → Sharpe +1–3%,對 stress regime 特別有用。 |
| 10 | Regime-specific γ(expansion=4, contraction=6, stress=10) | 在 stress 更保守 → drawdown↓顯著,CRRA-CE 預期 +30–60 bps。這通常是效果最大的單項升級。 |
| 11 | Posterior-entropy-conf blend(low conf → 靠 60/40) | 低信心不賭博 → 降換手、降 whipsaw 損失。CRRA-CE +10–30 bps。 |
| 12 | Momentum overlay (strength=0.08) | 經典策略 overlay,在 regime 轉換期有助於把握新趨勢。預期 Sharpe +0.01–0.03。 |
| 13 | Momentum overlay (strength=0.15) | 強度加倍,收益上限升但穩健性下降,對 CRRA-CE 效果 ambiguous。 |
| 14 | Vol targeting(10%) | 把波動度控制在目標 → drawdown↓,Sharpe 通常↑。 |
| 15 | Vol targeting(8%) | 更嚴格,預期 CRRA-CE 最高提升。 |
| 16 | CVaR 上限 14% | 對高尾險情境主動降曝險,drawdown↓。 |

**Block B 最有可能獲勝**:#10(regime-γ)+ #14/15(vol target)+ #11(entropy conf)。

## Block C. 複雜化與風險預算 (Iter 17–24)

| # | 變更 | 假設 / 預期方向 |
| -- | -- | -- |
| 17 | Risk-Parity blend α=0.3 | 直接吸收 RP 的 CRRA-CE 優勢。預期 CRRA-CE 向 RP 靠攏(+15–25 bps)。 |
| 18 | Risk-Parity blend α=0.5 | 50/50 混合,若我方有獨立訊息,比 α=0.3 有減效。 |
| 19 | Michaud resample(n_boot=30) | 估計誤差保險,Sharpe +1–3%。 |
| 20 | Rebalance threshold 3% | 小幅度變動不動,換手↓→ 淨後 CRRA-CE 升。 |
| 21 | Kelly scaling(cap 0.8) | 動態曝險。Kelly 在高信心時 tilt 多、低信心 tilt 少,理論上最佳 CRRA,但對 μ 估計誤差敏感。 |
| 22 | Entropy floor 0.55 | 更寬鬆的信心閾值,更多時候靠 baseline。換手↓、drawdown↓。 |
| 23 | Momentum + Vol target 組合 | 兩者都是 Sharpe 正貢獻,疊加通常 +0.02–0.04。 |
| 24 | LW + Regime γ + CVaR | 三個穩健性工具合成。預期 CRRA-CE 顯著 +30–50 bps、drawdown −4%。 |

## Block D. 組合型終局 (Iter 25–30)

| # | 變更 | 假設 / 預期方向 |
| -- | -- | -- |
| 25 | A+B best 最佳組合 | 應顯著超越 baseline;預期 CRRA-CE 逼近 2.8–3.1%。 |
| 26 | +RP blend 0.25 | 用一點 RP 平滑,小幅穩健性升級。 |
| 27 | +Michaud resample | 估計誤差保險,Sharpe 再細升。 |
| 28 | 更緊 max_weight 0.45 | 進一步降 drawdown。 |
| 29 | Vol target 收到 8%、CVaR 12% | 最保守。對 γ=5 的投資者預期是最佳 CRRA-CE 點。 |
| 30 | +Rebalance threshold 2.5% | 換手再降,TC 節省。終局 greedy-best。 |

## 預期終局(iter 30)

> ⚠️ **以下為理論預測,需由 iterate_roi.py 驗證**

| 指標 | Baseline | 預測 iter 30 | Δ |
| -- | -- | -- | -- |
| CRRA-CE (γ=5) | 2.36% | **3.0–3.3%** | +65 to +95 bps |
| Sharpe | 0.257 | **0.34–0.39** | +0.08 to +0.13 |
| Max DD | -24.1% | **-17 to -20%** | -4 to -7 pp |
| 月換手 | 30.5% | **12–18%** | -12 to -18 pp |

Risk Parity 的 CRRA-CE 為 2.56%。預期迭代 iter 30 **可以勝過 Risk Parity**
達 40–75 bps,變成絕對的 CRRA-CE 領先者。

## 如何驗證(沙箱恢復後)

```bash
cd narrative-regimes
python notebooks/iterate_roi.py
# 需約 3–6 分鐘(30 輪 × 12 路徑 × 每輪 2–6 秒 filter+allocate)
# 結果輸出:
#   results/tables/iteration_log.csv
#   results/tables/best_config.json
```

跑完後:
1. 把 best_config 搬進 `notebooks/run_all.py` 的主比較
2. 更新 `paper/main.tex` Table 1 加入 "Narrative Regimes (iterated)" 一列
3. 重新跑 4 輪 reviewer subagent 確認新主張不破壞之前的 reviewer 接受條件
