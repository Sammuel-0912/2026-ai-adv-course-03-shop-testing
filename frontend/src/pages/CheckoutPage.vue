<script setup lang="ts">
// 結帳頁：顯示後端 preview 金額，確認付款後建立訂單並導向綠界付款
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ApiError,
  checkoutOrder,
  createOrder,
  previewCoupon,
  type PreviewResult,
} from '../api/client'
import { useCartStore } from '../stores/cart'

const router = useRouter()
const cart = useCartStore()

const amounts = ref<PreviewResult | null>(null)
const errorMessage = ref('')
const submitting = ref(false)

onMounted(async () => {
  // 空購物車直接回購物車頁
  if (cart.items.length === 0) {
    await router.replace('/cart')
    return
  }
  try {
    amounts.value = await previewCoupon({
      items: cart.itemsPayload,
      code: cart.couponCode || undefined,
    })
  } catch (err) {
    errorMessage.value =
      err instanceof ApiError ? err.message : '金額試算失敗，請稍後再試'
  }
})

/**
 * 確認付款：
 * 1. createOrder 建立訂單（後端 transaction 扣庫存）
 * 2. checkoutOrder 取得綠界自動送出表單 {html}
 * 3. 清空購物車後以 document.write 整頁導向綠界
 */
async function handleCheckout() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const order = await createOrder({
      items: cart.itemsPayload,
      couponCode: cart.couponCode || undefined,
    })
    const { html } = await checkoutOrder(order.id)
    // 成功前先清空購物車，避免回上一頁時重複下單
    cart.clear()
    document.open()
    document.write(html)
    document.close()
  } catch (err) {
    // 例如庫存不足（INSUFFICIENT_STOCK）、優惠券不可用等
    errorMessage.value =
      err instanceof ApiError ? err.message : '結帳失敗，請稍後再試'
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <h1 class="mb-6 text-2xl font-bold">結帳</h1>

    <div class="space-y-4">
      <!-- 品項摘要 -->
      <section
        class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 class="mb-3 font-semibold">訂單品項</h2>
        <ul class="divide-y divide-gray-100 text-sm">
          <li
            v-for="item in cart.items"
            :key="item.productId"
            class="flex items-center justify-between py-2"
          >
            <span>
              {{ item.name }}
              <span class="text-gray-400">× {{ item.quantity }}</span>
            </span>
            <span class="text-gray-600"
              >NT$ {{ item.price * item.quantity }}</span
            >
          </li>
        </ul>
        <p v-if="cart.couponCode" class="mt-3 text-sm text-green-600">
          已套用優惠券：{{ cart.couponCode }}
        </p>
      </section>

      <!-- 金額摘要（後端 preview 回傳值） -->
      <section
        class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 class="mb-3 font-semibold">金額明細</h2>
        <div v-if="amounts" class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">小計</span>
            <span class="flex items-baseline gap-1">
              <span class="text-gray-400">NT$</span>
              <span data-testid="subtotal" class="font-medium">{{
                amounts.subtotal
              }}</span>
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">折扣</span>
            <span class="flex items-baseline gap-1 text-green-600">
              <span>−NT$</span>
              <span data-testid="discount" class="font-medium">{{
                amounts.discount
              }}</span>
            </span>
          </div>
          <div
            class="flex items-center justify-between border-t border-gray-100 pt-2 text-base"
          >
            <span class="font-semibold">應付總額</span>
            <span class="flex items-baseline gap-1 text-rose-600">
              <span>NT$</span>
              <span data-testid="total" class="text-lg font-bold">{{
                amounts.total
              }}</span>
            </span>
          </div>
        </div>
        <p v-else-if="!errorMessage" class="text-sm text-gray-400">
          金額試算中…
        </p>

        <p
          v-if="errorMessage"
          data-testid="checkout-error"
          class="mt-3 text-sm text-red-600"
        >
          {{ errorMessage }}
        </p>

        <button
          type="button"
          data-testid="checkout-button"
          :disabled="submitting || !amounts"
          class="mt-4 w-full rounded-lg bg-rose-600 py-2.5 font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleCheckout"
        >
          {{ submitting ? '處理中…' : '確認付款' }}
        </button>
        <p class="mt-2 text-center text-xs text-gray-400">
          將導向綠界金流完成付款
        </p>
      </section>
    </div>
  </div>
</template>
