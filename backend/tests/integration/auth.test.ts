import request from 'supertest';
import { app, db, loginAs, resetTestDatabase } from '../helpers.js';

describe('auth routes', () => {
  beforeEach(resetTestDatabase);

  it('registers every public account as a member and returns a usable token', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      email: 'new-member@example.com',
      password: '12345678',
      name: 'New member',
      role: 'admin',
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user).toMatchObject({
      email: 'new-member@example.com',
      name: 'New member',
    });

    const stored = db
      .prepare('SELECT role FROM users WHERE email = ?')
      .get('new-member@example.com') as { role: string };
    expect(stored.role).toBe('member');

    await request(app)
      .get('/api/orders/999999')
      .set('Authorization', `Bearer ${registerResponse.body.data.token}`)
      .expect(404);
  });

  it('logs in a seeded member and rejects an incorrect password', async () => {
    const token = await loginAs();
    expect(token).toEqual(expect.any(String));

    const failed = await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'wrong-password',
    });
    expect(failed.status).toBe(401);
    expect(failed.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects duplicate registration with the shared error envelope', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'user@example.com',
      password: '12345678',
      name: 'Duplicate',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: 'EMAIL_TAKEN', message: '此 Email 已被註冊' },
    });
  });

  it('requires a valid token for protected order routes', async () => {
    const missing = await request(app).get('/api/orders/1');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHORIZED');

    const invalid = await request(app)
      .get('/api/orders/1')
      .set('Authorization', 'Bearer invalid-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('UNAUTHORIZED');
  });
});
