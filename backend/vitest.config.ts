import { defineConfig } from 'vitest/config';

// 測試一律使用 in-memory SQLite，並關閉檔案平行執行以避免共用資料庫狀態互相干擾
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    // 只跑 tests/ 下的 Vitest 測試；e2e/ 由 Playwright 執行（避免 .spec.ts 被 Vitest 收錄）
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'e2e'],
    env: {
      DB_PATH: ':memory:',
    },
  },
});
