# 🚀 專案開發與協作規範 (Development Guide)

為了確保專案代碼的可讀性、可維護性以及 Git 協作的順暢度，請所有成員務必遵守以下開發規範。我們的目標是：**代碼整潔、邏輯分明、Merge 零衝突！**

---

## 🌿 一、 分支管理 (Branching Strategy)

禁止直接在 `main` 或 `master` 分支進行開發。請根據改動類型開啟新分支：

| 類型 | 格式 | 範例 |
| :--- | :--- | :--- |
| **新功能** | `feat/功能名稱` | `feat/ai-chat-ui` |
| **修復錯誤** | `fix/錯誤描述` | `fix/map-marker-missing` |
| **重構** | `refactor/模組名稱` | `refactor/planner-context` |
| **樣式調整** | `style/頁面名稱` | `style/login-page` |

---

## 📝 二、 Commit 訊息規範 (Commit Messages)

本專案遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範，格式如下：
`類型: 簡短描述 (中文可)`

### 常用類型標籤：
* `feat`: 新增功能 (Feature)
* `fix`: 修復 Bug
* `refactor`: 代碼重構（不影響功能邏輯的改動）
* `style`: 僅涉及格式、樣式調整（如空格、分號、CSS 調整）
* `docs`: 僅修改文件
* `perf`: 提升效能的改動

---

## 📂 三、 檔案架構與命名規範 (Naming & Structure)

### 1. 目錄結構
請將檔案放在正確的家，禁止在 `src/` 根目錄亂丟檔案：
* `src/page/`：頁面級大組件（如 Planner, Home）。
* `src/page/[功能]/segments/`：該頁面專用的子零件（拆分邏輯）。
* `src/components/`：跨頁面複用的通用組件（如 Button, Modal, MapView）。
* `src/hooks/`：封裝複用的邏輯 (Custom Hooks)。

### 2. 命名規則
* **資料夾 & 組件檔案**：統一使用 **PascalCase** (大寫開頭)。
    * ✅ `PlannerPage.jsx`, `MapView.jsx`, `HotGuide/`
* **樣式檔案**：與組件名稱保持一致。
    * ✅ `PlannerStyles.css`
* **變數 & 函數**：統一使用 **camelCase** (小寫開頭)。
    * ✅ `const [plan, setPlan] = useState()`
    * ✅ `const handleSend = () => {}`

---

## 🛠️ 四、 開發守則 (Coding Rules)

1.  **單一數據源 (Single Source of Truth)**：
    * 行程相關資料請統一從 `PlannerProvider` 拿取，禁止在子組件私自創立全域變數。
2.  **防禦性編碼**：
    * 呼叫後端 API 前，請先檢查參數是否存在，避免產生 `400 Bad Request`。
    * 讀取物件屬性請善用 Optional Chaining (`data?.user?.name`)。
3.  **PR 自檢清單**：
    * [ ] 執行 `npm run dev` 終端機與瀏覽器 Console 無紅字報錯。
    * [ ] 已移除所有測試用的 `console.log`。
    * [ ] 確保沒有未使用的變數 (Unused variables)。

---