# run_iterations.ps1 — 在 Windows 本機執行 30 輪 ROI 改善 sweep
# 用法:
#   PS> cd "D:\Roger\JJR\claude project\AI investment allocation suggestion\narrative-regimes"
#   PS> .\notebooks\run_iterations.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Split-Path -Parent $here
Set-Location $repoRoot

# 檢查 Python
$py = $null
foreach ($cand in @("python", "python3", "py")) {
    try {
        $v = & $cand --version 2>&1
        if ($LASTEXITCODE -eq 0) { $py = $cand; break }
    } catch {}
}
if (-not $py) {
    Write-Error "找不到 Python。請先安裝 Python 3.10+ 並加入 PATH。"
    exit 1
}
Write-Host "使用 Python: $py"

# 檢查必要套件
$pkgs = @("numpy", "pandas", "matplotlib")
foreach ($p in $pkgs) {
    & $py -c "import $p" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "安裝 $p ..."
        & $py -m pip install --user $p
    }
}

# 執行 30 輪 sweep
Write-Host ""
Write-Host "=== 開始執行 30 輪 ROI 改善迭代 sweep ==="
Write-Host "預估耗時 3-6 分鐘 (30 輪 x 12 路徑 Monte Carlo)"
Write-Host ""

$env:PYTHONPATH = $repoRoot
& $py notebooks/iterate_roi.py

if ($LASTEXITCODE -ne 0) {
    Write-Error "Sweep 執行失敗。請檢查上方錯誤訊息。"
    exit 1
}

Write-Host ""
Write-Host "=== 完成 ==="
Write-Host "結果輸出:"
Write-Host "  results/tables/iteration_log.csv   (30 輪每輪的 CRRA-CE / Sharpe / MDD / 換手 / 是否接受)"
Write-Host "  results/tables/best_config.json     (最終最佳組合的完整參數)"
Write-Host ""
Write-Host "查看摘要:"
Write-Host "  python -c `"import pandas as pd; d=pd.read_csv('results/tables/iteration_log.csv'); print(d[['iter','name','crra_ce_annual','sharpe','max_drawdown','avg_turnover','accepted']].to_string(index=False))`""
