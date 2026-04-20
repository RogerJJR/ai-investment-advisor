# install.ps1 — 一鍵把 claude-code-setup/ 內容搬到 .claude/ 與 repo 根目錄
# 用法:
#   cd "D:\Roger\JJR\claude project\AI investment allocation suggestion\narrative-regimes"
#   .\claude-code-setup\install.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Split-Path -Parent $here
Set-Location $repoRoot

Write-Host "將 claude-code-setup/ 內容搬入 .claude/ 與專案根目錄..." -ForegroundColor Cyan

# 建立 .claude/agents/
New-Item -ItemType Directory -Force -Path .claude\agents | Out-Null

# 搬 runbook
Copy-Item claude-code-setup\RUNBOOK.md .claude\RUNBOOK.md -Force
Write-Host "  [OK] .claude\RUNBOOK.md"

# 搬 settings
Copy-Item claude-code-setup\settings.json .claude\settings.json -Force
Write-Host "  [OK] .claude\settings.json"

# 搬 4 個 reviewer subagent
Get-ChildItem claude-code-setup\agents\*.md | ForEach-Object {
    Copy-Item $_.FullName ".claude\agents\$($_.Name)" -Force
    Write-Host "  [OK] .claude\agents\$($_.Name)"
}

# 搬 CLAUDE.md(根目錄)
if (Test-Path "CLAUDE.md") {
    Write-Host "  [SKIP] CLAUDE.md already exists — not overwriting. Compare with claude-code-setup\CLAUDE.md and merge manually if needed."
} else {
    Copy-Item claude-code-setup\CLAUDE.md CLAUDE.md -Force
    Write-Host "  [OK] CLAUDE.md"
}

Write-Host ""
Write-Host "完成。現在可以執行:" -ForegroundColor Green
Write-Host "  claude"
Write-Host ""
Write-Host "進入 Claude Code 後建議先試:" -ForegroundColor Yellow
Write-Host "  /agents                          # 確認 4 位 reviewer 有被 Claude Code 認到"
Write-Host "  /status                          # 確認 model 是 claude-sonnet-4-6"
Write-Host "  Execute Workflow A from RUNBOOK.md"
