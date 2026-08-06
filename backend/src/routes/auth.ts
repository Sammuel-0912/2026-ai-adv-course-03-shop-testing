import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 簽發 JWT（payload 只放 userId） */
function signToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET ?? 'course-demo-secret', {
    expiresIn: '7d',
  });
}

// 註冊
router.post('/register', (req, res) => {
  const { email, password, name } = (req.body ?? {}) as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email 格式不正確');
  }
  if (!password || password.length < 8) {
    throw new AppError(400, 'VALIDATION_ERROR', '密碼長度至少 8 碼');
  }
  if (!name || !name.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', '姓名為必填');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', '此 Email 已被註冊');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(email, passwordHash, name.trim());

  const userId = Number(result.lastInsertRowid);

  res.status(201).json({
    data: {
      token: signToken(userId),
      user: { id: userId, email, name: name.trim() },
    },
    message: '註冊成功',
  });
});

// 登入
router.post('/login', (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  const user = email
    ? (db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined)
    : undefined;

  if (!user || !password || !bcrypt.compareSync(password, user.password_hash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', '帳號或密碼錯誤');
  }

  res.json({
    data: {
      token: signToken(user.id),
      user: { id: user.id, email: user.email, name: user.name },
    },
    message: '登入成功',
  });
});

export default router;
