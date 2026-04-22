# 一次性設定:Google Cloud + GitHub Actions 自動部署

做完這份文件的 7 個步驟後,以後就是:
```
改 code → git push → 兩個 workflow 自動部署 → 1-3 分鐘後上線
```

總共約 15-20 分鐘,大部分是在 GCP Console 點來點去。

---

## 架構

```
你 git push
    │
    ├─ 改到 server/** ─────→ GitHub Actions "deploy-proxy" ─→ Cloud Run
    │                                                           │
    └─ 改到前端檔 ─────────→ GitHub Actions "deploy-hosting" ──┤
                                  (自動抓 Cloud Run URL)        │
                                          │                      │
                                          └────── Firebase Hosting
                                                      │
                                                  你的網站
```

兩個 workflow 共用同一把 service-account 金鑰。

---

## 步驟 1:建 GCP project + 綁 billing

1. 開 <https://console.cloud.google.com/projectcreate>
2. Project name:`ai-advisor`(或任何你喜歡的)
3. 建立後記下 **Project ID**(例如 `ai-advisor-470823`)
4. 開 <https://console.cloud.google.com/billing> → 綁信用卡
5. 把 project link 到 billing account:<https://console.cloud.google.com/billing/linkedaccount>

> 新帳號有 $300 免費額度 90 天,之後每月也有免費額度(Cloud Run 200 萬 requests / Firebase Hosting 10GB)。這個 App 流量小幾乎吃不到。

---

## 步驟 2:把 GCP project 加進 Firebase

Firebase project 本質就是 GCP project,只差「啟用 Firebase 功能」。

1. 開 <https://console.firebase.google.com/>
2. 點 **Add project**
3. 選 **"Add Firebase to Google Cloud project"**(不是建新的)
4. 從下拉選單選剛才建的 GCP project
5. 一路 Next(不用加 Google Analytics)

---

## 步驟 3:啟用需要的 API

在 Cloud Shell(<https://console.cloud.google.com/> 右上角 `>_` 圖示)或你本機有 gcloud 的地方跑:

```bash
gcloud config set project <你的-project-id>
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com
```

或者用 GUI 逐一啟用:<https://console.cloud.google.com/apis/library>
搜尋並點 **Enable**:
- Cloud Run Admin API
- Cloud Build API
- Artifact Registry API
- Firebase Management API
- Firebase Hosting API

---

## 步驟 4:建 Service Account + 給權限

Service account 就是 GitHub Actions 用來操作 GCP 的「機器人帳號」。

### 4a. 建 SA

1. 開 <https://console.cloud.google.com/iam-admin/serviceaccounts>
2. **CREATE SERVICE ACCOUNT**
3. Name:`github-actions-deployer`
4. Description:`Used by GitHub Actions to deploy Cloud Run + Firebase Hosting`
5. 按 **CREATE AND CONTINUE**

### 4b. 給 Roles(這步很重要,少一個就會失敗)

在 **"Grant this service account access to project"** 頁面,**一個一個加**以下 role:

| Role | 作用 |
|---|---|
| `Cloud Run Admin` | 部署 Cloud Run service |
| `Cloud Build Editor` | 觸發 Cloud Build |
| `Artifact Registry Writer` | 推 Docker image |
| `Service Account User` | 讓 Cloud Run 能以預設 SA 執行 |
| `Storage Admin` | Cloud Build 上傳 source 到 GCS |
| `Firebase Hosting Admin` | 部署 Firebase Hosting |
| `Firebase Authentication Admin` | (可選)若之後加登入 |
| `API Keys Viewer` | Firebase CLI 需要讀 Web API key |
| `Service Usage Consumer` | 讓 SA 能用已啟用的 API |

> 覺得太麻煩的話,可以先給 **`Owner`** 權限讓它動起來(不推薦長期用,但自己的小 project OK)。之後再縮權限。

按 **CONTINUE** → **DONE**。

### 4c. 下載 JSON 金鑰

1. 回到 service accounts 列表,點進剛建的 `github-actions-deployer`
2. 切到 **KEYS** tab
3. **ADD KEY** → **Create new key** → **JSON** → **CREATE**
4. 瀏覽器會自動下載 `xxx.json` — **把這個檔案開起來、整個複製起來**(包含 `{` 到 `}`)

⚠ 這個 JSON 等於密碼,絕不要 commit 到 repo。

---

## 步驟 5:把金鑰貼到 GitHub Secrets

1. 開 <https://github.com/RogerJJR/ai-investment-advisor/settings/secrets/actions>
2. **New repository secret**,建兩個:

   | Name | Value |
   |---|---|
   | `GCP_SA_KEY` | 整份 JSON 內容貼進去(包含最外層大括號) |
   | `GCP_PROJECT_ID` | 你的 project ID,例如 `ai-advisor-470823` |

3. 確認兩個 secret 都出現在清單(value 不會顯示,看不見是正常的)

---

## 步驟 6:第一次部署(手動觸發)

> ⚠ 順序很重要:先 proxy,再 hosting。因為 hosting workflow 會自動抓 Cloud Run URL。

### 6a. 觸發 Proxy deploy

1. 開 <https://github.com/RogerJJR/ai-investment-advisor/actions/workflows/deploy-proxy.yml>
2. 右上角 **Run workflow** → 分支選 `main` → **Run workflow**
3. 約 2-3 分鐘後 workflow 綠勾
4. 點進 run → 找 **"Print service URL"** 步驟,會看到 notice 列出 URL,例如:
   ```
   Service URL: https://ai-advisor-proxy-xxxxx-de.a.run.app
   ```
5. **"Smoke test /healthz"** 步驟應該印出 `ok`

### 6b. 觸發 Hosting deploy

1. 開 <https://github.com/RogerJJR/ai-investment-advisor/actions/workflows/deploy-hosting.yml>
2. **Run workflow** → `main` → **Run workflow**
3. 約 1-2 分鐘後綠勾
4. 點進 run → 找 **"Deploy to Firebase Hosting"** 步驟,最後會印出:
   ```
   Hosting URL: https://<project-id>.web.app
   ```

### 6c. 打開網站

開 `https://<你的-project-id>.web.app` → 進理論基礎、配置建議等頁 → **報價應該從 Cloud Run proxy 拉**(比 GitHub Pages 版快很多)。

F12 Network tab 確認:請求打到 `ai-advisor-proxy-xxxxx.a.run.app/yahoo/chart` 而不是 `corsproxy.io`。

---

## 步驟 7:以後的更新流程

**我(Claude)那邊**:改 code → push 到 `main`
**你這邊**:啥事都不用做,1-3 分鐘後自動部署完。

**如果要看進度**:<https://github.com/RogerJJR/ai-investment-advisor/actions>

---

## 疑難排解

### `Permission denied to enable service ...`
→ 你還在舊的 `gen-lang-client-...` project。先跑 `gcloud config set project <新-id>`。

### Cloud Run deploy 失敗:`Permission 'run.services.create' denied`
→ 步驟 4b 的 **Cloud Run Admin** role 沒給到。回 <https://console.cloud.google.com/iam-admin/iam> 幫 `github-actions-deployer` 加上。

### Firebase deploy 失敗:`Permission denied`
→ **Firebase Hosting Admin** role 沒給,或步驟 2 沒把 GCP project 加到 Firebase。

### deploy-hosting workflow 印 `Cloud Run service 'ai-advisor-proxy' not found`
→ Proxy 還沒部署過(步驟 6a)。先跑 proxy workflow 一次。

### Proxy 部署成功但瀏覽器打 URL 看到 403(最常見於 Google Workspace 帳號)
→ Google Workspace(例如 `@yourcompany.com`)預設啟用
`constraints/iam.allowedPolicyMemberDomains`,這條 Org Policy 會擋
掉把 `allUsers` 加到 IAM 的操作 → Cloud Run 部署 OK 但對外一律 403。

Workflow 會在 `Ensure public access` 步驟偵測到並發 warning,不會讓
整個 run 失敗(因為服務本身是健康的,只是沒對外開放)。

**三個解法選一個**:

1. **請 Workspace 管理員加例外**
   <https://console.cloud.google.com/iam-admin/orgpolicies> →
   找 `Domain restricted sharing` (`iam.allowedPolicyMemberDomains`)
   → 針對 `ai-advisor` 這個 project 加 exception → 重跑 proxy workflow

2. **改用個人 Gmail 建 project**(最簡單)
   個人帳號沒有 org,不受 policy 限制。用個人 gmail 重建 project,
   重做步驟 1-5(新 SA、新 JSON、更新 GitHub secret),重跑 workflow。

3. **改成帶 token 存取**(複雜,需要改前端 code)
   前端接上 Firebase Auth 匿名登入、每個 fetch 帶 identity token、
   proxy 驗 token。這個需要額外開 ticket。

### 自訂網域
Firebase Console → Hosting → **Add custom domain** → 跟著指示設 DNS。免費。

### 省錢
`gcloud run deploy` 預設 `--min-instances 0`,冷啟動 1-2 秒。若嫌慢可以改 workflow 的
`--min-instances` 為 1(約 $5-10/月恆定成本)。
