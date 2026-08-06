import 'dotenv/config';
import app from './app.js';
import { startNotificationWorker } from './services/notifier.js';

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`API 伺服器已啟動：http://localhost:${port}`);
});

// 通知背景工作只在 server.ts 啟動（app.ts 不得啟動背景任務）
startNotificationWorker();
