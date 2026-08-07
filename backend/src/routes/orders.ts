import { Router } from 'express';
import { db } from '../db/index.js';
import { auth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { CreateOrderRequestSchema } from '../openapi/schemas/order.js';
import {
  consumeCoupon,
  findUsableCoupon,
  toCouponRule,
  type CouponRow,
} from '../services/coupons.js';
import {
  calculateOrderAmount,
  generateMerchantTradeNo,
  type PricingItem,
} from '../services/pricing.js';
import { createPaymentFormHtml, queryTradeInfo } from '../services/ecpayClient.js';

const router = Router();

// 所有訂單路由皆需登入
router.use(auth);

interface ProductRow {
  id: number;
  name: string;
  price: number;
  stock: number;
}

interface OrderRow {
  id: number;
  user_id: number;
  coupon_id: number | null;
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'paid' | 'failed';
  merchant_trade_no: string | null;
  created_at: string;
  paid_at: string | null;
}

interface OrderItemRow {
  product_id: number;
  name: string;
  quantity: number;
  unit_price: number;
}

/** 查訂單 items（JOIN 商品取得品名） */
function getOrderItems(orderId: number): OrderItemRow[] {
  return db
    .prepare(
      `SELECT oi.product_id, p.name, oi.quantity, oi.unit_price
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`
    )
    .all(orderId) as OrderItemRow[];
}

/** DB row（snake_case）→ API JSON（camelCase） */
function serializeOrder(order: OrderRow) {
  return {
    id: order.id,
    userId: order.user_id,
    couponId: order.coupon_id,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    status: order.status,
    merchantTradeNo: order.merchant_trade_no,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    items: getOrderItems(order.id).map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}

/** 查本人訂單，查無或非本人一律回 404（避免洩漏其他人的訂單存在與否） */
function getOwnOrder(orderId: string, userId: number): OrderRow {
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, userId) as OrderRow | undefined;

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', '訂單不存在');
  }
  return order;
}

// 後台訂單列表：新到舊排序，並附上各筆訂單品項
router.get('/', requireAdmin, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC')
    .all() as OrderRow[];

  res.json({ data: orders.map(serializeOrder) });
});

// 建立訂單（transaction：扣庫存＋建訂單＋建 pending 通知）
router.post('/', validateBody(CreateOrderRequestSchema), (req, res) => {
  const userId = req.userId!;
  const { items, couponCode } = req.body as {
    items: Array<{ productId: number; quantity: number }>;
    couponCode?: string;
  };

  // 優惠券在 transaction 外先做快檢（不存在／停用／已用罄），
  // 讓券的問題比庫存不足更早回報；權威的額度判定在 transaction 內的 consumeCoupon()。
  const coupon: CouponRow | null = couponCode ? findUsableCoupon(couponCode) : null;

  const createOrder = db.transaction(() => {
    const pricingItems: PricingItem[] = [];
    const resolvedItems: Array<{ productId: number; quantity: number; unitPrice: number }> = [];

    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of items) {
      const product = db
        .prepare('SELECT id, name, price, stock FROM products WHERE id = ?')
        .get(item.productId) as ProductRow | undefined;

      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', '商品不存在');
      }
      if (product.stock < item.quantity) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', `商品「${product.name}」庫存不足`);
      }

      updateStock.run(item.quantity, product.id);
      pricingItems.push({ price: product.price, quantity: item.quantity });
      resolvedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    // 金額一律經過 calculateOrderAmount 純函式（與 preview 共用）
    const { subtotal, discount, total } = calculateOrderAmount(
      pricingItems,
      coupon ? toCouponRule(coupon) : null
    );

    // 扣一次使用額度（條件式 UPDATE，額度被搶光時拋 409 並讓整筆 transaction rollback）
    if (coupon) {
      consumeCoupon(coupon.id);
    }

    const orderResult = db
      .prepare(
        `INSERT INTO orders (user_id, coupon_id, subtotal, discount, total, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(userId, coupon?.id ?? null, subtotal, discount, total);

    const orderId = Number(orderResult.lastInsertRowid);

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
    );
    for (const item of resolvedItems) {
      insertItem.run(orderId, item.productId, item.quantity, item.unitPrice);
    }

    // 建立 pending 通知（由 notification worker 或測試處理）
    db.prepare(
      `INSERT INTO notifications (user_id, order_id, type, status, message)
       VALUES (?, ?, 'order_created', 'pending', ?)`
    ).run(userId, orderId, `訂單 #${orderId} 已建立，金額 ${total} 元`);

    return orderId;
  });

  const orderId = createOrder();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow;

  res.status(201).json({ data: serializeOrder(order), message: '訂單建立成功' });
});

// 訂單詳情（僅本人）
router.get('/:id', (req, res) => {
  const order = getOwnOrder(req.params.id, req.userId!);
  res.json({ data: serializeOrder(order) });
});

// 建立綠界付款表單（每次 checkout 重新產生 merchant_trade_no，綠界不接受重複編號）
router.post('/:id/checkout', (req, res) => {
  const order = getOwnOrder(req.params.id, req.userId!);

  if (order.status !== 'pending') {
    throw new AppError(409, 'ORDER_NOT_PAYABLE', '訂單狀態不可付款');
  }

  const merchantTradeNo = generateMerchantTradeNo();
  db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?').run(merchantTradeNo, order.id);

  const items = getOrderItems(order.id);
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  const html = createPaymentFormHtml({
    merchantTradeNo,
    totalAmount: order.total,
    tradeDesc: '花店電商訂單',
    itemName: items.map((item) => `${item.name} x${item.quantity}`).join('#'),
    returnUrl: `${baseUrl}/api/ecpay/notify`,
    orderResultUrl: `${baseUrl}/api/ecpay/result`,
    // ATM/超商等取號結果通知走同一個 notify（僅驗 CheckMacValue 回 1|OK）
    paymentInfoUrl: `${baseUrl}/api/ecpay/notify`,
    // ATM 取號完成頁的「返回商店」導回訂單頁，由訂單頁輪詢 check-payment
    clientBackUrl: `${frontendUrl}/orders/${order.id}`,
  });

  res.json({ data: { html } });
});

// 查詢綠界付款狀態（付款狀態唯一來源是 QueryTradeInfo）
router.post('/:id/check-payment', async (req, res) => {
  const order = getOwnOrder(req.params.id, req.userId!);

  // 已付款直接回傳，不再查詢綠界
  if (order.status === 'paid') {
    res.json({ data: serializeOrder(order), message: '此訂單已付款' });
    return;
  }

  if (!order.merchant_trade_no) {
    throw new AppError(409, 'ORDER_NOT_PAYABLE', '此訂單尚未進行結帳');
  }

  const result = await queryTradeInfo(order.merchant_trade_no);

  if (result.TradeStatus === '1') {
    const markPaid = db.transaction(() => {
      db.prepare(
        "UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?"
      ).run(order.id);

      db.prepare(
        `INSERT INTO notifications (user_id, order_id, type, status, message)
         VALUES (?, ?, 'payment_received', 'pending', ?)`
      ).run(order.user_id, order.id, `訂單 #${order.id} 已完成付款`);
    });
    markPaid();
  }

  const latest = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) as OrderRow;
  res.json({
    data: serializeOrder(latest),
    message: latest.status === 'paid' ? '付款成功' : '尚未完成付款，請稍後再查詢',
  });
});

export default router;
