import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// 花卉電商 E2E：登入 → 加入購物車 → 結帳（配送方式）→ 建立訂單 →
// 綠界（staging）網路 ATM → 台灣土地銀行 → 付款成功 → 返回商店 → 驗證訂單已付款。
//
// 前置：後端(3001)與前端(5173)皆已啟動（見 playwright.config.ts 說明）。
// 帳號：admin@hexschool.com / 12345678（若不存在，請先於前端註冊或呼叫 /api/auth/register）。
//
// 注意：步驟 6~13 為綠界 staging 與土地銀行測試頁的實際畫面，
// 其 DOM 可能隨綠界改版而變動；以下選擇器採寬鬆比對，必要時依實際頁面微調。

const ACCOUNT = { email: 'admin@hexschool.com', password: '12345678' };
const SCREENSHOT = path.join(import.meta.dirname, 'screenshots', 'paid-success.png');

/** 步驟 1：登入 */
async function login(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(ACCOUNT.email);
  await page.getByTestId('login-password').fill(ACCOUNT.password);
  await page.getByTestId('login-submit').click();
  // 登入成功會導離 /login（router.push(redirect ?? '/')）
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test('完整結帳與綠界網路ATM付款流程', async ({ page }) => {
  // 綠界頁面可能跳出提示視窗（alert/confirm）→ 一律關閉（接受）
  page.on('dialog', (dialog) => dialog.accept().catch(() => {}));

  // 1. 登入
  await login(page);

  // 2. 選擇商品並加入購物車
  await page.goto('/');
  await page.getByTestId('add-to-cart-1').click();

  // 3. 進入結帳頁面（先到購物車，再前往結帳）
  await page.goto('/cart');
  await page.getByTestId('go-checkout').click();
  await page.waitForURL('**/checkout');

  // 4. 填寫配送方式與結帳資料（選宅配，等待後端試算出運費）
  await page.getByTestId('shipping-home').check();
  await expect(page.getByTestId('shipping-fee')).toBeVisible();
  const total = await page.getByTestId('total').innerText();
  console.log('[E2E] 應付總額 =', total);

  // 5. 建立訂單（確認付款）→ 前端會整頁導向綠界自動送出表單
  await page.getByTestId('checkout-button').click();

  // 6. 前往綠界測試環境（等待離開本站，進入綠界付款頁）
  await page.waitForURL(/ecpay\.com\.tw/, { timeout: 60_000 });

  // 7. 選擇「網路 ATM」
  await page
    .getByRole('link', { name: /網路\s*ATM|WebATM/ })
    .or(page.getByText(/網路\s*ATM/).first())
    .first()
    .click();

  // 8. 選擇「台灣土地銀行」（綠界 WebATM 銀行清單是 <select>，需用 selectOption）
  const bankOption = page.locator('option', { hasText: '台灣土地銀行' }).first();
  await bankOption.waitFor({ state: 'attached', timeout: 30_000 });
  const bankValue = await bankOption.getAttribute('value');
  const bankSelect = page.locator('select').filter({ has: bankOption }).first();
  await bankSelect.selectOption(bankValue!);

  // 9. 點擊「前往付款」（綠界此按鈕實作為連結 <a>；可能同時開新分頁到銀行頁）
  const context = page.context();
  const popupPromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null);
  await page
    .getByRole('link', { name: '前往付款' })
    .or(page.getByRole('button', { name: /前往付款|確認付款|立即付款|同意付款/ }))
    .first()
    .click();

  // 10. 關閉提示視窗（綠界頁內 HTML modal「將跳轉至銀行頁面…」，只有「關閉」鈕）
  await page.getByRole('button', { name: '關閉' }).click({ timeout: 15_000 }).catch(() => {});

  const popup = await popupPromise;
  if (popup) await popup.bringToFront().catch(() => {});

  // 11. 在土地銀行測試頁面點擊 Save（可能在新分頁；跨所有分頁尋找）
  const saveSelector =
    'input[type="submit"][value="Save" i], input[value="Save" i], button:has-text("Save")';
  async function findSave() {
    for (const p of context.pages()) {
      const btn = p.locator(saveSelector).first();
      if (await btn.isVisible().catch(() => false)) return { page: p, btn };
    }
    return null;
  }
  let hit = await findSave();
  for (let i = 0; i < 30 && !hit; i++) {
    await page.waitForTimeout(1000);
    hit = await findSave();
  }
  if (!hit) {
    // 部分情況需再次點「前往付款」才會跳轉到銀行頁
    await page.getByRole('link', { name: '前往付款' }).first().click({ timeout: 5_000 }).catch(() => {});
    for (let i = 0; i < 30 && !hit; i++) {
      await page.waitForTimeout(1000);
      hit = await findSave();
    }
  }
  if (!hit) throw new Error('找不到土地銀行測試頁的 Save 按鈕');
  let payPage = hit.page;
  await payPage.bringToFront().catch(() => {});
  await hit.btn.click();

  // 12~13. 等待回到前端訂單頁。
  // WebATM 付款完成後綠界多半「自動送出」OrderResultURL（DoAutoSubmitForm）直接導回商店；
  // 若中途出現「付款成功／返回商店」頁，則主動點擊「返回商店」。
  const FRONT = process.env.E2E_BASE_URL ?? 'http://localhost:5199';
  async function findOrderPage() {
    for (const p of context.pages()) {
      if (p.url().startsWith(FRONT) && /\/orders\/\d+/.test(p.url())) return p;
    }
    return null;
  }
  let orderPage = await findOrderPage();
  for (let i = 0; i < 60 && !orderPage; i++) {
    for (const p of context.pages()) {
      const back = p
        .getByRole('button', { name: /返回商店/ })
        .or(p.getByRole('link', { name: /返回商店/ }));
      if (await back.first().isVisible().catch(() => false)) {
        await back.first().click().catch(() => {});
      }
    }
    await page.waitForTimeout(1000);
    orderPage = await findOrderPage();
  }
  if (!orderPage) throw new Error('付款後未導回前端訂單頁');

  // 14. 驗證訂單顯示「已付款」，狀態為 paid（前端每 3 秒輪詢 check-payment）
  await orderPage.bringToFront().catch(() => {});
  const status = orderPage.getByTestId('order-status');
  await expect(status).toHaveText(/已付款/, { timeout: 120_000 });

  // 15. 付款並返回站點後的成功截圖
  await orderPage.screenshot({ path: SCREENSHOT, fullPage: true });
  console.log('[E2E] 已輸出成功截圖：', SCREENSHOT);
});
