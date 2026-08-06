import { defineConfig } from 'vitest/config';

// 測試一律使用 in-memory SQLite，並關閉檔案平行執行以避免共用資料庫狀態互相干擾
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    env: {
      DB_PATH: ':memory:',
    },
  },
});
