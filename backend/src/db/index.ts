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
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
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
    is_active INTEGER NOT NULL DEFAULT 1,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coupon_id INTEGER,
    shipping_address TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL,
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

/**
 * 極簡 migration：讓開發中已存在的 dev.sqlite 也能補上新欄位，不必手動刪檔。
 * SQLite 的 ADD COLUMN 不支援全部約束，因此這裡不帶 CHECK；
 * 新建的資料庫由上面的 CREATE TABLE 帶完整約束，實際輸入一律由 zod schema 把關。
 */
function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'member'");
ensureColumn('coupons', 'usage_limit', 'usage_limit INTEGER');
ensureColumn('coupons', 'used_count', 'used_count INTEGER NOT NULL DEFAULT 0');
ensureColumn('orders', 'shipping_address', "shipping_address TEXT NOT NULL DEFAULT ''");

// 商品 seed：僅當 products 為空時執行（避免覆蓋開發中被改動的庫存）
const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };

if (productCount.count === 0) {
  const insertProduct = db.prepare(
    'INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)'
  );
  insertProduct.run('經典玫瑰花束', '典雅紅玫瑰花束，傳遞浪漫心意', 980, 50);
  insertProduct.run('香水百合花束', '清新香水百合，香氣淡雅怡人', 1280, 50);
  insertProduct.run('向日葵花束', '燦爛向日葵，帶來陽光般的祝福', 1680, 50);
  insertProduct.run('桔梗混合花束', '桔梗混搭季節花材，溫柔繽紛', 1235, 50);
}

// 帳號與優惠券 seed 採冪等寫法（依 email／code 判斷），
// 讓 schema 升級前就存在的資料庫也能補齊 admin 帳號與新的優惠券。

/** 密碼一律 12345678 */
function seedUser(email: string, name: string, role: 'member' | 'admin'): void {
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return;

  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
    email,
    bcrypt.hashSync('12345678', 10),
    name,
    role
  );
}

function seedCoupon(
  code: string,
  percentOff: number,
  maxDiscount: number,
  minSpend: number,
  isActive: number,
  usageLimit: number | null
): void {
  if (db.prepare('SELECT id FROM coupons WHERE code = ?').get(code)) return;

  db.prepare(
    `INSERT INTO coupons (code, percent_off, max_discount, min_spend, is_active, usage_limit)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(code, percentOff, maxDiscount, minSpend, isActive, usageLimit);
}

seedUser('user@example.com', '測試會員', 'member');
// 優惠券管理端點需要管理者身分
seedUser('admin@example.com', '管理員', 'admin');

// usage_limit 為 NULL＝不限次數。
// WELCOME10 必須維持不限次數：課程的 pricing 邊界案例全部以它為基準。
seedCoupon('WELCOME10', 10, 300, 1000, 1, null);
seedCoupon('DISABLED10', 10, 300, 1000, 0, null);
// 只能用一次，用來示範 COUPON_USAGE_LIMIT_REACHED
seedCoupon('LIMITED1', 10, 300, 1000, 1, 1);
