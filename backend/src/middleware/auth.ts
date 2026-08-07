import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { AppError } from './errorHandler.js';

// 擴充 Express Request：auth middleware 通過後掛上 userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

/** 驗證 Authorization: Bearer <jwt>，成功把 userId 掛上 req */
export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', '請先登入');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'course-demo-secret') as {
      userId: number;
    };
    req.userId = payload.userId;
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', '登入憑證無效或已過期');
  }

  next();
}

/**
 * 選擇性登入：沒帶 Authorization 就直接放行（req.userId 為 undefined）。
 * 帶了但無效仍回 401，行為與 auth 一致，避免「壞 token 被當成訪客」的模糊狀態。
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization) {
    next();
    return;
  }

  auth(req, res, next);
}

/**
 * 要求管理者身分。必須接在 auth 或 optionalAuth 之後。
 *
 * role 每次從 DB 查、不放進 JWT payload —— 否則撤銷 admin 後舊 token 仍會是管理者。
 */
export function assertAdmin(userId: number | undefined): void {
  if (userId === undefined) {
    throw new AppError(401, 'UNAUTHORIZED', '請先登入');
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as
    | { role: string }
    | undefined;

  if (user?.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', '需要管理者權限');
  }
}

/** assertAdmin 的 middleware 版本 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  assertAdmin(req.userId);
  next();
}
