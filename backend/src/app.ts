import express from 'express';
import cors from 'cors';
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

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
