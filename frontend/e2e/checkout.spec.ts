import { expect, test } from '@playwright/test'

test('can add a product, log in, and complete payment', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '全部商品' })).toBeVisible()
  await page.getByTestId('add-to-cart-1').click()
  await expect(page.getByTestId('cart-count')).toHaveText('1')

  await page.getByTestId('nav-cart').click()
  await expect(page.getByRole('heading', { name: '購物車' })).toBeVisible()
  await expect(page.getByTestId('total')).toHaveText('980')

  await page.getByTestId('go-checkout').click()
  await expect(page).toHaveURL(/\/login\?redirect=\/checkout$/)

  await page.getByTestId('login-email').fill('user@example.com')
  await page.getByTestId('login-password').fill('12345678')
  await page.getByTestId('login-submit').click()

  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByTestId('checkout-button')).toBeEnabled()

  const createOrderResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/orders') &&
      response.request().method() === 'POST',
  )

  await page.getByTestId('checkout-button').click()
  expect((await createOrderResponse).status()).toBe(201)

  await expect(page).toHaveURL(/\/orders\/\d+\?payment=pending$/)
  await expect(page.getByTestId('order-status')).toHaveText('已付款', {
    timeout: 15_000,
  })
  await expect(page.getByTestId('cart-count')).toHaveCount(0)
})
