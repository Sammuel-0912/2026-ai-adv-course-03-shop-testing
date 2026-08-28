import { defineConfig, devices } from '@playwright/test';

// Playwright E2E 設定。
//
// 重要：本測試「直接使用已啟動的專案」，不自動啟動測試伺服器。
// 執行前請先啟動：
//   - 後端 API：backend/ 執行 `pnpm dev`（http://localhost:3001）
//   - 前端 SPA：frontend/ 執行 `pnpm dev`（http://localhost:5173）
//
// baseURL 指向「前端 UI」(5173)：登入、購物車、結帳等畫面都在前端；
// 3001 是純 API（無畫面），故 UI E2E 對 5173 操作。可用 E2E_BASE_URL 覆寫。
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    headless: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
