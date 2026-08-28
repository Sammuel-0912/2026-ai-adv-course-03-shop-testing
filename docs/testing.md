# 測試與 API 文件流程

指令一律在 `backend/` 執行（可用 `pnpm` 或 `npm run`）。

| 指令 | 用途 |
| --- | --- |
| `npm run test:unit` | 單元測試（`tests/unit`）——Shipping 純函式模組 |
| `npm run test:integration` | 整合測試（`tests/integration`）——Vitest + Supertest，in-memory SQLite |
| `npm run test:e2e` | E2E（Playwright）——實際登入、結帳、綠界付款流程 |
| `npm run postman` | 產生 `docs/openapi.json` 並轉出 `docs/postman_collection.json` |
| `npm run openapi` | 只產生 `docs/openapi.json` |

## ⑴ Integration Test（Vitest + Supertest）

- 測試環境由 `vitest.config.ts` 設定：`DB_PATH=:memory:`（每個測試檔獨立的記憶體 SQLite，含 seed），`fileParallelism: false`。
- **完全不觸碰** `backend/data/dev.sqlite`；每次測試自帶並清除資料。
- `tests/integration/order-flow.test.ts` 涵蓋：
  - 建立測試會員 → 取得商品 → 組裝購物車品項 → 建立含配送資訊的訂單。
  - HTTP 狀態碼與 envelope 格式、訂單與品項是否正確寫入（直接查 DB 驗證）。
  - 運費與訂單總額、商品庫存扣除。
  - 失敗流程（庫存不足）：回 409、不留下不完整訂單、交易回滾不誤扣庫存。
  - 未登入 401、空 items 400。
  - 「購物車清空」屬前端 Pinia store 行為，於 E2E 驗證；後端不保留購物車狀態。
- `tests/integration/orders.shipping.test.ts`：各配送情境的運費與總額。

## ⑵ E2E Test（Playwright）

**前置**（直接使用已啟動的專案，不另外啟動測試伺服器）：

1. 後端：`backend/` 執行 `pnpm dev`（http://localhost:3001）。
2. 前端：`frontend/` 執行 `pnpm dev`（http://localhost:5173）。
3. 安裝 Playwright 瀏覽器（第一次）：`cd backend && npx playwright install chromium`。
4. 測試帳號 `admin@hexschool.com` / `12345678`（若不存在，先於前端註冊或 `POST /api/auth/register`）。

> **關於埠**：E2E 的 UI 流程（登入、購物車、結帳）都在**前端 5173**；`3001` 是純 API（無畫面）。
> 因此 `playwright.config.ts` 的 `baseURL` 指向 5173，可用 `E2E_BASE_URL` 覆寫。

`e2e/checkout.spec.ts` 流程：登入 → 加入購物車 → 結帳頁選配送方式 → 建立訂單 →
綠界（staging）**網路 ATM** → **台灣土地銀行** → 前往付款 → 關閉提示視窗 →
土地銀行測試頁 `Save` → 付款成功 → 返回商店 → 驗證訂單顯示「已付款」→ 成功截圖
（`e2e/screenshots/paid-success.png`）。

> 綠界 staging 與土地銀行測試頁的 DOM 可能隨改版變動；spec 內選擇器採寬鬆比對，必要時依實際頁面微調。

## ⑶ Postman Collection

`npm run postman` 會：

1. 執行 OpenAPI 產生器（`scripts/generate-openapi.ts`）輸出 `docs/openapi.json`。
2. 轉換成 Postman Collection v2.1（`scripts/openapi-to-postman.ts`）輸出 `docs/postman_collection.json`。

Collection 特性：

- 以 `{{baseUrl}}` 為 API 網址，預設 `http://localhost:3001`。
- 內建 `baseUrl`、`token`、`sessionId` 三個變數。
- Collection 層級套用 Bearer `{{token}}`；公開端點個別標記 `noauth`。
- 登入端點（`POST /api/auth/login`）附測試腳本，成功後自動把 JWT 存入 `token`。

匯入 Postman 後，先跑登入請求取得 token，其餘需登入的 API 會自動帶 Bearer Token。
