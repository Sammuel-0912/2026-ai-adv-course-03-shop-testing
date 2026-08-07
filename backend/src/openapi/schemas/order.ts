import { z } from '../zod.js';
import { CartItemsSchema } from './cart.js';

export const OrderItemSchema = z
  .object({
    productId: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: '經典玫瑰花束' }),
    quantity: z.number().int().openapi({ example: 2 }),
    unitPrice: z.number().int().openapi({ example: 980 }),
  })
  .openapi('OrderItem');

export const OrderSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    userId: z.number().int().openapi({ example: 1 }),
    couponId: z.number().int().nullable().openapi({ example: 1 }),
    shippingAddress: z.string().openapi({ example: '台北市信義區市府路 1 號' }),
    subtotal: z.number().int().openapi({ example: 1960 }),
    discount: z.number().int().openapi({ example: 196 }),
    total: z.number().int().openapi({ example: 1764 }),
    status: z.enum(['pending', 'paid', 'failed']).openapi({ example: 'pending' }),
    merchantTradeNo: z
      .string()
      .nullable()
      .openapi({ example: 'ORD20260807120000A1B', description: '每次 checkout 重新產生' }),
    createdAt: z.string().openapi({ example: '2026-08-07 12:00:00' }),
    paidAt: z.string().nullable().openapi({ example: null }),
    items: z.array(OrderItemSchema),
  })
  .openapi('Order');

export const CreateOrderRequestSchema = z
  .object({
    items: CartItemsSchema,
    shippingAddress: z
      .string({ error: '請輸入配送地址' })
      .trim()
      .min(1, '請輸入配送地址')
      .max(200, '配送地址不可超過 200 字')
      .openapi({ example: '台北市信義區市府路 1 號' }),
    couponCode: z.string().optional().openapi({ example: 'WELCOME10' }),
  })
  .openapi('CreateOrderRequest');

export const CheckoutResultSchema = z
  .object({
    html: z
      .string()
      .openapi({ description: '綠界自動送出的付款表單 HTML，前端直接寫入 document 即可跳轉' }),
  })
  .openapi('CheckoutResult');
