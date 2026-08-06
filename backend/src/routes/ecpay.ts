import { Router } from 'express';
import { db } from '../db/index.js';
import { verifyCheckMacValue } from '../services/ecpayClient.js';

const router = Router();

// 綠界 ReturnURL（server-to-server 通知，本地開發打不到）
// 僅驗 CheckMacValue 後回純文字，不寫 DB —— 付款狀態唯一來源是 QueryTradeInfo
router.post('/notify', (req, res) => {
  const params = (req.body ?? {}) as Record<string, string>;

  if (!verifyCheckMacValue(params)) {
    res.status(400).type('text/plain').send('0|CheckMacValueError');
    return;
  }

  res.type('text/plain').send('1|OK');
});

// 綠界 OrderResultURL（瀏覽器 form POST），只 302 redirect 回前端訂單頁，不寫 DB
router.post('/result', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const merchantTradeNo = (req.body ?? {}).MerchantTradeNo as string | undefined;

  const order = merchantTradeNo
    ? (db.prepare('SELECT id FROM orders WHERE merchant_trade_no = ?').get(merchantTradeNo) as
        | { id: number }
        | undefined)
    : undefined;

  if (!order) {
    res.redirect(302, frontendUrl);
    return;
  }

  res.redirect(302, `${frontendUrl}/orders/${order.id}?payment=pending`);
});

export default router;
