// OpenAPI 產生器：以程式建立目前 API 契約的 OpenAPI 3.0 規格，輸出 docs/openapi.json。
//
// 用法：pnpm openapi（或 npm run openapi）
// 契約來源：AGENTS.md（統一 envelope、金額整數 TWD、優惠券與運費規則）。
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUTPUT = path.join(import.meta.dirname, '../../docs/openapi.json');

const spec = {
  openapi: '3.0.3',
  info: {
    title: '花卉電商 API',
    version: '1.0.0',
    description:
      '前後端分離花卉電商後端 API。所有回應使用統一 envelope：成功 `{ data, message? }`，失敗 `{ error: { code, message } }`。所有金額皆為整數 TWD。',
  },
  servers: [{ url: 'http://localhost:3001', description: '本地開發' }],
  tags: [
    { name: 'auth', description: '會員' },
    { name: 'products', description: '商品' },
    { name: 'coupons', description: '優惠券' },
    { name: 'orders', description: '訂單與運費' },
    { name: 'ecpay', description: '綠界金流' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['products'],
        summary: '健康檢查（CI wait-on 用）',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['auth'],
        summary: '註冊',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@hexschool.com' },
                  password: { type: 'string', example: '12345678' },
                  name: { type: 'string', example: '管理員' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: '註冊成功',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '409': {
            description: 'email 重複',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['auth'],
        summary: '登入',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@hexschool.com' },
                  password: { type: 'string', example: '12345678' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '登入成功',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '401': {
            description: '帳號或密碼錯誤',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/products': {
      get: {
        tags: ['products'],
        summary: '商品列表',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Product' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/coupons/preview': {
      post: {
        tags: ['coupons'],
        summary: '優惠券與運費試算（伺服器端重算金額）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/OrderItemInput' } },
                  code: { type: 'string', example: 'WELCOME10' },
                  shipping: { $ref: '#/components/schemas/ShippingInput' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '試算結果',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        subtotal: { type: 'integer' },
                        discount: { type: 'integer' },
                        shippingFee: { type: 'integer', description: '運費（未帶 shipping 時為 0）' },
                        total: { type: 'integer', description: 'subtotal - discount + shippingFee' },
                        coupon: {
                          type: 'object',
                          nullable: true,
                          properties: { code: { type: 'string' }, percentOff: { type: 'integer' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/orders': {
      post: {
        tags: ['orders'],
        summary: '建立訂單（含運費計算，扣庫存＋建 pending 通知）',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/OrderItemInput' } },
                  couponCode: { type: 'string' },
                  shipping: { $ref: '#/components/schemas/ShippingInput' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: '建立成功',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Order' } } },
              },
            },
          },
          '400': {
            description: '驗證失敗（含 INVALID_SHIPPING_METHOD、COUPON_MIN_SPEND_NOT_MET）',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: '未授權',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: '庫存不足 INSUFFICIENT_STOCK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['orders'],
        summary: '訂單詳情（僅本人）',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Order' } } },
              },
            },
          },
          '404': {
            description: '訂單不存在',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/orders/{id}/checkout': {
      post: {
        tags: ['orders'],
        summary: '建立綠界付款表單（付款方式全開 ALL）',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: '綠界自動送出表單 HTML',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'object', properties: { html: { type: 'string' } } },
                  },
                },
              },
            },
          },
          '409': {
            description: '訂單狀態不可付款 ORDER_NOT_PAYABLE',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/orders/{id}/check-payment': {
      post: {
        tags: ['orders'],
        summary: '向綠界 QueryTradeInfo 查詢付款狀態',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: '最新訂單狀態',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Order' } } },
              },
            },
          },
        },
      },
    },
    '/api/ecpay/notify': {
      post: {
        tags: ['ecpay'],
        summary: '綠界 ReturnURL（server-to-server，僅驗 CheckMacValue 回 1|OK）',
        responses: { '200': { description: '1|OK' } },
      },
    },
    '/api/ecpay/result': {
      post: {
        tags: ['ecpay'],
        summary: '綠界 OrderResultURL（僅 302 redirect 回前端訂單頁）',
        responses: { '302': { description: 'Redirect' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'integer' },
          stock: { type: 'integer' },
        },
      },
      OrderItemInput: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'integer', example: 1 },
          quantity: { type: 'integer', minimum: 1, example: 1 },
        },
      },
      ShippingInput: {
        type: 'object',
        description:
          '配送資訊。未提供時預設宅配（HOME_DELIVERY），且 isRemoteArea/isSameDay 皆為 false。',
        properties: {
          method: {
            type: 'string',
            enum: ['HOME_DELIVERY', 'CONVENIENCE_STORE'],
            default: 'HOME_DELIVERY',
            description:
              '配送方式：HOME_DELIVERY 宅配（基本運費 120，商品小計滿 1500 免基本運費）；CONVENIENCE_STORE 超商取貨（60，不在滿額免運範圍，滿額仍收 60）',
          },
          isRemoteArea: { type: 'boolean', default: false, description: '偏遠地區加收 200' },
          isSameDay: { type: 'boolean', default: false, description: '當日急件加收 250' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          couponId: { type: 'integer', nullable: true },
          subtotal: { type: 'integer', description: 'Σ(price × quantity)' },
          discount: { type: 'integer', description: '優惠券折扣' },
          shippingFee: { type: 'integer', description: '運費（基本運費 + 附加費）' },
          shippingMethod: {
            type: 'string',
            enum: ['HOME_DELIVERY', 'CONVENIENCE_STORE'],
            nullable: true,
          },
          total: {
            type: 'integer',
            description: '訂單總額 = subtotal - discount + shippingFee（綠界 TotalAmount）',
          },
          status: { type: 'string', enum: ['pending', 'paid', 'failed'] },
          merchantTradeNo: { type: 'string', nullable: true },
          createdAt: { type: 'string' },
          paidAt: { type: 'string', nullable: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'integer' },
                name: { type: 'string' },
                quantity: { type: 'integer' },
                unitPrice: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
};

mkdirSync(path.dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(spec, null, 2) + '\n', 'utf8');
console.log(`[generate-openapi] 已輸出 ${path.relative(process.cwd(), OUTPUT)}`);
