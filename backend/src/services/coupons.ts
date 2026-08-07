import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CouponRow {
  id: number;
  code: string;
  percent_off: number;
  max_discount: number;
  min_spend: number;
  is_active: number;
  usage_limit: number | null;
  used_count: number;
}

/** DB row（snake_case）→ API JSON（camelCase） */
export function serializeCoupon(coupon: CouponRow) {
  return {
    id: coupon.id,
    code: coupon.code,
    percentOff: coupon.percent_off,
    maxDiscount: coupon.max_discount,
    minSpend: coupon.min_spend,
    usageLimit: coupon.usage_limit,
    usedCount: coupon.used_count,
    isActive: coupon.is_active === 1,
  };
}

/** 試算與建立訂單共用的規則摘要 */
export function toCouponRule(coupon: CouponRow) {
  return {
    percentOff: coupon.percent_off,
    maxDiscount: coupon.max_discount,
    minSpend: coupon.min_spend,
  };
}

export function findCouponByCode(code: string): CouponRow | null {
  return (db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) ?? null) as CouponRow | null;
}

export function findCouponById(id: string | number): CouponRow | null {
  return (db.prepare('SELECT * FROM coupons WHERE id = ?').get(id) ?? null) as CouponRow | null;
}

/** 額度是否還有剩（usage_limit 為 NULL 代表不限次數） */
export function hasQuotaLeft(coupon: CouponRow): boolean {
  return coupon.usage_limit === null || coupon.used_count < coupon.usage_limit;
}

/**
 * 取得可用的優惠券。
 *
 * 這是 transaction 外的「快檢」：讓「券已用罄」比「庫存不足」更早回報，
 * 使用者不必先扣庫存才知道券不能用。權威判定在 consumeCoupon()。
 */
export function findUsableCoupon(code: string): CouponRow {
  const coupon = findCouponByCode(code);

  if (!coupon || coupon.is_active !== 1) {
    throw new AppError(404, 'COUPON_NOT_FOUND', '優惠券不存在或已停用');
  }
  if (!hasQuotaLeft(coupon)) {
    throw new AppError(409, 'COUPON_USAGE_LIMIT_REACHED', '此優惠券已達使用次數上限');
  }

  return coupon;
}

/**
 * 扣一次使用額度。**必須在建立訂單的 transaction 內呼叫。**
 *
 * 用條件式 UPDATE 而非「先讀再寫」，讓額度判定與遞增在單一 SQL 內原子完成；
 * changes === 0 即代表額度已被其他請求搶光。
 */
export function consumeCoupon(couponId: number): void {
  const result = db
    .prepare(
      `UPDATE coupons SET used_count = used_count + 1
       WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)`
    )
    .run(couponId);

  if (result.changes === 0) {
    throw new AppError(409, 'COUPON_USAGE_LIMIT_REACHED', '此優惠券已達使用次數上限');
  }
}
