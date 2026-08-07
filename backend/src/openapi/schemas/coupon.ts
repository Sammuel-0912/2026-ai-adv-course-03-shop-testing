import { z } from '../zod.js';
import { CartItemsSchema } from './cart.js';

const CODE_REGEX = /^[A-Z0-9_-]+$/;

/** 折扣規則摘要：試算結果內附的優惠券資訊 */
export const CouponRuleSchema = z
  .object({
    code: z.string().openapi({ example: 'WELCOME10' }),
    percentOff: z.number().int().openapi({ example: 10, description: '折扣百分比' }),
    maxDiscount: z.number().int().openapi({ example: 300, description: '折抵上限' }),
    minSpend: z.number().int().openapi({ example: 1000, description: '低消門檻（含等於）' }),
  })
  .openapi('CouponRule');

/** 完整優惠券：列表、詳情與管理端回應 */
export const CouponSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    code: z.string().openapi({ example: 'WELCOME10' }),
    percentOff: z.number().int().openapi({ example: 10 }),
    maxDiscount: z.number().int().openapi({ example: 300 }),
    minSpend: z.number().int().openapi({ example: 1000 }),
    usageLimit: z
      .number()
      .int()
      .nullable()
      .openapi({ example: null, description: 'null 代表不限次數' }),
    usedCount: z.number().int().openapi({ example: 0 }),
    isActive: z.boolean().openapi({ example: true }),
  })
  .openapi('Coupon');

export const PreviewResultSchema = z
  .object({
    subtotal: z.number().int().openapi({ example: 1960 }),
    discount: z.number().int().openapi({ example: 196 }),
    total: z.number().int().openapi({ example: 1764 }),
    coupon: CouponRuleSchema.nullable().openapi({ description: '未帶券時為 null' }),
  })
  .openapi('PreviewResult');

export const CouponPreviewRequestSchema = z
  .object({
    items: CartItemsSchema,
    code: z.string().optional().openapi({ example: 'WELCOME10' }),
  })
  .openapi('CouponPreviewRequest');

export const CouponListQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .openapi({
      param: { name: 'includeInactive', in: 'query' },
      description: '一併列出已停用的優惠券，**需要管理者權限**',
      example: 'true',
    }),
});

export const CouponCodePathParamSchema = z.object({
  code: z.string().openapi({ param: { name: 'code', in: 'path' }, example: 'WELCOME10' }),
});

// 共用欄位定義。刻意不從已註冊的 schema 衍生（.extend()/.omit() 會讓
// zod-to-openapi 產出 allOf + $ref 的組合，文件較難讀）。
const couponRuleFields = {
  percentOff: z
    .number({ error: 'percentOff 必須是 1 到 100 的整數' })
    .int('percentOff 必須是 1 到 100 的整數')
    .min(1, 'percentOff 必須是 1 到 100 的整數')
    .max(100, 'percentOff 必須是 1 到 100 的整數')
    .openapi({ example: 20 }),
  maxDiscount: z
    .number({ error: 'maxDiscount 必須是 0 以上的整數' })
    .int('maxDiscount 必須是 0 以上的整數')
    .min(0, 'maxDiscount 必須是 0 以上的整數')
    .openapi({ example: 500, description: '折抵上限' }),
  minSpend: z
    .number({ error: 'minSpend 必須是 0 以上的整數' })
    .int('minSpend 必須是 0 以上的整數')
    .min(0, 'minSpend 必須是 0 以上的整數')
    .openapi({ example: 2000, description: '低消門檻（含等於）' }),
  usageLimit: z
    .number({ error: 'usageLimit 必須是 1 以上的整數或 null' })
    .int('usageLimit 必須是 1 以上的整數或 null')
    .min(1, 'usageLimit 必須是 1 以上的整數或 null')
    .nullable()
    .optional()
    .openapi({ example: 100, description: '省略或 null 代表不限次數' }),
  isActive: z
    .boolean({ error: 'isActive 必須是布林值' })
    .optional()
    .openapi({ example: true, description: '預設 true' }),
};

export const CreateCouponRequestSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'code 為必填')
      .max(32, 'code 長度上限 32 字')
      .regex(CODE_REGEX, 'code 只能包含大寫英數字、- 與 _')
      .openapi({ example: 'SUMMER20' }),
    ...couponRuleFields,
  })
  .openapi('CreateCouponRequest');

// code 不可修改（是識別碼，改了會讓既有訂單的對應關係混亂）；
// usedCount 也不開放由 API 調整。
export const UpdateCouponRequestSchema = z
  .object({
    percentOff: couponRuleFields.percentOff.optional(),
    maxDiscount: couponRuleFields.maxDiscount.optional(),
    minSpend: couponRuleFields.minSpend.optional(),
    usageLimit: couponRuleFields.usageLimit,
    isActive: couponRuleFields.isActive,
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    error: '至少要提供一個要更新的欄位',
  })
  .openapi('UpdateCouponRequest');
