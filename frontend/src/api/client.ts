// API fetch wrapper：統一處理 envelope、JWT、錯誤
// 契約以根目錄 AGENTS.md 為準：
// - 成功：{ data, message? }
// - 失敗：{ error: { code, message } }

const base: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'

const TOKEN_KEY = 'shop_token'

/** API 錯誤：帶有後端錯誤碼與 HTTP 狀態碼 */
export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

// ---------- 型別定義（對齊 AGENTS.md API 契約，欄位使用 camelCase） ----------

export interface User {
  id: number
  email: string
  name: string
}

export interface AuthResult {
  token: string
  user: User
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
}

/** 給 API 的購物車品項（{productId, quantity}[]） */
export interface CartItemPayload {
  productId: number
  quantity: number
}

export interface CouponInfo {
  code: string
  percentOff?: number
  maxDiscount?: number
  minSpend?: number
}

/** 管理端優惠券資料（對齊 OpenAPI Coupon schema） */
export interface Coupon {
  id: number
  code: string
  percentOff: number
  maxDiscount: number
  minSpend: number
  usageLimit: number | null
  usedCount: number
  isActive: boolean
}

export interface CreateCouponPayload {
  code: string
  percentOff: number
  maxDiscount: number
  minSpend: number
  usageLimit?: number | null
  isActive?: boolean
}

export type UpdateCouponPayload = Partial<
  Omit<CreateCouponPayload, 'code'>
>

/** 優惠券試算結果：金額一律以後端回傳為準 */
export interface PreviewResult {
  subtotal: number
  discount: number
  total: number
  coupon?: CouponInfo
}

export type OrderStatus = 'pending' | 'paid' | string

export interface OrderItem {
  productId: number
  name?: string
  unitPrice: number
  quantity: number
}

export interface Order {
  id: number | string
  status: OrderStatus
  subtotal: number
  discount: number
  total: number
  couponCode?: string | null
  items?: OrderItem[]
  createdAt?: string
}

// ---------- fetch wrapper ----------

/**
 * 發送 API 請求：
 * - 自動帶 Content-Type 與 localStorage 的 JWT（Bearer）
 * - 回應非 2xx 或含 error 時 throw ApiError
 * - 成功回傳 envelope 的 data
 */
async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(`${base}${path}`, { ...opts, headers })
  } catch {
    throw new ApiError('NETWORK_ERROR', '無法連線到伺服器，請稍後再試', 0)
  }

  // 嘗試解析 JSON（部分錯誤回應可能沒有 body）
  interface Envelope {
    data?: unknown
    message?: string
    error?: { code?: string; message?: string }
  }
  let body: Envelope | null = null
  try {
    body = (await res.json()) as Envelope
  } catch {
    body = null
  }

  if (!res.ok || body?.error) {
    const code = body?.error?.code ?? 'UNKNOWN_ERROR'
    const message = body?.error?.message ?? `請求失敗（HTTP ${res.status}）`
    throw new ApiError(code, message, res.status)
  }

  return body?.data as T
}

// ---------- 型別化 API 函式 ----------

/** 註冊：POST /api/auth/register */
export function register(payload: { email: string; password: string; name: string }): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 登入：POST /api/auth/login */
export function login(payload: { email: string; password: string }): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 商品列表：GET /api/products */
export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>('/api/products')
}

/** 優惠券列表；管理端帶 includeInactive=true 取得完整資料 */
export function fetchCoupons(includeInactive = false): Promise<Coupon[]> {
  const query = includeInactive ? '?includeInactive=true' : ''
  return request<Coupon[]>(`/api/coupons${query}`)
}

/** 建立優惠券（需管理者權限） */
export function createCoupon(payload: CreateCouponPayload): Promise<Coupon> {
  return request<Coupon>('/api/coupons', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 更新優惠券（需管理者權限；code 與 usedCount 不可修改） */
export function updateCoupon(id: number, payload: UpdateCouponPayload): Promise<Coupon> {
  return request<Coupon>(`/api/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** 優惠券試算：POST /api/coupons/preview（無券時也可呼叫取得 subtotal） */
export function previewCoupon(payload: { items: CartItemPayload[]; code?: string }): Promise<PreviewResult> {
  return request<PreviewResult>('/api/coupons/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 建立訂單：POST /api/orders（需登入） */
export function createOrder(payload: { items: CartItemPayload[]; couponCode?: string }): Promise<Order> {
  return request<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 取得訂單：GET /api/orders/:id（需登入，僅本人） */
export function fetchOrder(id: number | string): Promise<Order> {
  return request<Order>(`/api/orders/${id}`)
}

/** 取得綠界自動送出表單：POST /api/orders/:id/checkout（需登入） */
export function checkoutOrder(id: number | string): Promise<{ html: string }> {
  return request<{ html: string }>(`/api/orders/${id}/checkout`, {
    method: 'POST',
  })
}

/** 查詢付款狀態：POST /api/orders/:id/check-payment（需登入） */
export function checkPayment(id: number | string): Promise<Order> {
  return request<Order>(`/api/orders/${id}/check-payment`, {
    method: 'POST',
  })
}
