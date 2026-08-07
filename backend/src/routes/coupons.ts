import { Router } from 'express';
import { db } from '../db/index.js';
import { assertAdmin, auth, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import {
  CouponPreviewRequestSchema,
  CreateCouponRequestSchema,
  UpdateCouponRequestSchema,
} from '../openapi/schemas/coupon.js';
import {
  findCouponById,
  findCouponByCode,
  findUsableCoupon,
  serializeCoupon,
  toCouponRule,
  type CouponRow,
} from '../services/coupons.js';
import { calculateOrderAmount, type PricingItem } from '../services/pricing.js';

const router = Router();

interface ProductRow {
  id: number;
  price: number;
}

// 優惠券列表。預設只列啟用中的券；includeInactive=true 需要管理者權限。
// 注意：本路由必須定義在 GET /:code 之前。
router.get('/', optionalAuth, (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';

  if (includeInactive) {
    assertAdmin(req.userId);
  }

  const coupons = db
    .prepare(
      includeInactive
        ? 'SELECT * FROM coupons ORDER BY id'
        : 'SELECT * FROM coupons WHERE is_active = 1 ORDER BY id'
    )
    .all() as CouponRow[];

  res.json({ data: coupons.map(serializeCoupon) });
});

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

  const coupon = code ? findUsableCoupon(code) : null;

  const { subtotal, discount, total } = calculateOrderAmount(
    pricingItems,
    coupon ? toCouponRule(coupon) : null
  );

  res.json({
    data: {
      subtotal,
      discount,
      total,
      coupon: coupon
        ? {
            code: coupon.code,
            percentOff: coupon.percent_off,
            maxDiscount: coupon.max_discount,
            minSpend: coupon.min_spend,
          }
        : null,
    },
  });
});

// 建立優惠券（管理者）
router.post('/', auth, requireAdmin, validateBody(CreateCouponRequestSchema), (req, res) => {
  const { code, percentOff, maxDiscount, minSpend, usageLimit, isActive } = req.body as {
    code: string;
    percentOff: number;
    maxDiscount: number;
    minSpend: number;
    usageLimit?: number | null;
    isActive?: boolean;
  };

  if (findCouponByCode(code)) {
    throw new AppError(409, 'COUPON_CODE_TAKEN', '此優惠券代碼已存在');
  }

  const result = db
    .prepare(
      `INSERT INTO coupons (code, percent_off, max_discount, min_spend, is_active, usage_limit)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(code, percentOff, maxDiscount, minSpend, isActive === false ? 0 : 1, usageLimit ?? null);

  const created = findCouponById(Number(result.lastInsertRowid))!;

  res.status(201).json({ data: serializeCoupon(created), message: '優惠券建立成功' });
});

// 更新優惠券（管理者）。停用改用 isActive:false，不做硬刪除
// —— orders.coupon_id 會參照優惠券，刪掉會讓歷史訂單失去券資訊。
router.patch('/:id', auth, requireAdmin, validateBody(UpdateCouponRequestSchema), (req, res) => {
  const existing = findCouponById(String(req.params.id));

  if (!existing) {
    throw new AppError(404, 'COUPON_NOT_FOUND', '優惠券不存在或已停用');
  }

  const patch = req.body as {
    percentOff?: number;
    maxDiscount?: number;
    minSpend?: number;
    usageLimit?: number | null;
    isActive?: boolean;
  };

  db.prepare(
    `UPDATE coupons
     SET percent_off = ?, max_discount = ?, min_spend = ?, usage_limit = ?, is_active = ?
     WHERE id = ?`
  ).run(
    patch.percentOff ?? existing.percent_off,
    patch.maxDiscount ?? existing.max_discount,
    patch.minSpend ?? existing.min_spend,
    patch.usageLimit === undefined ? existing.usage_limit : patch.usageLimit,
    patch.isActive === undefined ? existing.is_active : patch.isActive ? 1 : 0,
    existing.id
  );

  res.json({ data: serializeCoupon(findCouponById(existing.id)!), message: '優惠券更新成功' });
});

// 單張優惠券詳情（已停用視同不存在）。必須定義在 GET / 之後。
router.get('/:code', (req, res) => {
  const coupon = findCouponByCode(req.params.code);

  if (!coupon || coupon.is_active !== 1) {
    throw new AppError(404, 'COUPON_NOT_FOUND', '優惠券不存在或已停用');
  }

  res.json({ data: serializeCoupon(coupon) });
});

export default router;
