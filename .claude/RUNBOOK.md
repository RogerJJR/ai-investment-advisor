# Claude Code Runbook — Narrative Regimes

> Claude Code 專用操作手冊。啟動 Claude Code 後,請把本檔複製到 `.claude/RUNBOOK.md`
> (見本資料夾的 `INSTALL.md`),之後每次 `claude` 啟動都會自動載入。

## 專案快照

- **研究主題**: LLM-augmented strategic asset allocation for long-horizon investors
- **目標期刊**: Decision Support Systems (Elsevier)
- **狀態**: Preprint v0.1.0 已通過 4 輪內部同儕審查,全員 ACCEPT
- **主要語言**: 論文 = English;對話、README、摘要 = 繁體中文
- **資料**: 完全合成(Monte Carlo);沙箱環境禁外網,無市場 API

## Repo 架構(關鍵檔案)

```
src/
├── simulator.py          合成 3-regime × 7-asset 世界
├── regime_filter.py      線上 Bayesian regime filter (no look-ahead)
├── allocator.py          CRRA regime-policy-mix allocator(基礎版)
├── allocator_v2.py       增強版 allocator(8 個 orthogonal toggle)
├── enhancements.py       LW shrinkage / Michaud / Kelly / CVaR / vol target / …
├── baselines.py          1/N, 60/40, Risk Parity, Rolling MV
├── backtest.py           月頻回測引擎(有 TC 扣費)
└── run_experiment.py     Sanity-check driver

notebooks/
├── run_all.py            主實驗 suite(A→SNR→TC→γ 4 組 sweep)
├── iterate_roi.py        ★ 30 輪 ROI 改善 sweep(greedy-best 接力)
└── run_iterations.ps1    Windows 一鍵執行器

paper/
├── main.tex              論文主檔(elsarticle + authoryear)
├── references.bib        27 個 refs(含 DSS-native)
├── elsevier-harvard.csl  Harvard CSL
└── ai_usage_declaration.md  CRediT-aligned AI 聲明

reviews/round{1..4}/      16 份 reviewer 記錄
results/{tables,figures}/ 主實驗輸出
ITERATIONS_PROSPECTUS.md  30 輪迭代假設與預期方向
```

## 使用者互動原則

Roger 通常一口氣丟 1–2 段整體需求,裡面會包含多個子任務。請:
1. 先用 Plan 模式(Shift+Tab)列出拆解步驟再動手
2. 拆開來逐項執行,每做完一項給簡短確認
3. 研究/投資相關敘述一律以**繁體中文**回覆
4. 論文主稿改動用**英文**;README / 摘要 / 說明用**繁體中文**
5. **不編造數字**。無法執行時明說,不用猜測值填 Table

## Workflow A — 執行 30 輪 ROI sweep(當前主要未完成任務)

```bash
python notebooks/iterate_roi.py
```

跑完後會輸出:
- `results/tables/iteration_log.csv`
- `results/tables/best_config.json`

之後請:
1. 讀 `iteration_log.csv`,列出 top-5 accepted iterations 的 CRRA-CE / Sharpe / MDD / 月換手
2. 比對 baseline (`results/tables/table_main.csv` 中 Narrative Regimes 那列)
3. 若改善 ≥ 20 bps CRRA-CE,進入 Workflow B

## Workflow B — 將 best_config 整合進論文

1. 編輯 `notebooks/run_all.py`,新增一條策略 `NarrativeRegimesV2`,使用
   `allocator_v2.allocate_v2` + `best_config.json` 的參數
2. 執行 `python notebooks/run_all.py` 重新生成 `table_main.csv`
3. 編輯 `paper/main.tex`:
   - 在 Table 1 新增 `Narrative Regimes (iterated)` 一列
   - Abstract 數字若改變則同步更新
   - Results 段落用一段話描述 iterated 改善幅度(誠實:若相對 baseline
     只有小改善,就如實寫)
4. 重跑 4 位 reviewer subagent(見 Workflow C)

## Workflow C — 4 位 reviewer subagent 同儕審查

專案內建 4 個 subagent 定義於 `.claude/agents/`:
- `reviewer-methodology` — Bayesian filter / DP / portfolio optimisation
- `reviewer-empirical` — MC design / baseline 合理性 / 報表誠實度
- `reviewer-ai` — LLM 抽象 / look-ahead 論述 / Elsevier AI 合規
- `reviewer-presentation` — 寫作清晰度 / 引文 / 排版

每輪執行方式:在單一訊息中並行派送 4 個 Task 呼叫。每位 reviewer 讀
`paper/main.tex` + 之前輪次的自己的 review,寫一份新 review 到
`reviews/roundN/reviewerX_*.txt`,回傳 decision (ACCEPT / MINOR / MAJOR / REJECT)。

迭代規則:
- 任一 reviewer 非 ACCEPT → 修 tex → 再派下一輪
- 全員 ACCEPT → 進 Workflow D

## Workflow D — Release 打包 + GitHub

```bash
# 1. 編譯 PDF(需本機有 MikTeX 或 TeX Live)
cd paper
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
cd ..

# 2. 打包(Windows)
./build_release.ps1

# 3. Git commit + push
git add -A
git commit -m "Iterated allocator v2 + updated paper"
git push

# 4. GitHub release(若有 gh)
gh release create vX.Y.Z-preprint \
  --title "Narrative Regimes Preprint vX.Y.Z" \
  --notes-file release/RELEASE_NOTES.md \
  release/narrative-regimes-preprint-vX.Y.Z.zip
```

## 常見坑(之前踩過的)

1. **`src/backtest.py` 曾出現 null byte**。若檔尾看到 `\x00`,用
   ```python
   import pathlib
   p = pathlib.Path('src/backtest.py')
   p.write_bytes(p.read_bytes().replace(b'\x00', b''))
   ```
   清掉後 pycache 會自動重建。
2. **pycache 誤導 debug**:每次改完 `src/*.py` 先刪 __pycache__ 再測。
3. **Transaction cost 看似不生效**:`backtest.py` 中
   `pr_net = (1+pr_gross)*(1-cost) - 1`,stats 要基於 `port_ret`。
4. **LaTeX figure 路徑**:main.tex 用 `../results/figures/*.pdf`;打包時
   必須把 `results/figures/` 一起包進 zip。
5. **沙箱網路**:Cowork 桌面沙箱禁外網。Claude Code 在您本機跑就沒這限制。

## 引用的 Baseline 數字(sanity check 用)

`table_main.csv` 的 Narrative Regimes(30 paths, β=1, τ=10bps, γ=5):

- Annual return 3.95% · Vol 15.4% · Sharpe 0.257 · MDD -24.1%
- CRRA-CE 2.36% · 月換手 30.5%
- Regime 分類 accuracy 60.8%(w/o narrative 49.8%)

30 輪後目標:CRRA-CE 達 3.0%+、Sharpe 0.34+、MDD ≤ -20%、月換手 ≤ 18%。

## 速查 — 使用者可能問的 3 題

**Q1: "幫我跑 iteration"**
→ `python notebooks/iterate_roi.py` → 等完 → 讀 CSV → 摘要 top-5

**Q2: "更新論文"**
→ Workflow B

**Q3: "同儕審查"**
→ Workflow C(先看 `reviews/round4/` 先前每位 reviewer 的 concern 是否解決)
