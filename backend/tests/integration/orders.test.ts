import request from 'supertest';
import { app, db, loginAs, resetTestDatabase } from '../helpers.js';

const shippingAddress = '台北市信義區市府路 1 號';

describe('order routes and database transaction', () => {
  beforeEach(resetTestDatabase);

  it('creates an order, deducts stock, consumes the coupon and writes a notification', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: 1, quantity: 2 }],
        shippingAddress,
        couponCode: 'WELCOME10',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      subtotal: 1960,
      discount: 196,
      total: 1764,
      status: 'pending',
      shippingAddress,
      items: [{ productId: 1, quantity: 2, unitPrice: 980 }],
    });

    const product = db.prepare('SELECT stock FROM products WHERE id = 1').get() as {
      stock: number;
    };
    const coupon = db.prepare("SELECT used_count FROM coupons WHERE code = 'WELCOME10'").get() as {
      used_count: number;
    };
    const notification = db.prepare('SELECT type, status FROM notifications').get();

    expect(product.stock).toBe(48);
    expect(coupon.used_count).toBe(1);
    expect(notification).toEqual({ type: 'order_created', status: 'pending' });
  });

  it('requires a shipping address before changing stock or creating an order', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: 1, quantity: 1 }] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: '請輸入配送地址' },
    });
    expect(db.prepare('SELECT stock FROM products WHERE id = 1').get()).toEqual({ stock: 50 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM orders').get()).toEqual({ count: 0 });
  });

  it('rolls back the first stock deduction when a later item is out of stock', async () => {
    const token = await loginAs();
    db.prepare('UPDATE products SET stock = 0 WHERE id = 2').run();

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
        ],
        shippingAddress,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');

    const firstProduct = db.prepare('SELECT stock FROM products WHERE id = 1').get() as {
      stock: number;
    };
    expect(firstProduct.stock).toBe(50);
    expect(db.prepare('SELECT COUNT(*) AS count FROM orders').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM order_items').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM notifications').get()).toEqual({ count: 0 });
  });

  it('returns a created order to its owner but hides it from another member', async () => {
    const ownerToken = await loginAs();
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ items: [{ productId: 3, quantity: 1 }], shippingAddress });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const other = await request(app).post('/api/auth/register').send({
      email: 'other-member@example.com',
      password: '12345678',
      name: 'Other member',
    });

    const ownResponse = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(ownResponse.body.data.total).toBe(1680);

    const hidden = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Authorization', `Bearer ${other.body.data.token}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('rejects an exhausted coupon before changing stock or creating another order', async () => {
    const token = await loginAs();

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: 3, quantity: 1 }],
        shippingAddress,
        couponCode: 'LIMITED1',
      })
      .expect(201);

    const stockBefore = db.prepare('SELECT stock FROM products WHERE id = 4').get() as {
      stock: number;
    };
    const rejected = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: 4, quantity: 1 }],
        shippingAddress,
        couponCode: 'LIMITED1',
      });

    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('COUPON_USAGE_LIMIT_REACHED');
    expect(db.prepare('SELECT stock FROM products WHERE id = 4').get()).toEqual(stockBefore);
    expect(db.prepare('SELECT COUNT(*) AS count FROM orders').get()).toEqual({ count: 1 });
  });
});
