import request from 'supertest';
import { app, loginAs, resetTestDatabase } from '../helpers.js';

describe('admin order list authorization', () => {
  beforeEach(resetTestDatabase);

  async function createMemberOrder(token: string) {
    return request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: 1, quantity: 1 }] })
      .expect(201);
  }

  it('allows an admin to inspect orders and their items', async () => {
    const memberToken = await loginAs();
    const created = await createMemberOrder(memberToken);
    const adminToken = await loginAs('admin@example.com');

    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: created.body.data.id,
        userId: created.body.data.userId,
        total: 980,
        items: [expect.objectContaining({ productId: 1, quantity: 1 })],
      }),
    ]);
  });

  it('prevents a regular member from reading all customer orders', async () => {
    const other = await request(app).post('/api/auth/register').send({
      email: 'order-owner@example.com',
      password: '12345678',
      name: 'Order owner',
    });
    await createMemberOrder(other.body.data.token as string);

    const memberToken = await loginAs();
    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
