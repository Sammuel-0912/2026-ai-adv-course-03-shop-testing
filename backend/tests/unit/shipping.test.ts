import { describe, it, expect } from 'vitest';
import { calculateShipping, SHIPPING_CONFIG } from '../../src/utils/shipping.js';

// Shipping 模組單元測試（純函式，不依賴 DB / HTTP）
//
// 規則（見 AGENTS.md）：
// - 宅配基本運費 120；超商取貨 60。
// - 商品小計 >= 1500（含等於）免「基本運費」，僅宅配適用；超商取貨不在此限，仍收 60。
// - 偏遠地區 +200、當日急件 +250，附加費任何情況都加收（不受滿額免運影響）。

describe('calculateShipping', () => {
  it('宅配基本運費：未達門檻收 120', () => {
    const result = calculateShipping({ method: 'HOME_DELIVERY', subtotal: 980 });
    expect(result.baseFee).toBe(120);
    expect(result.surcharge).toBe(0);
    expect(result.fee).toBe(120);
    expect(result.freeShippingApplied).toBe(false);
  });

  it('超商取貨費用：固定 60，不在滿額免運範圍內', () => {
    const belowThreshold = calculateShipping({ method: 'CONVENIENCE_STORE', subtotal: 980 });
    expect(belowThreshold.baseFee).toBe(60);
    expect(belowThreshold.fee).toBe(60);
    expect(belowThreshold.freeShippingApplied).toBe(false);

    // 即使小計滿 1500，超商取貨仍收 60（不在滿額免運範圍）
    const aboveThreshold = calculateShipping({ method: 'CONVENIENCE_STORE', subtotal: 1500 });
    expect(aboveThreshold.baseFee).toBe(60);
    expect(aboveThreshold.fee).toBe(60);
    expect(aboveThreshold.freeShippingApplied).toBe(false);
  });

  it('商品小計 1,499：差 1 元未達門檻，宅配仍收 120', () => {
    const result = calculateShipping({ method: 'HOME_DELIVERY', subtotal: 1499 });
    expect(result.baseFee).toBe(120);
    expect(result.fee).toBe(120);
    expect(result.freeShippingApplied).toBe(false);
  });

  it('商品小計 1,500：達門檻（含等於）宅配免基本運費', () => {
    const result = calculateShipping({ method: 'HOME_DELIVERY', subtotal: 1500 });
    expect(result.baseFee).toBe(0);
    expect(result.fee).toBe(0);
    expect(result.freeShippingApplied).toBe(true);
  });

  it('偏遠地區附加費：在基本運費上加收 200', () => {
    const result = calculateShipping({
      method: 'HOME_DELIVERY',
      subtotal: 980,
      isRemoteArea: true,
    });
    expect(result.baseFee).toBe(120);
    expect(result.surcharge).toBe(200);
    expect(result.fee).toBe(320);
  });

  it('當日急件附加費：在基本運費上加收 250', () => {
    const result = calculateShipping({
      method: 'HOME_DELIVERY',
      subtotal: 980,
      isSameDay: true,
    });
    expect(result.baseFee).toBe(120);
    expect(result.surcharge).toBe(250);
    expect(result.fee).toBe(370);
  });

  it('多項附加費同時成立：偏遠 + 急件 一起加收', () => {
    const result = calculateShipping({
      method: 'HOME_DELIVERY',
      subtotal: 980,
      isRemoteArea: true,
      isSameDay: true,
    });
    expect(result.baseFee).toBe(120);
    expect(result.surcharge).toBe(200 + 250);
    // 120 + 200 + 250
    expect(result.fee).toBe(570);
  });

  it('滿額免運與附加費同時成立：免基本運費但附加費照收', () => {
    const result = calculateShipping({
      method: 'HOME_DELIVERY',
      subtotal: 1500,
      isRemoteArea: true,
      isSameDay: true,
    });
    expect(result.baseFee).toBe(0);
    expect(result.surcharge).toBe(450);
    // 0 + 200 + 250
    expect(result.fee).toBe(450);
    expect(result.freeShippingApplied).toBe(true);
  });

  it('超商取貨滿額 + 附加費：60 照收（不免運），附加費疊加', () => {
    const result = calculateShipping({
      method: 'CONVENIENCE_STORE',
      subtotal: 2000,
      isRemoteArea: true,
      isSameDay: true,
    });
    expect(result.baseFee).toBe(60);
    // 60 + 200 + 250
    expect(result.fee).toBe(510);
    expect(result.freeShippingApplied).toBe(false);
  });

  it('設定值與規則常數一致', () => {
    expect(SHIPPING_CONFIG.HOME_DELIVERY_BASE_FEE).toBe(120);
    expect(SHIPPING_CONFIG.CONVENIENCE_STORE_FEE).toBe(60);
    expect(SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD).toBe(1500);
    expect(SHIPPING_CONFIG.REMOTE_AREA_SURCHARGE).toBe(200);
    expect(SHIPPING_CONFIG.SAME_DAY_SURCHARGE).toBe(250);
  });

  it('不合法的配送方式丟出 INVALID_SHIPPING_METHOD', () => {
    expect(() =>
      // @ts-expect-error 測試非法輸入
      calculateShipping({ method: 'DRONE', subtotal: 980 })
    ).toThrowError(/配送方式不合法/);
  });
});
