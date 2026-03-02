# Travel Planner 旅遊規劃系統
## 本專案是一個全端旅遊規劃網站，技術架構如下：
- 前端：Vite + React
- 後端：Node.js + Express
- 前端部署：Firebase Hosting
- 後端部署：Google Cloud Run
    - 使用 API：OpenAI API / Google Maps / Places / Directions API

## 一、前置準備
### 安裝 Google Cloud CLI
安裝：
``` bash
    brew install --cask google-cloud-sdk
```
初始化：
``` bash
    gcloud init
```
登入帳號後選擇專案

### 設定專案 ID
``` bash
    gcloud config set project YOUR_PROJECT_ID
```
## 二、部署 Backend 到 Cloud Run
### Step 1：啟用 API
```bash
    gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com
```

在 backend/ 新增Dockerfile：
``` dockerfile
    # backend/Dockerfile
    FROM node:20

    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    COPY . .

    EXPOSE 8080
    CMD ["npm", "start"]
```

確認 Express：
``` js
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
    });
```
### Step 2：建立 Secret（API Keys）把 Key 存到 Secret Manager
``` bash
    # OpenAI
    gcloud secrets create OPENAI_API_KEY --replication-policy="automatic"
    echo -n "新生成的 OpenAI Key" | gcloud secrets versions add OPENAI_API_KEY --data-file=-

    # Google Places
    gcloud secrets create GOOGLE_PLACES_API_KEY --replication-policy="automatic"
    echo -n "新生成的 Google Places Key" | gcloud secrets versions add GOOGLE_PLACES_API_KEY --data-file=-

    # Google Directions
    gcloud secrets create GOOGLE_DIRECTIONS_API_KEY --replication-policy="automatic"
    echo -n "新生成的 Google Directions Key" | gcloud secrets versions add GOOGLE_DIRECTIONS_API_KEY --data-file=-
```

### Step 3：給 Cloud Run Service Account 存取權限
``` bash
    gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"

    gcloud secrets add-iam-policy-binding GOOGLE_PLACES_API_KEY \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"

    gcloud secrets add-iam-policy-binding GOOGLE_DIRECTIONS_API_KEY \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
```

### Step 4：部署 Cloud Run 時掛載 Secret
``` bash
    gcloud run deploy travel-planner-api \
    --source ./backend \
    --region asia-east1 \
    --allow-unauthenticated \
    --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest \
    --set-secrets GOOGLE_PLACES_API_KEY=GOOGLE_PLACES_API_KEY:latest \
    --set-secrets GOOGLE_DIRECTIONS_API_KEY=GOOGLE_DIRECTIONS_API_KEY:latest
```

成功後會得到：
- https://travel-planner-api-xxxxx.a.run.app
<br>
這就是你的 backend API

## 三、部署 Frontend
### Step 1：環境安裝＆初始化
安裝：
``` bash
    npm install -g firebase-tools
```
登入：
``` bash 
    firebase login
```

### Step 2：firebase初始化
進入 frontend：
``` bash
    cd frontend
    firebase init
```
選：
- Hosting
- Use existing project (使用你已經建立好的 Firebase 專案（最常用）) OR
Create a new project (幫你新建一個 Firebase 專案（如果你想開一個新的）)

- public directory: dist (因為 Vue/React/前端打包後的檔案會在 dist)
- Single-page app: Yes (自動幫你加上 rewrite 到 index.html，適合 Vue/React SPA)

### Step 3：修改 API URL
在 Frontend .env裡把後端api貼到這裡：
``` .env
VITE_API_URL=https://travel-planner-api-xxxxx.a.run.app
```
### Step 4：Build 前端
``` bash
    npm run build
```
### Step 5：部署
``` bash
    firebase deploy
```
成功後會得到：
- https://travel-planner-xxx.web.app