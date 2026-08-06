import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
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
