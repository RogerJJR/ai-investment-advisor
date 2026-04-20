# CLAUDE.md

> 此檔為 Claude Code 在此 repo 工作的標準對話 context。啟動 `claude` 時會自動載入。

## 專案

**Narrative Regimes** — LLM-augmented strategic asset allocation for long-horizon
investors. Preprint 目標期刊 Decision Support Systems (Elsevier)。4 輪內部
同儕審查完成(全員 ACCEPT);接下來的工作主要是 ROI 改善迭代與更新論文。

## 對話語言

- 使用者(Roger)是繁體中文母語者,請用**繁體中文**回覆
- 論文主稿(`paper/main.tex`)維持**英文**
- README、摘要、說明文件用**繁體中文**

## 必讀檔

啟動後請先快速瀏覽:
1. `.claude/RUNBOOK.md` — 每個 workflow 的標準操作
2. `README.md` — 專案總覽
3. `ITERATIONS_PROSPECTUS.md` — 30 輪改善迭代的設計
4. `paper/main.tex` 的 Abstract + Table 1 — 了解當前 baseline 成果

## 重要原則

1. **不編造數字**。如果 Python 跑不出來,就說跑不出來,不要猜測值。
2. **先 Plan 再 Code**。大動作前先 Shift+Tab 進入 Plan 模式列出計畫。
3. **pycache 是雷**。改完 `src/*.py` 先刪 `__pycache__` 再跑。
4. **No look-ahead**。backtest.py 有把 target_weights shift(1),allocator 用
   strictly past information。不要破壞這個性質。
5. **AI 聲明要維持**。任何 LLM-generated 的改動都要在 `paper/main.tex`
   Section 6.3(sec:ai-usage)提及。

## 可用 subagents(在 `.claude/agents/`)

並行派送 4 位 reviewer 做同儕審查:
- `reviewer-methodology`
- `reviewer-empirical`
- `reviewer-ai`
- `reviewer-presentation`

## 目前工作焦點

**Workflow A**(見 RUNBOOK.md):執行 `python notebooks/iterate_roi.py`,
讀 `results/tables/iteration_log.csv`,摘要 top-5 accepted iterations,
比對 baseline 判斷是否進 Workflow B 更新論文。
