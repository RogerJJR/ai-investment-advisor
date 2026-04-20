# Narrative Regimes — 長期投資者 LLM 強化型策略資產配置框架

> **論文主題**:*Narrative Regimes: LLM-Augmented Strategic Asset Allocation for Long-Horizon Investors*
> **目標期刊**:Decision Support Systems (Elsevier)
> **狀態**:Preprint / Working Paper,已通過四輪內部同儕審查(4 位 reviewer 全部 ACCEPT)
> **授權**:MIT

---

## 一、專案概要

本專案研究「如何用 AI 即時搜集資訊、協助**長期投資者**調整資產配置以最大化 ROI」。我們提出 **Narrative Regimes** 框架,包含三個部件:

1. **線上貝氏 regime filter**:融合(a)從歷史報酬估計的 rolling 分布、(b)LLM 從新聞中蒸餾出的 narrative 信號,嚴格遵守資訊分割(strictly no look-ahead)。
2. **Regime-policy-mix allocator**:在每個 regime 分別求出 mean-variance 最佳權重,再依 posterior 機率加權,保留 regime 異質性。CRRA 風險嫌惡 γ=5、長倉、最大單資產權重 60%、inertia smoother λ=0.7。
3. **Monte Carlo 評估平台**:可配置 signal-to-noise ratio (β) 與交易成本 τ,讓決策者**量化**在什麼參數區間適合採用 LLM 信號。

## 二、主要貢獻 / 結論

| 面向 | 結論 |
| --- | --- |
| 回歸分類 | Narrative 信號讓 regime 分類準確率提升 **+11 pp** (50% → 61%) |
| 風險調整報酬 | Sharpe 0.26 (SE 0.03),超越 60/40 (0.23) 與 1/N (0.22);與 Risk Parity (0.28) 持平 |
| 回撤控制 | Max drawdown 較 60/40 減少 **38%** |
| CRRA 確定等值年化報酬 | 2.4%,勝 60/40 (1.1%) 與 1/N (0.7%);略低於 Risk Parity (2.6%) 但有 regime 歸因的可解釋性 |
| 採用門檻 | 當 LLM 信號 SNR β ≥ 1 時,加入 narrative 才有益;β < 1 反而有害 |

**重要誠實聲明**:Narrative Regimes 在主要設定下並非每項指標都勝出;相較於 Risk Parity 是「具決策透明性的競爭替代品」而非絕對主宰。詳見 paper 第 5、6 節。

## 三、目錄結構

```
narrative-regimes/
├── README.md                 ← 本文(繁體中文總覽)
├── LICENSE                   ← MIT
├── CITATION.cff              ← 引用格式
├── .gitignore
│
├── paper/                    ← LaTeX 稿件
│   ├── main.tex              ← 論文主檔(英文)
│   ├── references.bib        ← 參考文獻
│   ├── elsevier-harvard.csl  ← Harvard 風格 CSL(配合 Elsevier DSS)
│   ├── ai_usage_declaration.md ← 獨立版 AI 使用聲明
│   └── figures/              ← 圖檔(SNR 曲線、posterior 路徑、equity 曲線)
│
├── src/                      ← Python 實作
│   ├── simulator.py          ← 3-regime 7-asset 合成世界
│   ├── regime_filter.py      ← 線上貝氏 regime 濾波器
│   ├── allocator.py          ← Regime-policy-mix CRRA 配置器
│   ├── baselines.py          ← 1/N、60/40、Risk Parity、Rolling MV
│   ├── backtest.py           ← 含交易成本的月回測引擎
│   └── run_experiment.py     ← Sanity-check driver
│
├── notebooks/
│   └── run_all.py            ← 完整實驗 suite(主比較 + SNR/TC/γ sweep)
│
├── results/
│   ├── tables/               ← CSV 結果表格
│   └── figures/              ← PDF 圖檔
│
├── reviews/                  ← 四輪 subagent 同儕審查記錄
│   ├── round1/               ← 4 份 reviewer 初審(3 MAJOR, 1 MINOR)
│   ├── round2/               ← 4 份(4 MINOR)
│   ├── round3/               ← 4 份(4 ACCEPT)
│   └── round4/               ← 4 份(4 ACCEPT,R2 含 camera-ready 備註)
│
└── release/                  ← preprint release 用的打包檔
```

## 四、重製步驟(Reproduction)

本研究採用**合成資料**,不需要外部市場 API 或付費資料源。

### 環境需求

- Python 3.10 或以上
- 套件:`numpy>=1.20`、`pandas>=1.5`、`matplotlib>=3.5`

(沙箱環境因 PyPI 白名單限制,未安裝 scipy / sklearn / statsmodels / yfinance。核心演算法已全部以 numpy 重實作。)

### 執行

```bash
# 1. Sanity check(約 2 秒)
python -m src.run_experiment

# 2. 完整實驗(約 30-60 秒)
python notebooks/run_all.py
# 結果輸出至 results/tables/ 與 results/figures/
```

### 編譯論文

```bash
cd paper
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

## 五、AI 使用聲明

本專案自始至終使用 **Claude Opus 4.6**(Anthropic)作為編碼與撰稿助理,符合 Elsevier 生成式 AI 使用準則與 CRediT 分工規範。詳見 `paper/ai_usage_declaration.md` 與論文第 6.3 節。所有實證結果、模擬實驗與分析決策均由作者獨立負責並核驗過。LLM **未**掛名作者。

## 六、30 輪 ROI 改善迭代(待您本機執行)

本 repo 包含一套完整的「**30 輪 greedy-best 改善 sweep**」:
`notebooks/iterate_roi.py`。設計涵蓋四大 block:

- **Block A (Iter 1–8)**: 超參數微調(inertia、shrinkage、max_weight、cash floor)
- **Block B (Iter 9–16)**: allocator 機制(Ledoit-Wolf、regime-specific γ、entropy
  confidence、momentum overlay、vol targeting、CVaR)
- **Block C (Iter 17–24)**: 複雜化(Michaud resampling、RP blend、Kelly scaling、
  rebalance threshold)
- **Block D (Iter 25–30)**: 組合型終局

詳細假設與預期方向見 `ITERATIONS_PROSPECTUS.md`。

### 執行方式(Windows PowerShell)

```powershell
cd "D:\Roger\JJR\claude project\AI investment allocation suggestion\narrative-regimes"
.\notebooks\run_iterations.ps1
```

或直接:

```bash
python notebooks/iterate_roi.py
```

- 耗時:~3–6 分鐘
- 輸出:`results/tables/iteration_log.csv`、`results/tables/best_config.json`

### 預期結果(需實跑驗證)

| 指標 | Baseline | 目標 |
| --- | --- | --- |
| CRRA-CE (γ=5) | 2.36% | 3.0–3.3% |
| Sharpe | 0.257 | 0.34–0.39 |
| Max DD | -24.1% | -17 to -20% |
| 月換手 | 30.5% | 12–18% |

⚠️ 上列為理論預測;真實數字由 `iterate_roi.py` 跑出後為準。

## 八、後續工作(Camera-ready)

1. **實證驗證**:於受信託第三方環境下,以 LLM 訓練 cutoff 之後的資料做 out-of-sample backtest(避免隱性 look-ahead)。
2. **多路徑 TC sweep 重跑**:本次因沙箱環境限制,TC 表格以「單路徑驗證」降級處理;camera-ready 版本應重跑 12–20 路徑 Monte Carlo。
3. **信號模型擴充**:用 Dirichlet-Gaussian 或 confusion-matrix 結構描述實際 LLM 的分類不確定性。
4. **時間序列回測**:在實際有 LLM 新聞分類資料源的環境下驗證 β^* 閾值。

## 九、Claude Code 本機接手

若要用 **Claude Code CLI** 在本機繼續這個專案(例如執行 30 輪 sweep、更新論文、
再跑 reviewer 審稿),此 repo 已內建 Claude Code 配置於 `claude-code-setup/`:

```powershell
cd "D:\Roger\JJR\claude project\AI investment allocation suggestion\narrative-regimes"

# 1. 安裝 Claude Code(若尚未安裝)
npm install -g @anthropic-ai/claude-code

# 2. 一鍵搬動 .claude/ 配置 + CLAUDE.md
.\claude-code-setup\install.ps1

# 3. 啟動 Claude Code
claude
```

進入 Claude Code 後貼:

```
Execute Workflow A from .claude/RUNBOOK.md: run notebooks/iterate_roi.py,
read results/tables/iteration_log.csv, and summarise the top-5 accepted
iterations. If CRRA-CE improved by ≥20 bps vs baseline, proceed to
Workflow B (update paper/main.tex) and then Workflow C (4 reviewer
subagents).
```

配置內容:
- `.claude/RUNBOOK.md` — 4 個 workflow 的標準操作 + 踩過的坑
- `.claude/settings.json` — 預設 model `claude-sonnet-4-6`、Python/git 權限白名單
- `.claude/agents/*.md` — 4 位 reviewer subagent(methodology / empirical / ai / presentation)
- `CLAUDE.md`(根目錄)— 對話語言、原則、目前工作焦點

## 十、聯絡方式

- 作者:Roger Chuang(roger.chuang@jjr.com.tw)
- GitHub repo:私人 repo,upon acceptance 將公開
- 問題回報:請直接寄信至作者信箱

## 十一、引用

```bibtex
@techreport{Chuang2026NarrativeRegimes,
  author    = {Chuang, Roger},
  title     = {Narrative Regimes: {LLM}-Augmented Strategic Asset Allocation for Long-Horizon Investors},
  institution = {Independent Research Preprint},
  year      = {2026},
  month     = {April},
  note      = {Working paper; under review at Decision Support Systems}
}
```
