// 購物車 store：純前端狀態，localStorage 持久化（key 前綴 shop_）
import { defineStore } from 'pinia'
import type { CartItemPayload } from '../api/client'

const CART_KEY = 'shop_cart'

export interface CartItem {
  productId: number
  name: string
  price: number
  quantity: number
}

interface CartState {
  items: CartItem[]
  couponCode: string
}

/** 從 localStorage 還原購物車（壞資料時回傳空車） */
function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CartState>
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        couponCode: typeof parsed.couponCode === 'string' ? parsed.couponCode : '',
      }
    }
  } catch {
    // 忽略壞資料，回傳空購物車
  }
  return { items: [], couponCode: '' }
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => loadCart(),
  getters: {
    /** 購物車內商品總數（nav badge 用） */
    count: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    /** 給 API 的品項格式：{productId, quantity}[] */
    itemsPayload: (state): CartItemPayload[] =>
      state.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  },
  actions: {
    /** 寫回 localStorage */
    persist() {
      localStorage.setItem(
        CART_KEY,
        JSON.stringify({ items: this.items, couponCode: this.couponCode }),
      )
    },
    /** 加入商品（已存在則累加數量） */
    add(product: { productId: number; name: string; price: number }, quantity = 1) {
      const existing = this.items.find((item) => item.productId === product.productId)
      if (existing) {
        existing.quantity += quantity
      } else {
        this.items.push({ ...product, quantity })
      }
      this.persist()
    },
    /** 移除商品 */
    remove(productId: number) {
      this.items = this.items.filter((item) => item.productId !== productId)
      this.persist()
    },
    /** 調整數量（<= 0 時直接移除） */
    setQuantity(productId: number, quantity: number) {
      const item = this.items.find((entry) => entry.productId === productId)
      if (!item) return
      if (quantity <= 0) {
        this.remove(productId)
        return
      }
      item.quantity = Math.floor(quantity)
      this.persist()
    },
    /** 設定已套用的優惠券代碼（空字串代表未套用） */
    setCouponCode(code: string) {
      this.couponCode = code
      this.persist()
    },
    /** 清空購物車與優惠券 */
    clear() {
      this.items = []
      this.couponCode = ''
      this.persist()
    },
  },
})
