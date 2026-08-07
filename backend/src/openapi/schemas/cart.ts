import { z } from '../zod.js';

// 購物車品項：優惠券試算與建立訂單共用同一份 schema。
// 刻意不加 .int()，維持原本「只檢查 typeof === 'number'」的行為。
export const CartItemSchema = z
  .object(
    {
      productId: z.number({ error: 'items 格式不正確' }).openapi({ example: 1 }),
      quantity: z
        .number({ error: 'items 格式不正確' })
        .positive('items 格式不正確')
        .openapi({ example: 2 }),
    },
    { error: 'items 格式不正確' }
  )
  .openapi('CartItem');

export const CartItemsSchema = z
  .array(CartItemSchema, { error: 'items 不可為空' })
  .min(1, 'items 不可為空');
