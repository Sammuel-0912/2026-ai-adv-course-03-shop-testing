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

## 測試帳號與資料（seed）

- 會員：`user@example.com` / `12345678`
- 優惠券：`WELCOME10`（9 折、折抵上限 300、低消 1000）
- 綠界 staging 測試卡：`4311-9522-2222-2222`，有效期限任意未來日期，CVC 任意，3D 驗證碼 `1234`

## 開發規範

見 [AGENTS.md](AGENTS.md)（含商業規則與 API 契約）。
