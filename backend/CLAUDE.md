# 後端開發規範

本專案為 Express 5 + TypeScript 電商 API，遵循根目錄 [AGENTS.md](../AGENTS.md) 的商業規則與 API 契約。

## 技術棧

- Express 5（async route 錯誤自動進 error middleware，**不要**用 Express 4 慣用法如 `app.use('*')`）
- better-sqlite3（同步 API）、jsonwebtoken + bcryptjs
- zod + @asteasolutions/zod-to-openapi（request 驗證與 OpenAPI 文件同源）
- swagger-ui-express（`/api-docs`）、swagger-parser（產生時驗證文件）
- ESM（`"type": "module"`）+ TypeScript，tsx 直接執行，無 build 步驟
- Vitest + supertest（測試時 `DB_PATH=:memory:`）

## 目錄結構

```
openapi.json        # 產物：由 zod schema 產生的 OpenAPI 3.0.3 文件（不可手改）
postman/
├── collection.json # 產物：由 openapi.json 產生（不可手改）
└── environment.json# 可自行編輯：baseUrl、帳密、執行期變數
scripts/
├── generate-openapi.ts   # 產生 + SwaggerParser 驗證；--check 做漂移檢查
└── generate-postman.ts   # openapi.json → collection；--check 做漂移檢查
src/
├── app.ts          # 建立並 export app（不 listen、不起背景任務）＋掛 /api-docs、/openapi.json
├── server.ts       # listen 3001 + startNotificationWorker()
├── db/index.ts     # SQLite 連線（DB_PATH env）、建表、migration、seed
├── middleware/     # auth（JWT／角色）、validate（zod）、errorHandler（統一錯誤 envelope）
├── openapi/        # zod.ts、schemas/、registry.ts、document.ts
├── routes/         # health, auth, products, coupons, orders, ecpay
└── services/       # pricing（金額計算純函式）、coupons、ecpayClient、notifier
```

## 重要提醒

- 資料庫欄位 snake_case，API JSON 欄位 camelCase。
- 金額計算只能經過 `services/pricing.ts` 的 `calculateOrderAmount()`。
- `merchant_trade_no` 每次 checkout 重新產生（綠界不接受重複編號）。
- 付款狀態唯一來源是 QueryTradeInfo（check-payment），`/api/ecpay/result` 只轉址不寫 DB。
- 需要 `.env`（參考 `.env.example`）：`JWT_SECRET`、`ECPAY_*`、`BASE_URL`、`FRONTEND_URL`、`DB_PATH`（可省略）。

## OpenAPI 與 zod

- **契約異動流程**：改 `src/openapi/schemas/` → `pnpm openapi:generate` → 同步 `AGENTS.md` 契約表。`openapi.json` 是產物，**不可手改**；`pnpm openapi:check` 是漂移守門員。
- `src/openapi/zod.ts` 是全專案唯一呼叫 `extendZodWithOpenApi(z)` 的地方，所有 schema 檔一律 `import { z } from '../zod.js'`，不要直接 `from 'zod'`。
- **`src/openapi/**` 不得 import `db/index.js` 或任何 route 檔**。`db/index.ts` 在模組載入時就建表 + seed（side effect），產生 script 若間接載入它會生出多餘的 sqlite 檔。依賴方向永遠是 `routes → openapi/schemas`。
- 具名 component 必須在 `registry.ts` 的 `COMPONENTS` 陣列**明確註冊**。若只靠被引用而自動註冊，使用端的 `.nullable()`／`.describe()` 會被寫進 component 本身（例如 `PreviewResult.coupon` 的 nullable 會污染 `CouponRule`），而不是以 `allOf` 套在引用處。
- 鎖 OpenAPI **3.0.3**（`OpenApiGeneratorV3`）：`swagger-parser@10` 只支援到 3.0，且 Postman 匯入 3.0 最穩。
- `document.ts` 的 `servers` 寫死 `http://localhost:3001`，不讀 `BASE_URL` —— 否則不同環境產出的 `openapi.json` 會不一致，漂移檢查永遠紅燈。
- `validateBody` 只取 `issues[0]` 的訊息，因此 **schema 的欄位順序即驗證順序**。既有端點的錯誤訊息是契約的一部分，改動 schema 時不要更動它們。
- 刻意不驗的地方：`POST /api/auth/login`（缺欄位維持 401，不洩漏帳號是否存在）、`:id` path param（不做 coercion，`GET /api/orders/abc` 維持 404）、`items[].quantity` 不加 `.int()`。

## 優惠券與權限

- 使用次數上限用**條件式 UPDATE** 原子完成（`services/coupons.ts` 的 `consumeCoupon`），不可先讀再寫。`findUsableCoupon` 是 transaction 外的快檢，只為了讓錯誤更早回報。
- `role` 每次從 DB 查（`middleware/auth.ts` 的 `assertAdmin`），**不放進 JWT payload** —— 否則撤銷 admin 後舊 token 仍是管理者。
- 不提供優惠券硬刪除：`orders.coupon_id` 會參照優惠券，改用 `PATCH` 設 `isActive: false`。
- `db/index.ts` 的 `ensureColumn()` 是給既有 `dev.sqlite` 補欄位用的極簡 migration。SQLite 的 `ADD COLUMN` 不支援全部約束，所以 migration 版本不帶 CHECK，新建的 DB 才有；實際輸入一律由 zod 把關。帳號與優惠券 seed 是冪等的（依 email／code 判斷），商品 seed 仍只在 products 為空時執行。

## Postman collection

- **產生鏈**：zod schema → `pnpm openapi:generate` → `openapi.json` → `pnpm postman:generate` → `postman/collection.json`。collection 是產物，**不可手改**；要調整請求內容改 `scripts/generate-postman.ts`。
- `openapi-to-postmanv2` 的原始輸出每次都帶新的隨機 UUID（`_postman_id` 與每個 response 的 `id`），所以 script 會把它們去掉並寫入固定的 `_postman_id`，`postman:check` 的漂移檢查才有意義。
- script 只做**變數擷取**（登入存 token、建單存 orderId、建券存 couponId），**不加任何斷言** —— 契約斷言留給後續的 contract test 階段。
- `openapi.json` 只有一條 `POST /api/auth/login`，script 會複製成「登入（會員）」與「登入（管理者）」兩個請求，分別寫入 `token` 與 `adminToken`；否則 collection 無法操作需要 admin 的優惠券端點。
- `newUserEmail`／`newCouponCode` 用 Postman 動態變數 `{{$timestamp}}` 產生唯一值，讓整份 collection 可以重複執行。

### 變數分層（三個坑，動之前先讀）

1. **collection variable 自帶完整預設值**（`scripts/generate-postman.ts` 的 `DEFAULTS`），只匯入 collection、不掛 environment 也能從頭跑到尾。environment 定義同名變數時優先序較高，會覆寫。
2. **執行期變數（`token`／`adminToken`／`orderId`／`couponId`）只定義在 collection 這一層，environment 不可重複定義。** Postman 的優先序是 environment > collection，若 environment 也有 `token: ""`，空字串會蓋掉 script 寫入的值，整條鏈就斷了。
3. **environment 不要用 `type: "secret"`。** Postman 匯入時不會帶入 secret 型別的值，使用者會看到空白欄位。這是課程的公開 seed 帳密，一律用 `default`。

另外 `orderId`／`couponId` 的初始值刻意留空：若給寫死的 `1`，當「建立優惠券」失敗時後面的 PATCH 會改到 `WELCOME10`（id 1），破壞課程的金額基準；留空時 PATCH 會安全地落到 404。

## 給第 3 階段（契約測試）的備忘

- OpenAPI 3.0 的 nullable 欄位（`couponId`、`merchantTradeNo`、`paidAt`、`usageLimit`、`PreviewResult.coupon`）產出的是 `nullable: true`，而 Postman 的 `pm.response.to.have.jsonSchema` 底層是 ajv，**不認得 `nullable`**。轉 collection 時要改寫成 `anyOf` 或放寬該欄位斷言。
- ESM 下 import `openapi.json` 要寫 `with { type: "json" }`。
- `pnpm test` 目前刻意不含 openapi 相關測試（漂移檢查獨立成 `pnpm openapi:check`），讓 `test/unit` 分支能從零開始長出第一個測試。
