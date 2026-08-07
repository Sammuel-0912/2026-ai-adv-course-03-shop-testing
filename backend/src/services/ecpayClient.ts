import crypto from 'node:crypto';

/** 綠界設定：延遲讀取 env，避免模組載入順序早於 dotenv */
function getConfig() {
  const isStaging = (process.env.ECPAY_ENV ?? 'staging') !== 'production';
  const defaultBaseUrl = isStaging
    ? 'https://payment-stage.ecpay.com.tw'
    : 'https://payment.ecpay.com.tw';
  const baseUrl = (process.env.ECPAY_BASE_URL || defaultBaseUrl).replace(/\/$/, '');

  return {
    merchantId: process.env.ECPAY_MERCHANT_ID ?? '3002607',
    hashKey: process.env.ECPAY_HASH_KEY ?? 'pwFHCqoQZGmho4w6',
    hashIV: process.env.ECPAY_HASH_IV ?? 'EkRm7iFT261dpevs',
    aioCheckOutUrl: `${baseUrl}/Cashier/AioCheckOut/V5`,
    queryTradeInfoUrl: `${baseUrl}/Cashier/QueryTradeInfo/V5`,
  };
}

/** 綠界規定的 .NET 風格 URL encode（encodeURIComponent 後轉小寫，再還原特定字元） */
function ecpayUrlEncode(str: string): string {
  let encoded = encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');

  encoded = encoded.toLowerCase();

  // .NET UrlEncode 不編碼這些字元，需還原
  const replacements: Record<string, string> = {
    '%2d': '-',
    '%5f': '_',
    '%2e': '.',
    '%21': '!',
    '%2a': '*',
    '%28': '(',
    '%29': ')',
  };

  for (const [escaped, char] of Object.entries(replacements)) {
    encoded = encoded.split(escaped).join(char);
  }

  return encoded;
}

/** 產生綠界 CheckMacValue（SHA256）：參數依 key 排序、前後加 HashKey/HashIV、URL encode 後雜湊 */
export function generateCheckMacValue(params: Record<string, string>): string {
  const { hashKey, hashIV } = getConfig();

  const sorted = Object.entries(params)
    .filter(([key]) => key !== 'CheckMacValue')
    .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));

  const paramStr = sorted.map(([key, value]) => `${key}=${value}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIV}`;
  const encoded = ecpayUrlEncode(raw);

  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

/** 驗證綠界回傳的 CheckMacValue（timing-safe 比對） */
export function verifyCheckMacValue(params: Record<string, string>): boolean {
  const received = params.CheckMacValue ?? '';
  const calculated = generateCheckMacValue(params);

  const a = Buffer.from(calculated);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** 綠界 MerchantTradeDate 格式：yyyy/MM/dd HH:mm:ss（台北時區） */
function getMerchantTradeDate(): string {
  return new Date()
    .toLocaleString('sv-SE', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/-/g, '/');
}

/** HTML 屬性跳脫，避免品名等內容破壞表單結構 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface CreatePaymentFormOptions {
  merchantTradeNo: string;
  totalAmount: number;
  tradeDesc: string;
  itemName: string;
  returnUrl: string;
  orderResultUrl: string;
  /** ATM 等非即時付款方式的取號結果通知（server-to-server） */
  paymentInfoUrl?: string;
  /** 綠界頁面「返回商店」按鈕的目的地（ATM 取號完成頁等） */
  clientBackUrl?: string;
}

/** 產生綠界 AioCheckOut/V5 自動送出表單 HTML（付款方式全開） */
export function createPaymentFormHtml(opts: CreatePaymentFormOptions): string {
  const config = getConfig();

  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: opts.merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(opts.totalAmount),
    TradeDesc: opts.tradeDesc,
    ItemName: opts.itemName,
    ReturnURL: opts.returnUrl,
    OrderResultURL: opts.orderResultUrl,
    ChoosePayment: 'ALL',
    EncryptType: '1',
  };

  if (opts.paymentInfoUrl) params.PaymentInfoURL = opts.paymentInfoUrl;
  if (opts.clientBackUrl) params.ClientBackURL = opts.clientBackUrl;

  params.CheckMacValue = generateCheckMacValue(params);

  const fields = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}">`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>正在前往綠界付款...</title></head>
<body>
  <p style="text-align:center;margin-top:50px;font-family:sans-serif;">正在導向綠界付款頁面，請稍候...</p>
  <form id="ecpay-form" method="post" action="${config.aioCheckOutUrl}">
    ${fields}
  </form>
  <script>document.getElementById("ecpay-form").submit();</script>
</body>
</html>`;
}

/**
 * 綠界 QueryTradeInfo：查詢交易狀態（付款狀態唯一來源）。
 * 注意 TimeStamp 為 Unix 秒且僅 3 分鐘有效，每次呼叫都重新產生。
 * 回應為 URL-encoded key=value 字串，解析成物件回傳（TradeStatus === '1' 表示已付款）。
 */
export async function queryTradeInfo(merchantTradeNo: string): Promise<Record<string, string>> {
  const config = getConfig();

  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };

  params.CheckMacValue = generateCheckMacValue(params);

  const response = await fetch(config.queryTradeInfoUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    throw new Error(`綠界 QueryTradeInfo 回應異常：HTTP ${response.status}`);
  }

  const text = await response.text();
  return Object.fromEntries(new URLSearchParams(text));
}
