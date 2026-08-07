import { defineConfig, devices } from '@playwright/test'

const frontendUrl = 'http://127.0.0.1:4173'
const backendUrl = 'http://127.0.0.1:3101'
const fakeEcpayUrl = 'http://127.0.0.1:3102'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/support/fake-ecpay.mjs',
      url: `${fakeEcpayUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm --dir ../backend start',
      url: `${backendUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: 'e2e',
        PORT: '3101',
        DB_PATH: ':memory:',
        JWT_SECRET: 'e2e-test-secret',
        BASE_URL: backendUrl,
        FRONTEND_URL: frontendUrl,
        ECPAY_BASE_URL: fakeEcpayUrl,
      },
    },
    {
      command: 'pnpm dev --host 127.0.0.1 --port 4173 --strictPort',
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_API_BASE: backendUrl,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
