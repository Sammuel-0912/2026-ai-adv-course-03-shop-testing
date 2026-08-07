import { z } from '../zod.js';

export const ProductSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: '經典玫瑰花束' }),
    description: z.string().openapi({ example: '典雅紅玫瑰花束，傳遞浪漫心意' }),
    price: z.number().int().openapi({ example: 980, description: '單價（整數 TWD）' }),
    stock: z.number().int().openapi({ example: 50 }),
    createdAt: z.string().openapi({ example: '2026-01-01 00:00:00' }),
  })
  .openapi('Product');
