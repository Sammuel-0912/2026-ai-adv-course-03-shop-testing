# 後端開發規範

本專案為 Express 5 + TypeScript 電商 API，遵循根目錄 [AGENTS.md](../AGENTS.md) 的商業規則與 API 契約。

## 技術棧

- Express 5（async route 錯誤自動進 error middleware，**不要**用 Express 4 慣用法如 `app.use('*')`）
- better-sqlite3（同步 API）、jsonwebtoken + bcryptjs
- ESM（`"type": "module"`）+ TypeScript，tsx 直接執行，無 build 步驟
- Vitest + supertest（測試時 `DB_PATH=:memory:`）

## 目錄結構

```
src/
├── app.ts          # 建立並 export app（不 listen、不起背景任務）
├── server.ts       # listen 3001 + startNotificationWorker()
├── db/index.ts     # SQLite 連線（DB_PATH env）、建表、seed
├── middleware/     # auth（JWT 驗證）、errorHandler（統一錯誤 envelope）
├── routes/         # auth, products, coupons, orders, ecpay
└── services/       # pricing（金額計算純函式）、ecpayClient、notifier
```

## 重要提醒

- 資料庫欄位 snake_case，API JSON 欄位 camelCase。
- 金額計算只能經過 `services/pricing.ts` 的 `calculateOrderAmount()`。
- `merchant_trade_no` 每次 checkout 重新產生（綠界不接受重複編號）。
- 付款狀態唯一來源是 QueryTradeInfo（check-payment），`/api/ecpay/result` 只轉址不寫 DB。
- 需要 `.env`（參考 `.env.example`）：`JWT_SECRET`、`ECPAY_*`、`BASE_URL`、`FRONTEND_URL`、`DB_PATH`（可省略）。
