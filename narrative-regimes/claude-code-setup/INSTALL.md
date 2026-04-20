# Claude Code 配置安裝步驟

這個資料夾下的檔案是**要搬到 `.claude/` 的配置**。Claude Code 會自動讀取
`.claude/` 裡的 agents、settings、runbook 等資源。

由於本 session 無法直接寫入 `.claude/`(Cowork 保護路徑),請您在本機執行
**一次性**搬動:

## Windows PowerShell

```powershell
cd "D:\Roger\JJR\claude project\AI investment allocation suggestion\narrative-regimes"

# 建立 .claude/ 結構
New-Item -ItemType Directory -Force -Path .claude\agents | Out-Null

# 搬動 runbook
Copy-Item claude-code-setup\RUNBOOK.md .claude\RUNBOOK.md

# 搬動 subagent 定義
Copy-Item claude-code-setup\agents\*.md .claude\agents\

# 搬動 settings
Copy-Item claude-code-setup\settings.json .claude\settings.json

# 搬動 CLAUDE.md(若已有則合併)
Copy-Item claude-code-setup\CLAUDE.md CLAUDE.md -Force

# (可選)刪除 setup 資料夾
# Remove-Item -Recurse claude-code-setup
```

## macOS / Linux

```bash
cd /path/to/narrative-regimes
mkdir -p .claude/agents
cp claude-code-setup/RUNBOOK.md .claude/RUNBOOK.md
cp claude-code-setup/agents/*.md .claude/agents/
cp claude-code-setup/settings.json .claude/settings.json
cp claude-code-setup/CLAUDE.md CLAUDE.md
```

## 驗證

啟動 Claude Code:
```bash
claude
```

在對話中檢查:
```
/agents
```
應該看到:
- reviewer-methodology
- reviewer-empirical
- reviewer-ai
- reviewer-presentation

以及:
```
/status
```
應該看到 model 是 `claude-sonnet-4-6`(從 `.claude/settings.json` 讀)。

## 使用範例

```
# 直接請 Claude Code 執行 30 輪 sweep 並更新論文
Execute Workflow A from RUNBOOK.md: run notebooks/iterate_roi.py, read the 
iteration_log.csv, and summarise the top-5 accepted iterations. Then proceed 
to Workflow B if CRRA-CE improved by >=20 bps.
```

Claude Code 會自動讀取 `.claude/RUNBOOK.md` 並按照裡面定義的 Workflow 操作。
