# 配送費用計算（Shipping 模組）

運費邏輯封裝於獨立、可單元測試的純函式模組 [`backend/src/utils/shipping.ts`](../backend/src/utils/shipping.ts)，
並整合至建立訂單流程 [`backend/src/routes/orders.ts`](../backend/src/routes/orders.ts)。

## 業務規則

所有金額皆為整數 TWD。

| 條件 | 費用 | 說明 |
| --- | --- | --- |
| 宅配基本運費 | **120** | 配送方式 `HOME_DELIVERY` |
| 超商取貨 | **60** | 配送方式 `CONVENIENCE_STORE` |
| 商品小計 ≥ 1,500（含等於） | 免**基本運費** | **僅宅配**適用；超商取貨不在此限 |
| 偏遠地區 | +200 | 附加費，任何配送方式都加收 |
| 當日急件 | +250 | 附加費，任何配送方式都加收 |

運費 = `baseFee`（基本運費，宅配達滿額免運門檻時為 0）+ `surcharge`（偏遠 + 急件）。

> **重點**：滿額免運只免宅配的「基本運費」。超商取貨不在此限——**即使商品小計滿 1,500，
> 選超商取貨仍需付 60 元**。附加費（偏遠、急件）不受滿額免運影響，達門檻時仍照收。

## 模組 API

```ts
calculateShipping({
  method: 'HOME_DELIVERY' | 'CONVENIENCE_STORE',
  subtotal: number,           // 商品小計，用於判斷滿額免運
  isRemoteArea?: boolean,     // 預設 false
  isSameDay?: boolean,        // 預設 false
}): {
  method,
  baseFee,             // 基本運費（已套用滿額免運）
  surcharge,           // 附加費合計
  fee,                 // 運費總額 = baseFee + surcharge
  freeShippingApplied, // 是否套用滿額免運（僅宅配可能為 true）
}
```

不合法的 `method` 會丟出 `AppError(400, 'INVALID_SHIPPING_METHOD')`。

## 與訂單金額的關係

建立訂單時，訂單總額計算順序：

```
subtotal          = Σ(price × quantity)
discount          = 優惠券折扣（calculateOrderAmount）
shippingFee       = calculateShipping(...).fee
total             = subtotal - discount + shippingFee   // 綠界 TotalAmount
```

`POST /api/orders` 的 request 可帶 `shipping` 物件（未帶時預設宅配、無附加費）；
response 的 `Order` 會回傳 `shippingFee`、`shippingMethod` 與含運費的 `total`。

## 範例

| method | subtotal | 偏遠 | 急件 | baseFee | surcharge | fee |
| --- | ---: | :-: | :-: | ---: | ---: | ---: |
| HOME_DELIVERY | 980 | | | 120 | 0 | **120** |
| HOME_DELIVERY | 1,499 | | | 120 | 0 | **120** |
| HOME_DELIVERY | 1,500 | | | 0 | 0 | **0** |
| HOME_DELIVERY | 1,500 | ✓ | ✓ | 0 | 450 | **450** |
| CONVENIENCE_STORE | 980 | | | 60 | 0 | **60** |
| CONVENIENCE_STORE | 1,500 | | | 60 | 0 | **60** |
| CONVENIENCE_STORE | 2,000 | ✓ | ✓ | 60 | 450 | **510** |

## 測試

單元測試於 [`backend/tests/unit/shipping.test.ts`](../backend/tests/unit/shipping.test.ts)，涵蓋上述所有情境；
訂單流程整合測試見 [`backend/tests/integration/`](../backend/tests/integration/)。完整測試指令見 [docs/testing.md](testing.md)。

```bash
cd backend
pnpm test:unit          # 單元測試
pnpm test:integration   # 整合測試（Supertest + in-memory SQLite）
```
