// 測試共用 helper
//
// vitest.config.ts 已設定：
// - DB_PATH=:memory:（每個測試程序使用獨立的 in-memory SQLite，含 seed 資料）
// - fileParallelism: false（避免測試檔平行執行互相干擾資料庫狀態）
//
// 用法：
//   import request from 'supertest';
//   import { app, resetTestDatabase } from './helpers';
//   const res = await request(app).get('/api/products');

import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/index.js';

export { app, db };
export { processPendingNotifications } from '../src/services/notifier.js';

/** 還原每個整合測試共用的 seed 狀態，避免案例互相影響。 */
export function resetTestDatabase(): void {
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM notifications;
    DELETE FROM orders;
    DELETE FROM users WHERE email NOT IN ('user@example.com', 'admin@example.com');
    UPDATE products SET stock = 50;
    UPDATE coupons
    SET used_count = 0,
        is_active = CASE WHEN code = 'DISABLED10' THEN 0 ELSE 1 END;
  `);
}

/** 使用 seed 帳號登入，回傳可直接放進 Authorization header 的 token。 */
export async function loginAs(
  email = 'user@example.com',
  password = '12345678'
): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return response.body.data.token as string;
}
