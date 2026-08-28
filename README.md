# 電商平台測試教學範例

前後端分離的最小電商服務，作為「AI 測試實戰」課程的基礎案例。
功能：會員註冊/登入、商品列表、購物車、優惠券折扣、配送費用計算、綠界（ECPay staging）信用卡付款、訂單與庫存、通知背景任務。

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

## 付款方式

綠界付款方式全開（`ChoosePayment: ALL`）：信用卡、ATM 銀行轉帳、超商代碼等（實際顯示依綠界測試環境）。

- **信用卡**：即時完成，付款後轉回訂單頁自動更新為「已付款」。
- **ATM 銀行轉帳**：綠界頁面取得虛擬帳號（取號）後點「返回商店」回到訂單頁；staging 可登入綠界廠商後台（`stagetest3` / `test1234`）模擬入帳，訂單頁輪詢後轉「已付款」。

## 文件

- [AGENTS.md](AGENTS.md) — 開發規範、商業規則（優惠券／運費）與 API 契約。
- [docs/shipping.md](docs/shipping.md) — 配送費用計算規則與 Shipping 模組說明。
- [docs/testing.md](docs/testing.md) — 測試流程（單元／整合／E2E）與 Postman 產生說明。
- [docs/openapi.json](docs/openapi.json) — OpenAPI 3.0 API 規格（`npm run openapi` 產生）。
- [docs/postman_collection.json](docs/postman_collection.json) — Postman Collection（`npm run postman` 產生）。

## 測試

於 `backend/` 執行（詳見 [docs/testing.md](docs/testing.md)）：

```bash
npm run test:unit          # 單元測試
npm run test:integration   # 整合測試（Supertest + in-memory SQLite，不動 dev.sqlite）
npm run test:e2e           # Playwright E2E（需先啟動前後端與 admin 帳號）
npm run postman            # 產生 openapi.json 與 postman_collection.json
```

## 配送費用

- 宅配基本運費 120 元；超商取貨 60 元。
- 商品小計滿 1,500 元免宅配基本運費；超商取貨不在此限，滿額仍收 60 元。
- 偏遠地區 +200 元、當日急件 +250 元（附加費，任何配送方式都加收）。

## 開發規範

見 [AGENTS.md](AGENTS.md)（含商業規則與 API 契約）。
