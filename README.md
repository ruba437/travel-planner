# 🧭 Travel Planner｜旅遊行程規劃系統

一個結合 AI 行程產生與 Google Maps 視覺化的旅遊規劃 Web 應用，  
使用者可透過自然語言描述旅遊需求，即時產生多日行程，並在地圖上查看路線與景點。

---

## 🔧 技術架構

### Frontend
- React (Vite)
- @react-google-maps/api
- JavaScript / CSS

### Backend
- Node.js
- Express
- PostgreSQL / Supabase
- OpenAI API
- Google Places API
- Google Direction API
- Open-Meteo

---

## ✨ 功能介紹

- 💬 AI 旅遊行程產生（JSON 結構化）
- 🗺 多日行程地圖顯示（Marker + 路線）
- 🎨 每一天不同顏色標記與順序編號
- 🔄 行程列表與地圖雙向互動
- 🔍 Google Places 真實座標與照片

---

## 📂 專案結構

```text
travel-planner/
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  └─ .env (ignored)
├─ frontend/
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.js
└─ README.md


🚀 啟動方式
Backend
cd backend
npm install
npm run dev

Frontend
cd frontend
npm install
npm run dev

後端目前使用 PostgreSQL。請將 backend/example.env 填完改成 backend/.env，寫入 Supabase 提供的 DATABASE_URL。
如果 session pooler 在本機網路環境出現連線重置，可額外設定 DATABASE_URL_FALLBACK 指向 transaction pooler 的 6543 連線字串。