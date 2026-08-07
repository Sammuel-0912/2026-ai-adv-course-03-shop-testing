<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, type CreateCouponPayload } from '../../api/client'
import CouponForm from '../../components/admin/CouponForm.vue'
import { useAdminCouponsStore } from '../../stores/adminCoupons'

const route = useRoute()
const router = useRouter()
const store = useAdminCouponsStore()
const submitting = ref(false)
const errorMessage = ref('')
const couponId = computed(() => Number(route.params.id))
const coupon = computed(() => store.coupons.find((item) => item.id === couponId.value))

async function handleSubmit(payload: CreateCouponPayload) {
  if (!coupon.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    const { code: _code, ...update } = payload
    await store.updateCoupon(coupon.value.id, update)
    router.push({ name: 'admin-coupons', query: { saved: 'updated' } })
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '更新優惠券失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <template v-if="coupon">
      <div class="mb-8 border-b border-[#171913] pb-7">
        <RouterLink to="/admin/coupons" class="font-mono text-[10px] uppercase tracking-[.16em] text-[#6f7268] hover:text-[#171913]">← Back to coupons</RouterLink>
        <p class="admin-page-kicker mt-6">Edit / {{ coupon.code }}</p>
        <h1 class="mt-2 font-serif text-4xl italic tracking-[-.03em] sm:text-6xl">編輯優惠券</h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-[#65685f]">可調整折扣條件、總使用額度與啟用狀態；代碼及已使用次數依 API 契約保持唯讀。</p>
      </div>
      <CouponForm mode="edit" :initial="coupon" :submitting="submitting" :server-error="errorMessage" @submit="handleSubmit" />
    </template>

    <div v-else-if="store.loaded" class="mx-auto mt-20 max-w-lg border border-[#171913] bg-[#fffdf8] p-8 text-center shadow-[8px_8px_0_#171913]">
      <span class="font-serif text-6xl italic text-[#b1b3a9]">404</span>
      <h1 class="mt-3 text-xl font-semibold">找不到這張優惠券</h1>
      <p class="mt-3 text-sm text-[#74776d]">優惠券可能不存在，或網址中的識別碼不正確。</p>
      <RouterLink to="/admin/coupons" class="admin-primary-button mt-6">返回優惠券列表</RouterLink>
    </div>
  </div>
</template>
