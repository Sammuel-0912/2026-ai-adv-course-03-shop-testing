# 前端開發規範

本專案為 Vue 3 + Vite + TypeScript SPA，遵循根目錄 [AGENTS.md](../AGENTS.md) 的 API 契約。

## 技術棧

- Vue 3 `<script setup lang="ts">`、Pinia、Vue Router、Tailwind CSS v4（@tailwindcss/vite）
- typecheck 用 `vue-tsc --noEmit`

## 目錄結構

```
src/
├── main.ts / App.vue
├── router/index.ts   # 路由（需登入頁面有 navigation guard）
├── api/client.ts     # fetch wrapper（VITE_API_BASE，自動帶 JWT、統一解析 envelope）
├── stores/           # auth（token 存 localStorage）、cart（純前端購物車）
└── pages/            # Login, Register, ProductList, Cart, Checkout, OrderDetail
```

## 重要提醒

- 金額一律顯示後端回傳的計算結果（preview / order），前端**不自行計算折扣**。
- 關鍵互動元素必須保留 `data-testid`（E2E 測試依賴）：
  `coupon-input`、`apply-coupon`、`subtotal`、`discount`、`total`、`checkout-button`、`order-status`。
- 環境變數：`VITE_API_BASE`（預設 `http://localhost:3001`）。
