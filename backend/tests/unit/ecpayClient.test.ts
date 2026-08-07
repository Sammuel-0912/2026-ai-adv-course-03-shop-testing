import {
  createPaymentFormHtml,
  generateCheckMacValue,
  verifyCheckMacValue,
} from '../../src/services/ecpayClient.js';

describe('ECPay helpers', () => {
  beforeEach(() => {
    vi.stubEnv('ECPAY_ENV', 'staging');
    vi.stubEnv('ECPAY_MERCHANT_ID', 'TEST123');
    vi.stubEnv('ECPAY_HASH_KEY', 'test-hash-key');
    vi.stubEnv('ECPAY_HASH_IV', 'test-hash-iv');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('generates the same CheckMacValue regardless of parameter order', () => {
    const first = generateCheckMacValue({ MerchantID: 'TEST123', B: '2', A: '1' });
    const second = generateCheckMacValue({
      A: '1',
      CheckMacValue: 'old-value',
      MerchantID: 'TEST123',
      B: '2',
    });

    expect(first).toMatch(/^[A-F0-9]{64}$/);
    expect(second).toBe(first);
  });

  it('accepts a valid CheckMacValue and rejects a tampered one', () => {
    const params = { MerchantID: 'TEST123', MerchantTradeNo: 'ORDER001' };
    const checkMacValue = generateCheckMacValue(params);
    const tampered = `${checkMacValue[0] === '0' ? '1' : '0'}${checkMacValue.slice(1)}`;

    expect(verifyCheckMacValue({ ...params, CheckMacValue: checkMacValue })).toBe(true);
    expect(verifyCheckMacValue({ ...params, CheckMacValue: tampered })).toBe(false);
  });

  it('creates a staging payment form with escaped user-controlled values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-07T04:00:00.000Z'));

    const html = createPaymentFormHtml({
      merchantTradeNo: 'ORD20260807120000AAA',
      totalAmount: 3060,
      tradeDesc: 'Flower order',
      itemName: 'Rose & "Limited" <script>',
      returnUrl: 'https://example.test/notify',
      orderResultUrl: 'https://example.test/result',
    });

    expect(html).toContain('action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"');
    expect(html).toContain('name="TotalAmount" value="3060"');
    expect(html).toContain('name="ChoosePayment" value="ALL"');
    expect(html).toContain('Rose &amp; &quot;Limited&quot; &lt;script&gt;');
    expect(html).not.toContain('value="Rose & "Limited" <script>"');
  });
});
