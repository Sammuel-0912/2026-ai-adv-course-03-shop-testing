import { AppError } from '../../src/middleware/errorHandler.js';
import {
  calculateOrderAmount,
  generateMerchantTradeNo,
} from '../../src/services/pricing.js';

const coupon = {
  percentOff: 10,
  maxDiscount: 300,
  minSpend: 1000,
};

describe('calculateOrderAmount', () => {
  it('adds multiple items without applying a coupon', () => {
    expect(
      calculateOrderAmount([
        { price: 980, quantity: 2 },
        { price: 1280, quantity: 1 },
      ])
    ).toEqual({ subtotal: 3240, discount: 0, total: 3240 });
  });

  it('rejects a coupon when subtotal is below its minimum spend', () => {
    expect.assertions(3);

    try {
      calculateOrderAmount([{ price: 980, quantity: 1 }], coupon);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(400);
      expect((error as AppError).code).toBe('COUPON_MIN_SPEND_NOT_MET');
    }
  });

  it('accepts a coupon when subtotal exactly equals its minimum spend', () => {
    expect(calculateOrderAmount([{ price: 1000, quantity: 1 }], coupon)).toEqual({
      subtotal: 1000,
      discount: 100,
      total: 900,
    });
  });

  it('calculates the percentage discount', () => {
    expect(calculateOrderAmount([{ price: 980, quantity: 2 }], coupon)).toEqual({
      subtotal: 1960,
      discount: 196,
      total: 1764,
    });
  });

  it('rounds a fractional discount down to an integer TWD amount', () => {
    expect(calculateOrderAmount([{ price: 1235, quantity: 1 }], coupon)).toEqual({
      subtotal: 1235,
      discount: 123,
      total: 1112,
    });
  });

  it('caps the discount after calculating and rounding the percentage', () => {
    expect(calculateOrderAmount([{ price: 1680, quantity: 2 }], coupon)).toEqual({
      subtotal: 3360,
      discount: 300,
      total: 3060,
    });
  });
});

describe('generateMerchantTradeNo', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('generates the required 20-character order number format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 12, 34, 56));
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(generateMerchantTradeNo()).toBe('ORD20260807123456AAA');
  });
});
