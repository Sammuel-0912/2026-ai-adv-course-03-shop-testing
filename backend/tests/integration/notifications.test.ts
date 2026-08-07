import request from 'supertest';
import {
  app,
  db,
  loginAs,
  processPendingNotifications,
  resetTestDatabase,
} from '../helpers.js';

describe('notification database worker', () => {
  beforeEach(resetTestDatabase);

  it('marks pending order notifications as sent without using a timer', async () => {
    const token = await loginAs();
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: 1, quantity: 1 }] })
      .expect(201);

    expect(processPendingNotifications()).toBe(1);
    expect(db.prepare('SELECT status, sent_at FROM notifications').get()).toMatchObject({
      status: 'sent',
      sent_at: expect.any(String),
    });
    expect(processPendingNotifications()).toBe(0);
  });
});
