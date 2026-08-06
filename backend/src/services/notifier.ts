import type { Database } from 'better-sqlite3';
import { db } from '../db/index.js';

/**
 * 處理待寄送通知：把所有 pending 通知標記為 sent 並寫入 sent_at。
 * 同步執行，回傳處理筆數（測試可直接呼叫驗證）。
 */
export function processPendingNotifications(database: Database = db): number {
  const result = database
    .prepare(
      "UPDATE notifications SET status = 'sent', sent_at = datetime('now') WHERE status = 'pending'"
    )
    .run();

  return result.changes;
}

/**
 * 啟動通知背景工作（僅 server.ts 使用；app.ts 不得啟動背景任務）。
 * unref() 讓 timer 不阻止程序結束。
 */
export function startNotificationWorker(intervalMs = 5000): NodeJS.Timeout {
  const timer = setInterval(() => {
    const processed = processPendingNotifications();
    if (processed > 0) {
      console.log(`[notifier] 已寄送 ${processed} 筆通知`);
    }
  }, intervalMs);

  timer.unref();
  return timer;
}
