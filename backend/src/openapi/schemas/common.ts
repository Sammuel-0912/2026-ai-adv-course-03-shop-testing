import { z } from '../zod.js';

/**
 * 統一成功 envelope：{ data: <payload> }
 * 不回 message 的端點用這個。
 */
export function success<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data });
}

/**
 * 統一成功 envelope：{ data: <payload>, message: string }
 * message 標為必填，契約測試才抓得到「message 不見了」。
 */
export function successWithMessage<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    data,
    message: z.string().openapi({ example: '操作成功' }),
  });
}

/** 統一錯誤 envelope，對應 middleware/errorHandler.ts */
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: '欄位格式不正確' }),
    }),
  })
  .openapi('ErrorResponse');

/** 路徑參數 :id（維持字串，不做 coercion —— 非數字 id 由查無資料回 404） */
export const IdPathParamSchema = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: '1' }),
});
