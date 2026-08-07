import { Router } from 'express';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { CouponPreviewRequestSchema } from '../openapi/schemas/coupon.js';
import { calculateOrderAmount, type PricingItem } from '../services/pricing.js';

const router = Router();

interface ProductRow {
  id: number;
  price: number;
}

interface CouponRow {
  id: number;
  code: string;
  percent_off: number;
  max_discount: number;
  min_spend: number;
  is_active: number;
}

// 優惠券試算（與建立訂單共用 calculateOrderAmount 純函式）
router.post('/preview', validateBody(CouponPreviewRequestSchema), (req, res) => {
  const { items, code } = req.body as {
    items: Array<{ productId: number; quantity: number }>;
    code?: string;
  };

  // 逐項查商品取得單價（伺服器端重算，不信任前端金額）
  const pricingItems: PricingItem[] = items.map((item) => {
    const product = db.prepare('SELECT id, price FROM products WHERE id = ?').get(item.productId) as
      | ProductRow
      | undefined;

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', '商品不存在');
    }

    return { price: product.price, quantity: item.quantity };
  });

  let coupon: CouponRow | null = null;
  if (code) {
    coupon = (db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(code) ??
      null) as CouponRow | null;

    if (!coupon) {
      throw new AppError(404, 'COUPON_NOT_FOUND', '優惠券不存在或已停用');
    }
  }

  const { subtotal, discount, total } = calculateOrderAmount(
    pricingItems,
    coupon
      ? { percentOff: coupon.percent_off, maxDiscount: coupon.max_discount, minSpend: coupon.min_spend }
      : null
  );

  res.json({
    data: {
      subtotal,
      discount,
      total,
      coupon: coupon ? { code: coupon.code, percentOff: coupon.percent_off } : null,
    },
  });
});

export default router;
