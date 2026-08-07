<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, type CreateCouponPayload } from '../../api/client'
import CouponForm from '../../components/admin/CouponForm.vue'
import { useAdminCouponsStore } from '../../stores/adminCoupons'

const router = useRouter()
const store = useAdminCouponsStore()
const submitting = ref(false)
const errorMessage = ref('')

async function handleSubmit(payload: CreateCouponPayload) {
  submitting.value = true
  errorMessage.value = ''
  try {
    await store.createCoupon(payload)
    await router.push({
      name: 'admin-coupons',
      query: { saved: 'created' },
    })
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '建立優惠券失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <div class="mb-8 border-b border-[#171913] pb-7">
      <RouterLink
        to="/admin/coupons"
        class="font-mono text-[10px] tracking-[.16em] text-[#6f7268] uppercase hover:text-[#171913]"
        >← Back to coupons</RouterLink
      >
      <p class="admin-page-kicker mt-6">Create / New coupon</p>
      <h1 class="mt-2 font-serif text-4xl tracking-[-.03em] italic sm:text-6xl">
        建立優惠券
      </h1>
      <p class="mt-4 max-w-2xl text-sm leading-7 text-[#65685f]">
        設定消費門檻、折扣規則與總使用額度。代碼建立後不可修改，請在送出前再次確認。
      </p>
    </div>
    <CouponForm
      mode="create"
      :submitting="submitting"
      :server-error="errorMessage"
      @submit="handleSubmit"
    />
  </div>
</template>
