import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errorHandler.js';

/**
 * 以 zod schema 驗證 request body，通過後把正規化結果寫回 req.body。
 *
 * 只取第一個 issue 的訊息，與原本「依序 if 檢查、第一個錯就回」的行為一致；
 * 因此 schema 的欄位順序即驗證順序。
 *
 * 同步 throw AppError（與 middleware/auth.ts 同一個模式），
 * Express 5 會接住並交給既有的 errorHandler 轉成統一錯誤 envelope。
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0]?.message ?? '請求格式不正確');
    }

    req.body = result.data;
    next();
  };
}
