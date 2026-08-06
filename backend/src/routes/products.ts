import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

interface ProductRow {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  created_at: string;
}

// 商品列表
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all() as ProductRow[];

  res.json({
    data: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      createdAt: p.created_at,
    })),
  });
});

export default router;
