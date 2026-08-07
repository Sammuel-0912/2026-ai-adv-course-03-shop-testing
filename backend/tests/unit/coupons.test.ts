import {
  hasQuotaLeft,
  serializeCoupon,
  toCouponRule,
  type CouponRow,
} from '../../src/services/coupons.js';

function makeCoupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: 1,
    code: 'TEST10',
    percent_off: 10,
    max_discount: 300,
    min_spend: 1000,
    is_active: 1,
    usage_limit: null,
    used_count: 0,
    ...overrides,
  };
}

describe('coupon service helpers', () => {
  it('serializes database fields into the public API shape', () => {
    expect(
      serializeCoupon(
        makeCoupon({
          usage_limit: 5,
          used_count: 2,
          is_active: 0,
        })
      )
    ).toEqual({
      id: 1,
      code: 'TEST10',
      percentOff: 10,
      maxDiscount: 300,
      minSpend: 1000,
      usageLimit: 5,
      usedCount: 2,
      isActive: false,
    });
  });

  it('keeps only pricing fields when creating a coupon rule', () => {
    expect(toCouponRule(makeCoupon())).toEqual({
      percentOff: 10,
      maxDiscount: 300,
      minSpend: 1000,
    });
  });

  it('treats a null usage limit as unlimited', () => {
    expect(hasQuotaLeft(makeCoupon({ usage_limit: null, used_count: 999 }))).toBe(true);
  });

  it('allows usage below the limit and rejects usage at the limit', () => {
    expect(hasQuotaLeft(makeCoupon({ usage_limit: 2, used_count: 1 }))).toBe(true);
    expect(hasQuotaLeft(makeCoupon({ usage_limit: 2, used_count: 2 }))).toBe(false);
  });
});
