# 上傳到 GitHub Private Repo — 操作步驟

本 repo 已準備好完整檔案。請依下列步驟上傳到您的 GitHub private repo,並將
preprint 材料作為 Release 附上。

## 一、建立 Private Repo

在 https://github.com/new 建立新 private repo,建議名稱:`narrative-regimes`。
**不要**勾選 "Initialize this repository with a README",因為本地已經有
README.md。

## 二、初始化本地 git 並 push

Windows PowerShell 或 Git Bash 下:

```powershell
cd "D:\Roger\JJR\claude project\AI investment allocation suggestion\narrative-regimes"

git init
git add .
git commit -m "Initial preprint: Narrative Regimes v0.1.0

- Full LaTeX manuscript (paper/main.tex) targeting Decision Support Systems
- Python implementation (src/) with simulator, regime filter, allocator, backtest
- Monte Carlo experiments (notebooks/run_all.py)
- Four rounds of internal peer review (reviews/round{1..4}/) — all ACCEPT
- AI usage declaration integrated in paper sec:ai-usage and standalone
- MIT licence, CITATION.cff, Traditional Chinese README"

git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/narrative-regimes.git
git push -u origin main
```

> 如果 GitHub 要求 PAT (Personal Access Token),請到 Settings → Developer
> settings → Personal access tokens → Fine-grained tokens 建立一個對該 repo
> 有 `Contents: Read and Write` 權限的 token,貼到 push 時系統要求的密碼欄。

## 三、建立 Release 並上傳 preprint 附件

### 方法 A:Web UI(建議)

1. 到 repo 首頁 → 右側 "Releases" → "Create a new release"
2. 選 Tag: `v0.1.0-preprint`
3. Release title: `Narrative Regimes — Preprint v0.1.0 (April 2026)`
4. 在 "Attach binaries" 上傳 `release/` 下產出的 zip:
   - `narrative-regimes-preprint-v0.1.0.zip`
5. Description 填入(可複製下方區塊):

```
First preprint release of Narrative Regimes.

Contents:
- Full Preprint PDF (paper/main.pdf — compile via `pdflatex main.tex; bibtex main; pdflatex x2`)
- LaTeX source + bib + CSL
- Python reference implementation
- Monte Carlo experiment tables and figures
- Four rounds of internal peer-review records (all four reviewers ACCEPT)
- AI Usage Declaration

This is a working paper under review at Decision Support Systems (Elsevier).
License: MIT.

For camera-ready:
- [ ] Regenerate multi-path TC table (was downgraded to single-path verification due to sandbox availability)
- [ ] Empirical replication on post-LLM-cutoff holdout window
```

### 方法 B:`gh` CLI(如果之後您裝了 GitHub CLI)

```powershell
gh release create v0.1.0-preprint `
  --title "Narrative Regimes — Preprint v0.1.0 (April 2026)" `
  --notes-file release\RELEASE_NOTES.md `
  release\narrative-regimes-preprint-v0.1.0.zip
```

## 四、建立 Release ZIP 的指令

在 Git Bash 或 WSL 下:

```bash
cd "D:/Roger/JJR/claude project/AI investment allocation suggestion"
mkdir -p narrative-regimes/release
# 先編譯論文(需要 MikTeX 或 TeX Live)
cd narrative-regimes/paper
pdflatex main.tex; bibtex main; pdflatex main.tex; pdflatex main.tex
cd ..
# 打包
zip -r release/narrative-regimes-preprint-v0.1.0.zip \
  paper/main.pdf paper/main.tex paper/references.bib paper/elsevier-harvard.csl \
  paper/ai_usage_declaration.md paper/figures/ \
  src/ notebooks/ results/ reviews/ \
  README.md ABSTRACT_zh-TW.md LICENSE CITATION.cff
```

如果您環境無法跑 pdflatex,至少把原始檔(`.tex`、`.bib`、`.csl`、figures)
打包上傳;審稿方會自己編譯。
