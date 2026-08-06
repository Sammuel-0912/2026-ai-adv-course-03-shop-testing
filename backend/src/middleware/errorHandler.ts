import type { NextFunction, Request, Response } from 'express';

/** 應用層錯誤：帶 HTTP 狀態碼與錯誤代碼，交由 errorHandler 統一轉成錯誤 envelope */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 404 handler：所有未匹配路由回統一錯誤 envelope */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: '找不到資源' },
  });
}

/** 統一錯誤處理：AppError 依其狀態碼回應，其他錯誤回 500 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: '伺服器內部錯誤' },
  });
}
