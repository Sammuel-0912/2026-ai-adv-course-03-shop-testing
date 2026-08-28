import { Router } from 'express';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculateOrderAmount, type PricingItem } from '../services/pricing.js';
import { calculateShipping, SHIPPING_METHODS, type ShippingMethod } from '../utils/shipping.js';

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
router.post('/preview', (req, res) => {
  const { items, code, shipping } = (req.body ?? {}) as {
    items?: Array<{ productId?: number; quantity?: number }>;
    code?: string;
    shipping?: { method?: string; isRemoteArea?: boolean; isSameDay?: boolean };
  };

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'items 不可為空');
  }

  // 逐項查商品取得單價（伺服器端重算，不信任前端金額）
  const pricingItems: PricingItem[] = items.map((item) => {
    if (!item || typeof item.productId !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'items 格式不正確');
    }

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

  const { subtotal, discount, total: amountAfterDiscount } = calculateOrderAmount(
    pricingItems,
    coupon
      ? { percentOff: coupon.percent_off, maxDiscount: coupon.max_discount, minSpend: coupon.min_spend }
      : null
  );

  // 選填運費試算：與建立訂單共用 calculateShipping。未帶 shipping 時 shippingFee = 0（向後相容）。
  let shippingFee = 0;
  if (shipping) {
    const shippingMethod = (shipping.method ?? 'HOME_DELIVERY') as ShippingMethod;
    if (!SHIPPING_METHODS.includes(shippingMethod)) {
      throw new AppError(400, 'INVALID_SHIPPING_METHOD', '配送方式不合法');
    }
    shippingFee = calculateShipping({
      method: shippingMethod,
      subtotal,
      isRemoteArea: shipping.isRemoteArea === true,
      isSameDay: shipping.isSameDay === true,
    }).fee;
  }

  res.json({
    data: {
      subtotal,
      discount,
      shippingFee,
      total: amountAfterDiscount + shippingFee,
      coupon: coupon ? { code: coupon.code, percentOff: coupon.percent_off } : null,
    },
  });
});

export default router;
