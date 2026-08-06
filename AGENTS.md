# AGENTS.md

## 專案結構

- `frontend/`：Vue 3 + Vite + TypeScript 前端（Pinia、Vue Router、Tailwind v4）。
- `backend/`：Express 5 + TypeScript 後端 API（better-sqlite3、JWT），ESM，tsx 執行。
- `.claude/skills/ecpay/`：綠界金流整合 skill（staging 測試環境）。
- 前後端各自有 `package.json`、`.env`、`CLAUDE.md`，互相只透過 HTTP API 溝通。

## 常用指令

| 位置 | 指令 | 用途 |
| --- | --- | --- |
| `backend/` | `pnpm dev` | 啟動 API（http://localhost:3001，tsx watch） |
| `backend/` | `pnpm typecheck` | `tsc --noEmit` |
| `backend/` | `pnpm test` | Vitest |
| `frontend/` | `pnpm dev` | 啟動前端（http://localhost:5173） |
| `frontend/` | `pnpm typecheck` | `vue-tsc --noEmit` |
| `frontend/` | `pnpm build` | typecheck + vite build |

## 商業規則（優惠券金額計算）

所有金額為**整數 TWD**。`subtotal = Σ(price × quantity)`。

1. 低消門檻：`subtotal >= min_spend` 才可折抵（**含等於**）；未達門檻回傳錯誤 `COUPON_MIN_SPEND_NOT_MET`。
2. 折扣：`discount = min(floor(subtotal × percent_off / 100), max_discount)` —— **先算百分比、無條件捨去、再套折抵上限**。
3. `total = subtotal - discount`，必為正整數（綠界 TotalAmount 只收整數）。
4. 優惠券試算（preview）與建立訂單**必須共用同一個 `calculateOrderAmount()` 純函式**；伺服器端重算金額，不信任前端傳入的金額。

## API 契約

所有回應使用統一 envelope：

- 成功：`{ "data": <payload>, "message": <string, 可省略> }`
- 失敗：`{ "error": { "code": <UPPER_SNAKE_CASE string>, "message": <string> } }`

| Method | Path | 說明 | 成功狀態碼 |
| --- | --- | --- | --- |
| GET | `/api/health` | → `{data: {status: "ok"}}`（CI wait-on 用） | 200 |
| POST | `/api/auth/register` | `{email, password, name}` → `{data: {token, user}}` | 201 |
| POST | `/api/auth/login` | `{email, password}` → `{data: {token, user}}` | 200 |
| GET | `/api/products` | → `{data: Product[]}` | 200 |
| POST | `/api/coupons/preview` | `{items: [{productId, quantity}], code?}` → `{data: {subtotal, discount, total, coupon?}}` | 200 |
| POST | `/api/orders` | 需登入。`{items, couponCode?}` → `{data: Order}`（transaction 扣庫存＋建 pending 通知） | 201 |
| GET | `/api/orders/:id` | 需登入（僅本人）→ `{data: Order}`（含 items） | 200 |
| POST | `/api/orders/:id/checkout` | 需登入 → `{data: {html}}` 綠界自動送出表單（付款方式全開 `ALL`：信用卡／ATM 轉帳／超商等） | 200 |
| POST | `/api/ecpay/notify` | 綠界 ReturnURL（server-to-server，本地開發打不到；僅驗 CheckMacValue 後回 `1\|OK`，不寫 DB） | 200 |
| POST | `/api/ecpay/result` | 綠界 OrderResultURL（瀏覽器 form POST），**只 302 redirect** 回前端訂單頁，不寫 DB | 302 |
| POST | `/api/orders/:id/check-payment` | 需登入。向綠界 QueryTradeInfo 查詢，`TradeStatus === '1'` → 更新 paid ＋建通知 | 200 |

錯誤狀態碼慣例：400 驗證失敗、401 未授權、404 不存在、409 衝突（如 email 重複、庫存不足 `INSUFFICIENT_STOCK`）。

## 開發規則

- 修改前先閱讀對應專案的 `package.json` 與 `CLAUDE.md`。
- API 欄位異動屬於契約變更：必須同步更新本檔的 API 契約表，再修改程式。
- 資料庫欄位使用 **snake_case**；API JSON 欄位使用 **camelCase**。
- `backend/src/app.ts` 只建立並 export app，**不 listen、不啟動背景任務**；`server.ts` 負責 listen 3001 與 `startNotificationWorker()`。
- 不要為了讓測試通過而刪除斷言、放寬條件或更新 Snapshot。
- 未先說明原因，不要加入新的正式環境相依套件。
- 修改範圍保持最小，不處理與任務無關的重構。

## 驗證方式

- 修改 `backend/` 時：`pnpm typecheck` 與相關測試。
- 修改 `frontend/` 時：`pnpm typecheck`。
- 局部驗證通過後，才執行完整測試或交給 CI。

## 停止條件

- 同一問題最多嘗試修正三次。
- 無法判斷需求、測試持續不穩定或需要高風險操作時，停止並交回人工確認。

## 完成回報

- 說明修改了哪些檔案。
- 列出已執行的檢查與測試結果。
- 標示尚未驗證的項目與原因。
