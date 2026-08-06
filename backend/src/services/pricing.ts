import { AppError } from '../middleware/errorHandler.js';

/** 訂單項目：單價與數量（皆為整數 TWD） */
export interface PricingItem {
  price: number;
  quantity: number;
}

/** 優惠券規則 */
export interface CouponRule {
  percentOff: number;
  maxDiscount: number;
  minSpend: number;
}

/**
 * 計算訂單金額（唯一金額計算入口，preview 與建立訂單共用）。
 *
 * 商業規則（見 AGENTS.md）：
 * 1. 低消門檻：subtotal >= minSpend 才可折抵（含等於），未達丟 COUPON_MIN_SPEND_NOT_MET
 * 2. discount = min(floor(subtotal × percentOff / 100), maxDiscount)
 *    —— 先算百分比、無條件捨去、再套折抵上限
 * 3. total = subtotal - discount，必為正整數
 */
export function calculateOrderAmount(
  items: PricingItem[],
  coupon?: CouponRule | null
): { subtotal: number; discount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let discount = 0;

  if (coupon) {
    if (subtotal < coupon.minSpend) {
      throw new AppError(400, 'COUPON_MIN_SPEND_NOT_MET', '未達最低消費金額');
    }
    discount = Math.min(Math.floor((subtotal * coupon.percentOff) / 100), coupon.maxDiscount);
  }

  return { subtotal, discount, total: subtotal - discount };
}

/**
 * 產生綠界 MerchantTradeNo：'ORD' + yyyyMMddHHmmss(14 位) + 3 碼隨機大寫英數 = 恰 20 字。
 * 綠界不接受重複編號，每次 checkout 都要重新產生。
 */
export function generateMerchantTradeNo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 3; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `ORD${timestamp}${random}`;
}
