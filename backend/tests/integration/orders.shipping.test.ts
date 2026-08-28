import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../helpers.js';

// 訂單 API 運費整合測試：確認 API 回傳的 shippingFee 與 total 皆正確。
// seed 商品：id=1 經典玫瑰花束 980；id=3 向日葵花束 1680。
// seed 會員：user@example.com / 12345678。

let token: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@example.com', password: '12345678' });
  token = res.body.data.token;
});

function createOrder(body: Record<string, unknown>) {
  return request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send(body);
}

describe('POST /api/orders 運費整合', () => {
  it('未指定 shipping：預設宅配，小計 980 收基本運費 120', async () => {
    const res = await createOrder({ items: [{ productId: 1, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(980);
    expect(res.body.data.shippingFee).toBe(120);
    expect(res.body.data.shippingMethod).toBe('HOME_DELIVERY');
    expect(res.body.data.total).toBe(980 + 120);
  });

  it('超商取貨：小計 980 收 60', async () => {
    const res = await createOrder({
      items: [{ productId: 1, quantity: 1 }],
      shipping: { method: 'CONVENIENCE_STORE' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.shippingFee).toBe(60);
    expect(res.body.data.total).toBe(980 + 60);
  });

  it('宅配滿額免運：小計 1680 免基本運費，total 等於小計', async () => {
    const res = await createOrder({ items: [{ productId: 3, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(1680);
    expect(res.body.data.shippingFee).toBe(0);
    expect(res.body.data.total).toBe(1680);
  });

  it('滿額免運 + 偏遠 + 急件：運費 = 0 + 200 + 250', async () => {
    const res = await createOrder({
      items: [{ productId: 3, quantity: 1 }],
      shipping: { method: 'HOME_DELIVERY', isRemoteArea: true, isSameDay: true },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.shippingFee).toBe(450);
    expect(res.body.data.total).toBe(1680 + 450);
  });

  it('優惠券 + 運費同時計算：total = subtotal - discount + shippingFee', async () => {
    // WELCOME10：9 折、上限 300、低消 1000。
    // 用 2 件 980 = 1960，折扣 min(floor(1960*10/100)=196, 300)=196，宅配滿額免運 → 運費 0。
    const res = await createOrder({
      items: [{ productId: 1, quantity: 2 }],
      couponCode: 'WELCOME10',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(1960);
    expect(res.body.data.discount).toBe(196);
    expect(res.body.data.shippingFee).toBe(0);
    expect(res.body.data.total).toBe(1960 - 196 + 0);
  });

  it('不合法配送方式回 400 INVALID_SHIPPING_METHOD', async () => {
    const res = await createOrder({
      items: [{ productId: 1, quantity: 1 }],
      shipping: { method: 'DRONE' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SHIPPING_METHOD');
  });
});
