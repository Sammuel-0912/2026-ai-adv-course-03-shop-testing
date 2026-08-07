import request from 'supertest';
import {
  app,
  db,
  loginAs,
  processPendingNotifications,
  resetTestDatabase,
} from '../helpers.js';
import { startNotificationWorker } from '../../src/services/notifier.js';

describe('notification database worker', () => {
  beforeEach(resetTestDatabase);

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks pending order notifications as sent without using a timer', async () => {
    const token = await loginAs();
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: 1, quantity: 1 }],
        shippingAddress: '台北市信義區市府路 1 號',
      })
      .expect(201);

    expect(processPendingNotifications()).toBe(1);
    expect(db.prepare('SELECT status, sent_at FROM notifications').get()).toMatchObject({
      status: 'sent',
      sent_at: expect.any(String),
    });
    expect(processPendingNotifications()).toBe(0);
  });

  it('processes pending notifications on the configured interval', () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    db.prepare(
      `INSERT INTO notifications (user_id, order_id, type, status, message)
       VALUES (1, 999, 'order_created', 'pending', 'test notification')`
    ).run();

    const timer = startNotificationWorker(1000);
    vi.advanceTimersByTime(999);
    expect(db.prepare('SELECT status FROM notifications').get()).toEqual({ status: 'pending' });

    vi.advanceTimersByTime(1);
    expect(db.prepare('SELECT status, sent_at FROM notifications').get()).toMatchObject({
      status: 'sent',
      sent_at: expect.any(String),
    });
    expect(log).toHaveBeenCalledWith('[notifier] 已寄送 1 筆通知');

    clearInterval(timer);
  });
});
