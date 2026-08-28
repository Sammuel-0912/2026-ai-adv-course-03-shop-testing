import { AppError } from '../middleware/errorHandler.js';

/**
 * 配送費用計算模組（純函式，可獨立測試）。
 *
 * 業務規則（見 AGENTS.md）：
 * 1. 宅配基本運費 120 元；超商取貨 60 元。
 * 2. 商品小計達 1,500 元（含）即免「基本運費」——僅宅配適用；
 *    超商取貨不在此限，即使滿額仍收 60 元。
 * 3. 偏遠地區加收 200 元；當日急件加收 250 元（附加費，任何配送方式都加收，
 *    且不受滿額免運影響）。
 * 4. 所有金額皆為整數 TWD。
 */

/** 配送方式 */
export type ShippingMethod = 'HOME_DELIVERY' | 'CONVENIENCE_STORE';

/** 配送費用設定（皆為整數 TWD） */
export const SHIPPING_CONFIG = {
  /** 宅配基本運費 */
  HOME_DELIVERY_BASE_FEE: 120,
  /** 超商取貨費用（不在滿額免運範圍，一律收取） */
  CONVENIENCE_STORE_FEE: 60,
  /** 商品小計達此金額（含）即免宅配基本運費（超商取貨不適用） */
  FREE_SHIPPING_THRESHOLD: 1500,
  /** 偏遠地區附加費 */
  REMOTE_AREA_SURCHARGE: 200,
  /** 當日急件附加費 */
  SAME_DAY_SURCHARGE: 250,
} as const;

/** 合法的配送方式（供 route 端驗證共用） */
export const SHIPPING_METHODS: readonly ShippingMethod[] = ['HOME_DELIVERY', 'CONVENIENCE_STORE'];

/** 運費計算輸入 */
export interface ShippingInput {
  /** 配送方式 */
  method: ShippingMethod;
  /** 商品小計（整數 TWD），用於判斷是否達滿額免運門檻 */
  subtotal: number;
  /** 是否為偏遠地區 */
  isRemoteArea?: boolean;
  /** 是否為當日急件 */
  isSameDay?: boolean;
}

/** 運費明細 */
export interface ShippingBreakdown {
  method: ShippingMethod;
  /** 基本運費（宅配已套用滿額免運後的金額；超商固定 60） */
  baseFee: number;
  /** 附加費合計（偏遠地區 + 當日急件） */
  surcharge: number;
  /** 運費總額 = baseFee + surcharge */
  fee: number;
  /** 是否套用了滿額免運（僅宅配可能為 true） */
  freeShippingApplied: boolean;
}

/**
 * 計算配送費用（唯一運費計算入口）。
 *
 * @throws {AppError} 400 INVALID_SHIPPING_METHOD 配送方式不合法
 * @throws {AppError} 400 VALIDATION_ERROR subtotal 非合法非負整數
 */
export function calculateShipping(input: ShippingInput): ShippingBreakdown {
  const { method, subtotal, isRemoteArea = false, isSameDay = false } = input;

  if (!SHIPPING_METHODS.includes(method)) {
    throw new AppError(400, 'INVALID_SHIPPING_METHOD', '配送方式不合法');
  }
  if (!Number.isInteger(subtotal) || subtotal < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'subtotal 必須為非負整數');
  }

  let baseFee: number;
  let freeShippingApplied = false;

  if (method === 'CONVENIENCE_STORE') {
    // 超商取貨不在滿額免運範圍內，一律收 60
    baseFee = SHIPPING_CONFIG.CONVENIENCE_STORE_FEE;
  } else {
    // 宅配基本運費：商品小計達門檻（含等於）免運
    if (subtotal >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD) {
      baseFee = 0;
      freeShippingApplied = true;
    } else {
      baseFee = SHIPPING_CONFIG.HOME_DELIVERY_BASE_FEE;
    }
  }

  const surcharge =
    (isRemoteArea ? SHIPPING_CONFIG.REMOTE_AREA_SURCHARGE : 0) +
    (isSameDay ? SHIPPING_CONFIG.SAME_DAY_SURCHARGE : 0);

  return {
    method,
    baseFee,
    surcharge,
    fee: baseFee + surcharge,
    freeShippingApplied,
  };
}
