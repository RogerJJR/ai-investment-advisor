# 部署到 Google Cloud(Firebase Hosting + Cloud Run proxy)

> **推薦路徑**:先看 [`SETUP.md`](./SETUP.md) — 設好 GitHub Actions 之後,以後 `git push` 就自動部署,完全不用再碰本文的命令列。
>
> 本文件是**手動部署**的參考(例如想在本機直接 deploy、或除錯 workflow 時需要重現某一步)。

---

架構:
```
  瀏覽器
    │
    ├─ 靜態檔(index.html, *.jsx, styles.css) ── Firebase Hosting
    │
    └─ /yahoo/* /twse/*                        ── Cloud Run (proxy)
                                                      │
                                                      ├─ query1.finance.yahoo.com
                                                      └─ mis.twse.com.tw / openapi.twse.com.tw
```

好處:
- 繞過 Yahoo CORS,不再經過 corsproxy.io(第三方、會限流)
- TWSE MIS 直連、快 — Cloud Run 與 TWSE 都在同洲,延遲低
- Cloud Run 內建 TTL 快取:同一秒內一千個使用者只打一次上游
- 免費額度夠(Cloud Run 每月 200 萬 requests、Firebase Hosting 10GB/月)

---

## 先決條件

1. 安裝 CLI(macOS 範例):
   ```bash
   brew install --cask google-cloud-sdk
   npm install -g firebase-tools
   ```

2. 登入:
   ```bash
   gcloud auth login
   firebase login
   ```

3. 啟用 billing 的 GCP project(沒有的話到 <https://console.cloud.google.com/> 建一個,本文件假設叫 `ai-advisor-prod`)。
   ```bash
   gcloud config set project ai-advisor-prod
   ```

4. 啟用需要的 API:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

---

## 步驟 1:部署 Cloud Run proxy

從 repo 根目錄執行:

```bash
gcloud run deploy ai-advisor-proxy \
  --source ./server \
  --region asia-east1 \
  --allow-unauthenticated \
  --cpu 1 --memory 256Mi \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 30s
```

約 2-3 分鐘後會印出 service URL,長這樣:
```
Service URL: https://ai-advisor-proxy-xxxxx-de.a.run.app
```

**測試**:
```bash
curl "https://ai-advisor-proxy-xxxxx-de.a.run.app/healthz"
curl "https://ai-advisor-proxy-xxxxx-de.a.run.app/twse/mis?codes=2330,0050"
```

應該看到即時報價。

---

## 步驟 2:把 proxy URL 填入前端

編輯 `index.html` 的 `<meta name="proxy-base">` tag:

```html
<meta name="proxy-base" content="https://ai-advisor-proxy-xxxxx-de.a.run.app"/>
```

(⚠ URL 最後不要加斜線)

commit + push:
```bash
git add index.html
git commit -m "point frontend to cloud run proxy"
git push origin main
```

---

## 步驟 3:部署 Firebase Hosting

1. 把 `.firebaserc` 的 `PLEASE-SET-YOUR-FIREBASE-PROJECT-ID` 換成你的 Firebase project ID
   (通常等於 GCP project ID,或在 <https://console.firebase.google.com/> 建立時指定)。

2. 部署:
   ```bash
   firebase deploy --only hosting
   ```

約 30 秒後會印出 hosting URL,例如:
```
Hosting URL: https://ai-advisor-prod.web.app
```

---

## 步驟 4:可選 — 鎖定 proxy 只給自家前端用

若 Cloud Run URL 被人拿去當公用 proxy 會超支。部署完成後,把 `CORS_ORIGIN` 限定只允許你的網域:

```bash
gcloud run services update ai-advisor-proxy \
  --region asia-east1 \
  --update-env-vars CORS_ORIGIN=https://ai-advisor-prod.web.app
```

(多個來源用逗號或 `*` 覆蓋成寬鬆)

---

## 自訂網域(可選)

Firebase Hosting 免費綁自訂網域:

```bash
firebase hosting:sites:list
firebase hosting:channel:deploy preview   # 預覽通道
```

或 console 操作:<https://console.firebase.google.com/> → Hosting → Add custom domain。

---

## 日常更新

**前端**:改 code → `git push` → 手動跑 `firebase deploy --only hosting`
(或接 GitHub Actions 自動 deploy)

**Proxy**:改 `server/index.js` → 重跑步驟 1 的 `gcloud run deploy`
(Cloud Run 從 source 重 build,~2 分鐘)

---

## 預估成本

小流量(個人使用)幾乎是 0:
- Cloud Run:前 200 萬 requests/月免費,超過 $0.40/百萬
- Firebase Hosting:前 10GB/月免費
- Cloud Build:每天 120 分鐘免費
- Egress:Asia ↔ Worldwide 前 1GB/月免費

流量大時(>1000 DAU),評估一下 `min-instances` 是否保留 1 台以避免冷啟動
(每個月約 $5-10 的 always-on 成本)。

---

## 疑難排解

**Cloud Run 回 403**:`--allow-unauthenticated` 漏掉。重跑 deploy 指令。

**MIS 回空**:TWSE MIS 會擋「非台灣 IP」,請選 `asia-east1`(台北附近)或 `asia-southeast1`。

**Firebase 上去後 App 打不到 API**:檢查瀏覽器 DevTools Network,看 `/yahoo/chart` 的 URL 是否指到 Cloud Run;若不是,表示 `<meta name="proxy-base">` 還沒更新或 cache 沒刷新。

**Cloud Run 冷啟動慢**:`--min-instances 1` 固定 1 台(~$10/月)。
