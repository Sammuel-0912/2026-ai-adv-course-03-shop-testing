import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi/document.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import couponsRouter from './routes/coupons.js';
import ordersRouter from './routes/orders.js';
import ecpayRouter from './routes/ecpay.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// app.ts 只建立並 export app：不 listen、不啟動背景任務（見 AGENTS.md）
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/ecpay', ecpayRouter);

// API 文件：openApiDocument 由 zod schema 產生，與 backend/openapi.json 同源
app.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, { customSiteTitle: '花漾商店 API 文件' })
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
