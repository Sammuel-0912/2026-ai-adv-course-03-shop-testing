import { z } from '../zod.js';
import { CartItemsSchema } from './cart.js';

/** 試算結果內附的優惠券規則摘要 */
export const CouponRuleSchema = z
  .object({
    code: z.string().openapi({ example: 'WELCOME10' }),
    percentOff: z.number().int().openapi({ example: 10, description: '折扣百分比' }),
  })
  .openapi('CouponRule');

export const PreviewResultSchema = z
  .object({
    subtotal: z.number().int().openapi({ example: 1960 }),
    discount: z.number().int().openapi({ example: 196 }),
    total: z.number().int().openapi({ example: 1764 }),
    coupon: CouponRuleSchema.nullable().openapi({ description: '未帶券或券無效時為 null' }),
  })
  .openapi('PreviewResult');

export const CouponPreviewRequestSchema = z
  .object({
    items: CartItemsSchema,
    code: z.string().optional().openapi({ example: 'WELCOME10' }),
  })
  .openapi('CouponPreviewRequest');
