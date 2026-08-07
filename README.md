# 電商平台測試教學範例

前後端分離的最小電商服務，作為「AI 測試實戰」課程的基礎案例。
功能：會員註冊/登入、商品列表、購物車、優惠券折扣、綠界（ECPay staging）信用卡付款、訂單與庫存、通知背景任務。

## 專案結構

- `backend/` — Express 5 + TypeScript + SQLite（better-sqlite3）API，port 3001
- `frontend/` — Vue 3 + Vite + TypeScript SPA，port 5173

## 快速開始

Node.js 22（見 `.nvmrc`）。

```bash
# 後端
cd backend
cp .env.example .env
pnpm install
pnpm dev        # http://localhost:3001

# 前端（另開終端機）
cd frontend
cp .env.example .env
pnpm install
pnpm dev        # http://localhost:5173
```

資料庫於後端啟動時自動建表與 seed（SQLite 檔案在 `backend/data/`，不入版控）。

## API 文件

後端啟動後開 **http://localhost:3001/api-docs**（Swagger UI），原始文件在 http://localhost:3001/openapi.json。

文件由 `backend/src/openapi/` 的 zod schema 產生，同一份 schema 也負責 request 驗證。

## Postman

`backend/postman/` 內有由 `openapi.json` 產生的 collection 與對應的 environment，兩個檔案直接匯入 Postman 即可（記得在右上角選取「花漾商店 - 本機」environment）。

```bash
cd backend
pnpm openapi:generate   # zod schema → openapi.json
pnpm postman:generate   # openapi.json → postman/collection.json
```

environment 已帶好 `baseUrl` 與 seed 帳密（`memberEmail`／`adminEmail` 等）。跑「登入（會員）」「登入（管理者）」後會自動把 `token`／`adminToken` 寫回 environment，其餘請求即可直接使用；`orderId`／`couponId` 同樣由「建立訂單」「建立優惠券」自動填入。

**契約異動請改 zod schema 後重新產生，不要手改 `openapi.json` 與 `collection.json`。**

## 測試帳號與資料（seed）

- 會員：`user@example.com` / `12345678`
- 管理者：`admin@example.com` / `12345678`（優惠券管理端點需要）
- 優惠券：
  - `WELCOME10`（9 折、折抵上限 300、低消 1000、不限次數）
  - `LIMITED1`（同上，但**只能用一次**，用來示範額度用罄）
  - `DISABLED10`（已停用）
- 綠界 staging 測試卡：`4311-9522-2222-2222`，有效期限任意未來日期，CVC 任意，3D 驗證碼 `1234`

## 付款方式

綠界付款方式全開（`ChoosePayment: ALL`）：信用卡、ATM 銀行轉帳、超商代碼等（實際顯示依綠界測試環境）。

- **信用卡**：即時完成，付款後轉回訂單頁自動更新為「已付款」。
- **ATM 銀行轉帳**：綠界頁面取得虛擬帳號（取號）後點「返回商店」回到訂單頁；staging 可登入綠界廠商後台（`stagetest3` / `test1234`）模擬入帳，訂單頁輪詢後轉「已付款」。

## 開發規範

見 [AGENTS.md](AGENTS.md)（含商業規則與 API 契約）。
