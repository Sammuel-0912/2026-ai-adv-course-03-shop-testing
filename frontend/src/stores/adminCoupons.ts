import { defineStore } from 'pinia'
import {
  ApiError,
  createCoupon as apiCreateCoupon,
  fetchCoupons,
  updateCoupon as apiUpdateCoupon,
  type Coupon,
  type CreateCouponPayload,
  type UpdateCouponPayload,
} from '../api/client'

let activeLoad: Promise<void> | null = null

export const useAdminCouponsStore = defineStore('adminCoupons', {
  state: () => ({
    coupons: [] as Coupon[],
    loading: false,
    loaded: false,
    readOnly: false,
    errorCode: '',
    errorMessage: '',
  }),
  getters: {
    activeCount: (state) =>
      state.coupons.filter((coupon) => coupon.isActive).length,
    inactiveCount: (state) =>
      state.coupons.filter((coupon) => !coupon.isActive).length,
    totalUsed: (state) =>
      state.coupons.reduce((sum, coupon) => sum + coupon.usedCount, 0),
    exhaustedCount: (state) =>
      state.coupons.filter(
        (coupon) =>
          coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit,
      ).length,
  },
  actions: {
    async loadCoupons(force = false) {
      if (this.loaded && !force) return
      if (activeLoad && !force) return activeLoad

      this.loading = true
      this.errorCode = ''
      this.errorMessage = ''

      activeLoad = (async () => {
        try {
          try {
            this.coupons = await fetchCoupons(true)
            this.readOnly = false
          } catch (error) {
            if (!(error instanceof ApiError && error.code === 'FORBIDDEN')) {
              throw error
            }

            // 一般會員改讀公開列表，仍可瀏覽後台課程頁面，但不取得停用券。
            this.coupons = await fetchCoupons()
            this.readOnly = true
          }
          this.loaded = true
        } catch (error) {
          this.loaded = false
          this.errorCode =
            error instanceof ApiError ? error.code : 'UNKNOWN_ERROR'
          this.errorMessage =
            error instanceof ApiError ? error.message : '無法載入優惠券資料'
          throw error
        } finally {
          this.loading = false
          activeLoad = null
        }
      })()

      return activeLoad
    },
    async createCoupon(payload: CreateCouponPayload) {
      const coupon = await apiCreateCoupon(payload)
      this.coupons.unshift(coupon)
      return coupon
    },
    async updateCoupon(id: number, payload: UpdateCouponPayload) {
      const coupon = await apiUpdateCoupon(id, payload)
      const index = this.coupons.findIndex((item) => item.id === id)
      if (index === -1) this.coupons.unshift(coupon)
      else this.coupons[index] = coupon
      return coupon
    },
  },
})
