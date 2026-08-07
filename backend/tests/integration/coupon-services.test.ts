import { AppError } from '../../src/middleware/errorHandler.js';
import {
  consumeCoupon,
  findCouponByCode,
  findCouponById,
  findUsableCoupon,
} from '../../src/services/coupons.js';
import { db, resetTestDatabase } from '../helpers.js';

describe('coupon database services', () => {
  beforeEach(resetTestDatabase);

  it('finds coupons by code or id and returns null when they do not exist', () => {
    const byCode = findCouponByCode('WELCOME10');

    expect(byCode).toMatchObject({ code: 'WELCOME10', is_active: 1 });
    expect(findCouponById(byCode!.id)).toEqual(byCode);
    expect(findCouponByCode('MISSING')).toBeNull();
    expect(findCouponById(999999)).toBeNull();
  });

  it('returns an active coupon with quota remaining', () => {
    expect(findUsableCoupon('WELCOME10')).toMatchObject({
      code: 'WELCOME10',
      usage_limit: null,
    });
  });

  it('distinguishes unavailable coupons from exhausted coupons', () => {
    for (const code of ['MISSING', 'DISABLED10']) {
      try {
        findUsableCoupon(code);
        throw new Error(`Expected findUsableCoupon to reject ${code}`);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ status: 404, code: 'COUPON_NOT_FOUND' });
      }
    }

    db.prepare("UPDATE coupons SET used_count = usage_limit WHERE code = 'LIMITED1'").run();
    try {
      findUsableCoupon('LIMITED1');
      throw new Error('Expected findUsableCoupon to reject an exhausted coupon');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ status: 409, code: 'COUPON_USAGE_LIMIT_REACHED' });
    }
  });

  it('atomically consumes a limited coupon without exceeding its limit', () => {
    const coupon = findUsableCoupon('LIMITED1');

    consumeCoupon(coupon.id);
    expect(findCouponById(coupon.id)?.used_count).toBe(1);

    try {
      consumeCoupon(coupon.id);
      throw new Error('Expected consumeCoupon to reject an exhausted coupon');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ status: 409, code: 'COUPON_USAGE_LIMIT_REACHED' });
    }
    expect(findCouponById(coupon.id)?.used_count).toBe(1);
  });

  it('increments an unlimited coupon on every successful order consumption', () => {
    const coupon = findUsableCoupon('WELCOME10');

    consumeCoupon(coupon.id);
    consumeCoupon(coupon.id);

    expect(findCouponById(coupon.id)?.used_count).toBe(2);
  });
});
