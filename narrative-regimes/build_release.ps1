# build_release.ps1 — 產生 Release ZIP(Windows PowerShell)
# 用法(請在 repo 根目錄執行):
#   PS> .\build_release.ps1

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$releaseDir = Join-Path $repoRoot "release"
$zipPath = Join-Path $releaseDir "narrative-regimes-preprint-v0.2.0.zip"

if (Test-Path $zipPath) { Remove-Item $zipPath }

# 編譯 LaTeX(如果有 MikTeX 或 TeX Live)
$paperDir = Join-Path $repoRoot "paper"
Push-Location $paperDir
try {
    if (Get-Command pdflatex -ErrorAction SilentlyContinue) {
        Write-Host "Compiling LaTeX..."
        & pdflatex -interaction=nonstopmode main.tex | Out-Null
        & bibtex main | Out-Null
        & pdflatex -interaction=nonstopmode main.tex | Out-Null
        & pdflatex -interaction=nonstopmode main.tex | Out-Null
        Write-Host "  -> paper/main.pdf"
    } else {
        Write-Warning "pdflatex not found; shipping .tex only (reviewer will compile)."
    }
}
finally {
    Pop-Location
}

# 收集要打包的檔案
$include = @(
    "paper",
    "src",
    "notebooks",
    "results",
    "reviews",
    "README.md",
    "ABSTRACT_zh-TW.md",
    "LICENSE",
    "CITATION.cff",
    "GITHUB_PUSH_INSTRUCTIONS.md",
    ".gitignore"
)

# 排除 __pycache__、.aux、.log 等暫存檔
$tmpStaging = Join-Path $env:TEMP "narrative-regimes-staging-$(Get-Random)"
New-Item -ItemType Directory -Path $tmpStaging -Force | Out-Null

foreach ($item in $include) {
    $src = Join-Path $repoRoot $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $tmpStaging -Recurse -Force
    }
}

# 移除暫存
Get-ChildItem -Path $tmpStaging -Recurse -Force -Include "__pycache__","*.pyc","*.aux","*.log","*.out","*.bbl","*.blg","*.toc","*.synctex.gz","*.fls","*.fdb_latexmk" |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# 壓縮
Compress-Archive -Path (Join-Path $tmpStaging "*") -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $tmpStaging

Write-Host ""
Write-Host "Release ZIP created:"
Write-Host "  $zipPath"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1) 建立 GitHub private repo (不要初始化 README)"
Write-Host "  2) cd $repoRoot; git init; git add .; git commit -m '...'; git push"
Write-Host "  3) 在 repo 的 Releases 頁面上傳 $zipPath"
Write-Host ""
Write-Host "詳情請看 GITHUB_PUSH_INSTRUCTIONS.md"
