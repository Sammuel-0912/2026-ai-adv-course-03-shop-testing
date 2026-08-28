import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, db } from '../helpers.js';

// 完整下單流程整合測試（Vitest + Supertest）。
//
// 測試環境（vitest.config.ts）：
// - DB_PATH=:memory：每個測試檔使用獨立的 in-memory SQLite，含 seed 資料。
// - fileParallelism: false：避免測試檔互相干擾。
// - 完全不觸碰專案的 data/dev.sqlite。
//
// 涵蓋：登入/建立會員 → 取得商品 → 加入購物車（品項組裝）→
//   建立含配送資訊的訂單 → 驗證 HTTP 狀態/格式、訂單與品項寫入、
//   運費與總額、庫存扣除、失敗時交易回滾（不留不完整訂單、不誤扣庫存）。

interface ProductRow {
  id: number;
  price: number;
  stock: number;
}

/** 直接查 DB 取得商品目前庫存（驗證寫入用） */
function getStock(productId: number): number {
  const row = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as
    | { stock: number }
    | undefined;
  return row?.stock ?? -1;
}

/** 目前 orders 資料表筆數 */
function orderCount(): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM orders').get() as { c: number }).c;
}

let token: string;
let products: ProductRow[];

beforeAll(async () => {
  // 1. 建立測試會員（唯一 email，測試自帶資料、可重複清除）
  const email = `it_${Date.now()}@example.com`;
  const register = await request(app)
    .post('/api/auth/register')
    .send({ email, password: '12345678', name: '整合測試會員' });
  expect(register.status).toBe(201);
  expect(register.body.data.token).toBeTruthy();
  token = register.body.data.token;

  // 2. 取得商品資料
  const res = await request(app).get('/api/products');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
  products = res.body.data;
});

function createOrder(body: Record<string, unknown>) {
  return request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send(body);
}

describe('下單成功流程', () => {
  it('建立含配送資訊的訂單：驗證回應格式、訂單/品項寫入、運費、總額、庫存扣除', async () => {
    const product = products[0]; // 經典玫瑰花束 980
    const quantity = 2;
    const stockBefore = getStock(product.id);

    // 3~4. 加入購物車（組裝品項）並建立訂單（宅配 + 偏遠 + 急件）
    const res = await createOrder({
      items: [{ productId: product.id, quantity }],
      shipping: { method: 'HOME_DELIVERY', isRemoteArea: true, isSameDay: true },
    });

    // HTTP 狀態碼與回應格式（envelope）
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('message');
    const order = res.body.data;

    // 金額：subtotal = 980*2 = 1960；>=1500 → 宅配免基本運費；附加費 200+250 = 450
    const expectedSubtotal = product.price * quantity;
    expect(order.subtotal).toBe(expectedSubtotal);
    expect(order.discount).toBe(0);
    expect(order.shippingFee).toBe(450);
    expect(order.shippingMethod).toBe('HOME_DELIVERY');
    expect(order.total).toBe(expectedSubtotal - 0 + 450);
    expect(order.status).toBe('pending');

    // 訂單品項正確
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productId: product.id,
      quantity,
      unitPrice: product.price,
    });

    // 訂單正確寫入 DB
    const dbOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) as {
      subtotal: number;
      discount: number;
      shipping_fee: number;
      shipping_method: string;
      total: number;
      status: string;
    };
    expect(dbOrder).toBeTruthy();
    expect(dbOrder.subtotal).toBe(expectedSubtotal);
    expect(dbOrder.shipping_fee).toBe(450);
    expect(dbOrder.shipping_method).toBe('HOME_DELIVERY');
    expect(dbOrder.total).toBe(order.total);
    expect(dbOrder.status).toBe('pending');

    // 訂單品項正確寫入 DB
    const dbItems = db
      .prepare('SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = ?')
      .all(order.id) as Array<{ product_id: number; quantity: number; unit_price: number }>;
    expect(dbItems).toHaveLength(1);
    expect(dbItems[0]).toMatchObject({
      product_id: product.id,
      quantity,
      unit_price: product.price,
    });

    // 商品庫存正確扣除
    expect(getStock(product.id)).toBe(stockBefore - quantity);
  });

  it('超商取貨訂單：運費 60、總額含運費，且建立 pending 通知', async () => {
    const product = products[0];
    const res = await createOrder({
      items: [{ productId: product.id, quantity: 1 }],
      shipping: { method: 'CONVENIENCE_STORE' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.shippingFee).toBe(60);
    expect(res.body.data.total).toBe(product.price + 60);

    // 建立訂單會同時寫入一筆 pending 通知
    const notif = db
      .prepare("SELECT * FROM notifications WHERE order_id = ? AND type = 'order_created'")
      .get(res.body.data.id);
    expect(notif).toBeTruthy();
  });
});

describe('下單失敗流程（交易回滾）', () => {
  it('庫存不足時：回 409、不留下不完整訂單、不誤扣其他商品庫存', async () => {
    const okProduct = products[0]; // 有庫存
    const bigProduct = products[1]; // 第二項要求超量
    const stockBefore = getStock(okProduct.id);
    const ordersBefore = orderCount();

    const res = await createOrder({
      items: [
        { productId: okProduct.id, quantity: 1 },
        { productId: bigProduct.id, quantity: 999999 },
      ],
    });

    // HTTP 409 + 錯誤 envelope
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    // 不留下不完整訂單（orders 筆數不變）
    expect(orderCount()).toBe(ordersBefore);

    // 不誤扣第一項庫存（transaction rollback）
    expect(getStock(okProduct.id)).toBe(stockBefore);
  });

  it('未登入建立訂單回 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: products[0].id, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('空 items 回 400 VALIDATION_ERROR', async () => {
    const res = await createOrder({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('購物車為前端狀態（後端不保留）', () => {
  // 「建立訂單後購物車清空」屬前端 Pinia store 行為，於 E2E 驗證。
  // 後端不持有購物車狀態：每次建立訂單都獨立扣庫存，可藉此佐證伺服器端無殘留購物車。
  it('重複送出相同品項會再次扣庫存（伺服器不快取購物車）', async () => {
    const product = products[0];
    const stockBefore = getStock(product.id);

    await createOrder({ items: [{ productId: product.id, quantity: 1 }] });
    await createOrder({ items: [{ productId: product.id, quantity: 1 }] });

    expect(getStock(product.id)).toBe(stockBefore - 2);
  });
});
