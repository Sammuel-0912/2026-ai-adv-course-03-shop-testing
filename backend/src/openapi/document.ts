import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

/**
 * 產生 OpenAPI 文件。
 *
 * 鎖定 3.0.3 而非 3.1：驗證用的 swagger-parser 只支援到 OpenAPI 3.0，
 * 且 Postman 匯入 3.0 最穩定（第 3 階段契約測試需要）。
 */
export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: '花漾商店 API',
      version: '1.0.0',
      description: [
        '前後端分離電商服務的後端 API，作為「AI 測試實戰」課程的基礎案例。',
        '',
        '## 回應格式',
        '',
        '- 成功：`{ "data": <payload>, "message": <string, 可省略> }`',
        '- 失敗：`{ "error": { "code": <UPPER_SNAKE_CASE>, "message": <string> } }`',
        '',
        '## 金額規則',
        '',
        '所有金額為整數 TWD。`subtotal = Σ(price × quantity)`。',
        '',
        '1. 低消門檻：`subtotal >= minSpend` 才可折抵（含等於）。',
        '2. `discount = min(floor(subtotal × percentOff / 100), maxDiscount)`',
        '   —— 先算百分比、無條件捨去、再套折抵上限。',
        '3. `total = subtotal - discount`，必為正整數（綠界 TotalAmount 只收整數）。',
        '',
        '試算與建立訂單共用同一個 `calculateOrderAmount()` 純函式，伺服器端重算金額，',
        '不信任前端傳入的價格。',
      ].join('\n'),
    },
    // 固定寫死，不讀 BASE_URL —— 否則不同環境產出的 openapi.json 會不一致，
    // 讓 `pnpm openapi:check` 的漂移檢查永遠紅燈。
    servers: [{ url: 'http://localhost:3001', description: '本機開發' }],
    tags: [
      { name: 'Health', description: '健康檢查' },
      { name: 'Auth', description: '註冊與登入' },
      { name: 'Products', description: '商品' },
      { name: 'Coupons', description: '優惠券' },
      { name: 'Orders', description: '訂單與付款' },
      { name: 'ECPay', description: '綠界金流回呼（非前端呼叫）' },
    ],
  });
}

/** app 啟動時算好的文件，供 Swagger UI 與 GET /openapi.json 使用 */
export const openApiDocument = buildOpenApiDocument();
