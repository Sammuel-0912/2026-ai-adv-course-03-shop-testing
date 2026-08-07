import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from './zod.js';
import {
  ErrorResponseSchema,
  IdPathParamSchema,
  success,
  successWithMessage,
} from './schemas/common.js';
import {
  AuthResultSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  UserSchema,
} from './schemas/auth.js';
import { ProductSchema } from './schemas/product.js';
import { CouponPreviewRequestSchema, CouponRuleSchema, PreviewResultSchema } from './schemas/coupon.js';
import { CartItemSchema } from './schemas/cart.js';
import {
  CheckoutResultSchema,
  CreateOrderRequestSchema,
  OrderItemSchema,
  OrderSchema,
} from './schemas/order.js';
import { EcpayCallbackFormSchema } from './schemas/ecpay.js';

export const registry = new OpenAPIRegistry();

// 必須明確註冊每個具名 component。
// 若只靠「被別的 schema 引用」自動註冊，使用端的 .nullable() / .describe() 會被寫進
// component 本身（例如 PreviewResult.coupon 的 nullable 會污染 CouponRule），
// 而不是以 allOf 套在引用處。
const COMPONENTS: Array<[string, z.ZodTypeAny]> = [
  ['ErrorResponse', ErrorResponseSchema],
  ['User', UserSchema],
  ['AuthResult', AuthResultSchema],
  ['RegisterRequest', RegisterRequestSchema],
  ['LoginRequest', LoginRequestSchema],
  ['Product', ProductSchema],
  ['CartItem', CartItemSchema],
  ['CouponRule', CouponRuleSchema],
  ['PreviewResult', PreviewResultSchema],
  ['CouponPreviewRequest', CouponPreviewRequestSchema],
  ['OrderItem', OrderItemSchema],
  ['Order', OrderSchema],
  ['CreateOrderRequest', CreateOrderRequestSchema],
  ['CheckoutResult', CheckoutResultSchema],
  ['EcpayCallbackForm', EcpayCallbackFormSchema],
];
for (const [name, schema] of COMPONENTS) registry.register(name, schema);

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: '登入或註冊取得的 JWT，放在 `Authorization: Bearer <token>`',
});

const secured = [{ [bearerAuth.name]: [] }];

/** JSON 成功回應 */
function json(description: string, schema: z.ZodTypeAny) {
  return { description, content: { 'application/json': { schema } } };
}

/** 統一錯誤 envelope 回應 */
function fail(description: string) {
  return { description, content: { 'application/json': { schema: ErrorResponseSchema } } };
}

/** application/json request body */
function body(schema: z.ZodTypeAny) {
  return { content: { 'application/json': { schema } }, required: true };
}

// ---------------------------------------------------------------- Health

registry.registerPath({
  method: 'get',
  path: '/api/health',
  tags: ['Health'],
  summary: '健康檢查',
  description: 'CI 以 wait-on 輪詢此端點，確認後端已就緒。',
  responses: {
    200: json('服務正常', success(z.object({ status: z.literal('ok') }))),
  },
});

// ------------------------------------------------------------------ Auth

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: '註冊會員',
  request: { body: body(RegisterRequestSchema) },
  responses: {
    201: json('註冊成功', successWithMessage(AuthResultSchema)),
    400: fail('`VALIDATION_ERROR` —— Email 格式不正確／密碼長度至少 8 碼／姓名為必填'),
    409: fail('`EMAIL_TAKEN` —— 此 Email 已被註冊'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: '登入',
  description: '缺欄位、帳號不存在、密碼錯誤一律回 401，不洩漏帳號是否存在。',
  request: { body: body(LoginRequestSchema) },
  responses: {
    200: json('登入成功', successWithMessage(AuthResultSchema)),
    401: fail('`INVALID_CREDENTIALS` —— 帳號或密碼錯誤'),
  },
});

// -------------------------------------------------------------- Products

registry.registerPath({
  method: 'get',
  path: '/api/products',
  tags: ['Products'],
  summary: '商品列表',
  responses: {
    200: json('商品列表', success(z.array(ProductSchema))),
  },
});

// --------------------------------------------------------------- Coupons

registry.registerPath({
  method: 'post',
  path: '/api/coupons/preview',
  tags: ['Coupons'],
  summary: '優惠券試算',
  description:
    '伺服器端重算金額，不信任前端傳入的價格。與建立訂單共用同一個 `calculateOrderAmount()` 純函式。',
  request: { body: body(CouponPreviewRequestSchema) },
  responses: {
    200: json('試算結果', success(PreviewResultSchema)),
    400: fail('`VALIDATION_ERROR` —— items 格式問題；`COUPON_MIN_SPEND_NOT_MET` —— 未達低消門檻'),
    404: fail('`PRODUCT_NOT_FOUND` —— 商品不存在；`COUPON_NOT_FOUND` —— 優惠券不存在或已停用'),
  },
});

// ---------------------------------------------------------------- Orders

registry.registerPath({
  method: 'post',
  path: '/api/orders',
  tags: ['Orders'],
  summary: '建立訂單',
  description: '單一 transaction 內扣庫存、建立訂單與 pending 通知；任一步失敗全部 rollback。',
  security: secured,
  request: { body: body(CreateOrderRequestSchema) },
  responses: {
    201: json('訂單建立成功', successWithMessage(OrderSchema)),
    400: fail('`VALIDATION_ERROR`／`COUPON_MIN_SPEND_NOT_MET`'),
    401: fail('`UNAUTHORIZED` —— 請先登入'),
    404: fail('`PRODUCT_NOT_FOUND`／`COUPON_NOT_FOUND`'),
    409: fail('`INSUFFICIENT_STOCK` —— 商品庫存不足'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/orders/{id}',
  tags: ['Orders'],
  summary: '訂單詳情',
  description: '僅能查詢本人訂單；非本人一律回 404，避免洩漏其他人的訂單是否存在。',
  security: secured,
  request: { params: IdPathParamSchema },
  responses: {
    200: json('訂單詳情', success(OrderSchema)),
    401: fail('`UNAUTHORIZED`'),
    404: fail('`ORDER_NOT_FOUND` —— 訂單不存在'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/orders/{id}/checkout',
  tags: ['Orders'],
  summary: '建立綠界付款表單',
  description:
    '每次呼叫都會重新產生 `merchantTradeNo`（綠界不接受重複編號）。付款方式全開（`ChoosePayment: ALL`）。',
  security: secured,
  request: { params: IdPathParamSchema },
  responses: {
    200: json('綠界自動送出表單', success(CheckoutResultSchema)),
    401: fail('`UNAUTHORIZED`'),
    404: fail('`ORDER_NOT_FOUND`'),
    409: fail('`ORDER_NOT_PAYABLE` —— 訂單狀態不可付款'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/orders/{id}/check-payment',
  tags: ['Orders'],
  summary: '查詢綠界付款狀態',
  description:
    '付款狀態的唯一來源是綠界 QueryTradeInfo。`TradeStatus === "1"` 時更新為 paid 並建立通知。',
  security: secured,
  request: { params: IdPathParamSchema },
  responses: {
    200: json('最新訂單狀態', successWithMessage(OrderSchema)),
    401: fail('`UNAUTHORIZED`'),
    404: fail('`ORDER_NOT_FOUND`'),
    409: fail('`ORDER_NOT_PAYABLE` —— 此訂單尚未進行結帳'),
    500: fail('`INTERNAL_SERVER_ERROR` —— 綠界查詢失敗'),
  },
});

// ----------------------------------------------------------------- ECPay

registry.registerPath({
  method: 'post',
  path: '/api/ecpay/notify',
  tags: ['ECPay'],
  summary: '綠界 ReturnURL（server-to-server）',
  description:
    '綠界背景通知。僅驗證 CheckMacValue 後回純文字，**不寫 DB**。本地開發時綠界打不到 localhost，屬預期行為。',
  request: {
    body: {
      content: { 'application/x-www-form-urlencoded': { schema: EcpayCallbackFormSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'CheckMacValue 驗證通過',
      content: { 'text/plain': { schema: z.string().openapi({ example: '1|OK' }) } },
    },
    400: {
      description: 'CheckMacValue 驗證失敗',
      content: {
        'text/plain': { schema: z.string().openapi({ example: '0|CheckMacValueError' }) },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ecpay/result',
  tags: ['ECPay'],
  summary: '綠界 OrderResultURL（瀏覽器 form POST）',
  description: '只做 302 轉址回前端訂單頁，**不寫 DB**。付款狀態由訂單頁輪詢 check-payment 取得。',
  request: {
    body: {
      content: { 'application/x-www-form-urlencoded': { schema: EcpayCallbackFormSchema } },
      required: true,
    },
  },
  responses: {
    302: {
      description: '轉址回前端；查無對應訂單時轉回前端首頁',
      headers: {
        Location: {
          description: '前端訂單頁網址',
          schema: { type: 'string', example: 'http://localhost:5173/orders/1?payment=pending' },
        },
      },
    },
  },
});
