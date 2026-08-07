# AGENTS.md

## 專案結構

- `frontend/`：Vue 3 + Vite + TypeScript 前端（Pinia、Vue Router、Tailwind v4）。
- `backend/`：Express 5 + TypeScript 後端 API（better-sqlite3、JWT），ESM，tsx 執行。
- `backend/src/openapi/`：zod schema 與 OpenAPI registry（API 契約的唯一真實來源）。
- `backend/openapi.json`：由 zod schema 產生的 OpenAPI 3.0.3 文件（產物，不可手改）。
- `backend/postman/`：由 `openapi.json` 產生的 Postman collection（產物，不可手改）與可自行編輯的 environment。
- `.claude/skills/ecpay/`：綠界金流整合 skill（staging 測試環境）。
- 前後端各自有 `package.json`、`.env`、`CLAUDE.md`，互相只透過 HTTP API 溝通。

## 常用指令

| 位置 | 指令 | 用途 |
| --- | --- | --- |
| `backend/` | `pnpm dev` | 啟動 API（http://localhost:3001，tsx watch） |
| `backend/` | `pnpm typecheck` | `tsc --noEmit` |
| `backend/` | `pnpm test` | Vitest |
| `backend/` | `pnpm test:unit` | 只執行 Unit Test |
| `backend/` | `pnpm test:integration` | 只執行 Integration Test |
| `backend/` | `pnpm test:module coupon` | 依檔名篩選單一模組測試（模組名可替換） |
| `backend/` | `pnpm openapi:generate` | 由 zod schema 重產 `openapi.json` |
| `backend/` | `pnpm openapi:check` | 檢查 `openapi.json` 是否與 zod schema 同步 |
| `backend/` | `pnpm postman:generate` | 由 `openapi.json` 重產 `postman/collection.json` |
| `backend/` | `pnpm postman:check` | 檢查 collection 是否與 `openapi.json` 同步 |
| `frontend/` | `pnpm dev` | 啟動前端（http://localhost:5173） |
| `frontend/` | `pnpm typecheck` | `vue-tsc --noEmit` |
| `frontend/` | `pnpm build` | typecheck + vite build |

## 商業規則（優惠券金額計算）

所有金額為**整數 TWD**。`subtotal = Σ(price × quantity)`。

1. 低消門檻：`subtotal >= min_spend` 才可折抵（**含等於**）；未達門檻回傳錯誤 `COUPON_MIN_SPEND_NOT_MET`。
2. 折扣：`discount = min(floor(subtotal × percent_off / 100), max_discount)` —— **先算百分比、無條件捨去、再套折抵上限**。
3. `total = subtotal - discount`，必為正整數（綠界 TotalAmount 只收整數）。
4. 優惠券試算（preview）與建立訂單**必須共用同一個 `calculateOrderAmount()` 純函式**；伺服器端重算金額，不信任前端傳入的金額。

## 商業規則（優惠券使用次數）

1. `usage_limit` 為 `NULL` 代表**不限次數**。
2. 券可用的條件是 `is_active = 1` **且**（`usage_limit IS NULL` 或 `used_count < usage_limit`）；不符合時 preview 與建立訂單皆回 `409 COUPON_USAGE_LIMIT_REACHED`。
3. `used_count` 只在**建立訂單成功時**於同一個 transaction 內遞增，且**不因訂單未付款或失敗而回退**（本專案無取消訂單功能）。
4. 額度判定必須用條件式 UPDATE（`WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)`）在單一 SQL 內原子完成，**不可先讀再寫**。
5. 註冊一律建立 `role = 'member'`，**不可由 request 指定** —— 避免權限提升。

## API 契約

所有回應使用統一 envelope：

- 成功：`{ "data": <payload>, "message": <string, 可省略> }`
- 失敗：`{ "error": { "code": <UPPER_SNAKE_CASE string>, "message": <string> } }`

| Method | Path | 說明 | 成功狀態碼 |
| --- | --- | --- | --- |
| GET | `/api/health` | → `{data: {status: "ok"}}`（CI wait-on 用） | 200 |
| GET | `/api-docs` | Swagger UI 文件頁 | 200 |
| GET | `/openapi.json` | OpenAPI 3.0.3 文件（內容與 `backend/openapi.json` 相同） | 200 |
| POST | `/api/auth/register` | `{email, password, name}` → `{data: {token, user}}`（一律建立 `role: member`） | 201 |
| POST | `/api/auth/login` | `{email, password}` → `{data: {token, user}}` | 200 |
| GET | `/api/products` | → `{data: Product[]}` | 200 |
| GET | `/api/coupons` | → `{data: Coupon[]}`（預設只列啟用中）。`?includeInactive=true` 一併列出停用券，**需 admin** | 200 |
| GET | `/api/coupons/:code` | → `{data: Coupon}`；已停用視同不存在（404） | 200 |
| POST | `/api/coupons` | 需 admin。`{code, percentOff, maxDiscount, minSpend, usageLimit?, isActive?}` → `{data: Coupon}` | 201 |
| PATCH | `/api/coupons/:id` | 需 admin。部分更新（**不可改 `code`／`usedCount`**）；停用改用 `{isActive: false}`，不提供硬刪除 | 200 |
| POST | `/api/coupons/preview` | `{items: [{productId, quantity}], code?}` → `{data: {subtotal, discount, total, coupon}}`，`coupon` 為 `{code, percentOff, maxDiscount, minSpend}` 或 `null` | 200 |
| POST | `/api/orders` | 需登入。`{items, couponCode?}` → `{data: Order}`（transaction 扣庫存＋建 pending 通知） | 201 |
| GET | `/api/orders` | 需 admin。→ `{data: Order[]}`（後台訂單列表） | 200 |
| GET | `/api/orders/:id` | 需登入（僅本人）→ `{data: Order}`（含 items） | 200 |
| POST | `/api/orders/:id/checkout` | 需登入 → `{data: {html}}` 綠界自動送出表單（付款方式全開 `ALL`：信用卡／ATM 轉帳／超商等） | 200 |
| POST | `/api/ecpay/notify` | 綠界 ReturnURL（server-to-server，本地開發打不到；僅驗 CheckMacValue 後回 `1\|OK`，不寫 DB） | 200 |
| POST | `/api/ecpay/result` | 綠界 OrderResultURL（瀏覽器 form POST），**只 302 redirect** 回前端訂單頁，不寫 DB | 302 |
| POST | `/api/orders/:id/check-payment` | 需登入。向綠界 QueryTradeInfo 查詢，`TradeStatus === '1'` → 更新 paid ＋建通知 | 200 |

錯誤狀態碼慣例：400 驗證失敗、401 未授權、403 權限不足（`FORBIDDEN`）、404 不存在、409 衝突。

409 的錯誤碼：`EMAIL_TAKEN`、`INSUFFICIENT_STOCK`、`ORDER_NOT_PAYABLE`、`COUPON_CODE_TAKEN`、`COUPON_USAGE_LIMIT_REACHED`。

## 開發規則

- 修改前先閱讀對應專案的 `package.json` 與 `CLAUDE.md`。
- **API 契約異動流程**：先改 `backend/src/openapi/schemas/`（zod 是唯一真實來源）→ `pnpm openapi:generate` 重產 `backend/openapi.json` → `pnpm postman:generate` 重產 `backend/postman/collection.json` → 同步更新本檔的 API 契約表。**絕不手改 `openapi.json` 與 `collection.json`**；要調整請求內容請改 `scripts/generate-postman.ts`。
- request 驗證一律透過 `validateBody(schema)` middleware，不要在 route 內手寫 `if` 檢查。
- 資料庫欄位使用 **snake_case**；API JSON 欄位使用 **camelCase**。
- `backend/src/app.ts` 只建立並 export app，**不 listen、不啟動背景任務**；`server.ts` 負責 listen 3001 與 `startNotificationWorker()`。
- 不要為了讓測試通過而刪除斷言、放寬條件或更新 Snapshot。
- 未先說明原因，不要加入新的正式環境相依套件。
- 修改範圍保持最小，不處理與任務無關的重構。

## 驗證方式

- 修改 `backend/` 時：`pnpm typecheck`、`pnpm openapi:check`、`pnpm postman:check` 與相關測試。
- 修改 `frontend/` 時：`pnpm typecheck`。
- 局部驗證通過後，才執行完整測試或交給 CI。

## 停止條件

- 同一問題最多嘗試修正三次。
- 無法判斷需求、測試持續不穩定或需要高風險操作時，停止並交回人工確認。

## 完成回報

- 說明修改了哪些檔案。
- 列出已執行的檢查與測試結果。
- 標示尚未驗證的項目與原因。
