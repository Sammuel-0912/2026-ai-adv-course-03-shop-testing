import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// DB_PATH 環境變數：
// - ':memory:'：測試用 in-memory 資料庫（vitest.config.ts 已設定）
// - 未設定：預設使用 data/dev.sqlite
const dbPath =
  process.env.DB_PATH === ':memory:'
    ? ':memory:'
    : process.env.DB_PATH ?? path.join(import.meta.dirname, '../../data/dev.sqlite');

if (dbPath !== ':memory:') {
  // 確保資料庫目錄存在
  mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath);

// WAL 模式提升並行讀寫效能（in-memory 不適用）
if (dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL');
}

// 建表（snake_case 欄位）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    percent_off INTEGER NOT NULL,
    max_discount INTEGER NOT NULL,
    min_spend INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coupon_id INTEGER,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    shipping_fee INTEGER NOT NULL DEFAULT 0,
    shipping_method TEXT,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    merchant_trade_no TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );
`);

// 輕量 migration：既有資料庫（CREATE TABLE IF NOT EXISTS 不會補欄位）補上運費欄位
const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
const hasColumn = (name: string) => orderColumns.some((col) => col.name === name);

if (!hasColumn('shipping_fee')) {
  db.exec('ALTER TABLE orders ADD COLUMN shipping_fee INTEGER NOT NULL DEFAULT 0');
}
if (!hasColumn('shipping_method')) {
  db.exec('ALTER TABLE orders ADD COLUMN shipping_method TEXT');
}

// 首次 seed：僅當 products 為空時執行
const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };

if (productCount.count === 0) {
  const insertProduct = db.prepare(
    'INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)'
  );
  insertProduct.run('經典玫瑰花束', '典雅紅玫瑰花束，傳遞浪漫心意', 980, 50);
  insertProduct.run('香水百合花束', '清新香水百合，香氣淡雅怡人', 1280, 50);
  insertProduct.run('向日葵花束', '燦爛向日葵，帶來陽光般的祝福', 1680, 50);
  insertProduct.run('桔梗混合花束', '桔梗混搭季節花材，溫柔繽紛', 1235, 50);

  // 測試會員：user@example.com / 12345678
  const passwordHash = bcrypt.hashSync('12345678', 10);
  db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(
    'user@example.com',
    passwordHash,
    '測試會員'
  );

  const insertCoupon = db.prepare(
    'INSERT INTO coupons (code, percent_off, max_discount, min_spend, is_active) VALUES (?, ?, ?, ?, ?)'
  );
  insertCoupon.run('WELCOME10', 10, 300, 1000, 1);
  insertCoupon.run('DISABLED10', 10, 300, 1000, 0);
}
