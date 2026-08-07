import {
  createPaymentFormHtml,
  generateCheckMacValue,
  queryTradeInfo,
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
    vi.unstubAllGlobals();
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
    expect(verifyCheckMacValue(params)).toBe(false);
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
      paymentInfoUrl: 'https://example.test/payment-info',
      clientBackUrl: 'https://example.test/orders/1',
    });

    expect(html).toContain('action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"');
    expect(html).toContain('name="TotalAmount" value="3060"');
    expect(html).toContain('name="ChoosePayment" value="ALL"');
    expect(html).toContain(
      'name="PaymentInfoURL" value="https://example.test/payment-info"'
    );
    expect(html).toContain('name="ClientBackURL" value="https://example.test/orders/1"');
    expect(html).toContain('Rose &amp; &quot;Limited&quot; &lt;script&gt;');
    expect(html).not.toContain('value="Rose & "Limited" <script>"');
  });

  it('queries the staging API with a signed request and parses its response', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-07T04:00:00.000Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('TradeStatus=1&RtnMsg=Paid', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(queryTradeInfo('ORD20260807120000AAA')).resolves.toEqual({
      TradeStatus: '1',
      RtnMsg: 'Paid',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const body = new URLSearchParams(String(init.body));
    expect(body.get('MerchantID')).toBe('TEST123');
    expect(body.get('MerchantTradeNo')).toBe('ORD20260807120000AAA');
    expect(body.get('TimeStamp')).toBe(String(Math.floor(Date.now() / 1000)));
    expect(body.get('CheckMacValue')).toMatch(/^[A-F0-9]{64}$/);
  });

  it('reports a non-successful query response without hiding its status code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Service unavailable', { status: 503 }))
    );

    await expect(queryTradeInfo('ORDER001')).rejects.toThrow(
      '綠界 QueryTradeInfo 回應異常：HTTP 503'
    );
  });
});
