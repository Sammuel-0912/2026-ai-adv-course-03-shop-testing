// 測試共用 helper
//
// vitest.config.ts 已設定：
// - DB_PATH=:memory:（每個測試程序使用獨立的 in-memory SQLite，含 seed 資料）
// - fileParallelism: false（避免測試檔平行執行互相干擾資料庫狀態）
//
// 用法：
//   import request from 'supertest';
//   import { app } from './helpers';
//   const res = await request(app).get('/api/products');

export { default as app } from '../src/app.js';
export { db } from '../src/db/index.js';
export { processPendingNotifications } from '../src/services/notifier.js';
