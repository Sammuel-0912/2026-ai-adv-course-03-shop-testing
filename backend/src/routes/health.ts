import { Router } from 'express';

const router = Router();

// 健康檢查（CI wait-on 用）
router.get('/', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

export default router;
