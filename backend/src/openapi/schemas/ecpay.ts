import { z } from '../zod.js';

/**
 * 綠界回傳的表單參數（application/x-www-form-urlencoded）。
 * 欄位隨付款方式而異，僅約定為字串對字串，實際驗證靠 CheckMacValue。
 */
export const EcpayCallbackFormSchema = z
  .record(z.string(), z.string())
  .openapi('EcpayCallbackForm', {
    example: {
      MerchantID: '3002607',
      MerchantTradeNo: 'ORD20260807120000A1B',
      RtnCode: '1',
      TradeAmt: '1764',
      CheckMacValue: 'A1B2C3...',
    },
  });
