<script setup lang="ts">
// 訂單詳情頁：pending 時每 3 秒輪詢付款狀態（最多 40 次），卸載時清除 timer
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, checkPayment, fetchOrder, type Order } from '../api/client'

const route = useRoute()
const orderId = String(route.params.id)

const order = ref<Order | null>(null)
const errorMessage = ref('')
const loading = ref(true)

const MAX_ATTEMPTS = 40
let timer: number | undefined
let attempts = 0

/** 狀態顯示文字 */
const statusLabel = computed(() => {
  switch (order.value?.status) {
    case 'pending':
      return '待付款'
    case 'paid':
      return '已付款'
    default:
      return order.value?.status ?? ''
  }
})

/** 停止輪詢 */
function stopPolling() {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

/** pending 時每 3 秒查詢付款狀態，成功轉 paid 或達 40 次即停 */
function startPolling() {
  stopPolling()
  attempts = 0
  timer = window.setInterval(async () => {
    attempts += 1
    if (attempts > MAX_ATTEMPTS) {
      stopPolling()
      return
    }
    try {
      const result = await checkPayment(orderId)
      if (result && result.status) {
        order.value = order.value ? { ...order.value, ...result } : result
      }
      if (order.value?.status === 'paid') {
        stopPolling()
      }
    } catch {
      // 查詢失敗時略過，等待下一次輪詢
    }
  }, 3000)
}

onMounted(async () => {
  try {
    order.value = await fetchOrder(orderId)
    if (order.value.status === 'pending') {
      startPolling()
    }
  } catch (err) {
    errorMessage.value = err instanceof ApiError ? err.message : '載入訂單失敗，請稍後再試'
  } finally {
    loading.value = false
  }
})

onUnmounted(stopPolling)
</script>

<template>
  <div class="mx-auto max-w-lg">
    <h1 class="mb-6 text-2xl font-bold">訂單詳情</h1>

    <p v-if="loading" class="text-gray-500">訂單載入中…</p>
    <p v-else-if="errorMessage" data-testid="order-error" class="text-red-600">
      {{ errorMessage }}
    </p>

    <div v-else-if="order" class="space-y-4">
      <section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">訂單編號</p>
            <p class="font-mono text-lg font-semibold">#{{ order.id }}</p>
          </div>
          <span
            data-testid="order-status"
            class="rounded-full px-3 py-1 text-sm font-medium"
            :class="order.status === 'paid'
              ? 'bg-green-100 text-green-700'
              : order.status === 'pending'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'"
          >{{ statusLabel }}</span>
        </div>
        <p v-if="order.status === 'pending'" class="mt-3 text-xs text-gray-400">
          正在確認付款結果，完成付款後狀態會自動更新…
        </p>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 class="mb-3 font-semibold">訂單品項</h2>
        <ul class="divide-y divide-gray-100 text-sm">
          <li
            v-for="item in order.items ?? []"
            :key="item.productId"
            class="flex items-center justify-between py-2"
          >
            <span>
              {{ item.name ?? `商品 #${item.productId}` }}
              <span class="text-gray-400">× {{ item.quantity }}</span>
            </span>
            <span class="text-gray-600">NT$ {{ item.unitPrice * item.quantity }}</span>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 class="mb-3 font-semibold">金額明細</h2>
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">小計</span>
            <span class="text-gray-700">NT$ {{ order.subtotal }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">折扣</span>
            <span class="text-green-600">−NT$ {{ order.discount }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">運費</span>
            <span data-testid="order-shipping-fee" class="text-gray-700">NT$ {{ order.shippingFee ?? 0 }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-gray-100 pt-2 text-base">
            <span class="font-semibold">總計</span>
            <span class="text-lg font-bold text-rose-600">NT$ {{ order.total }}</span>
          </div>
        </div>
        <p v-if="order.couponCode" class="mt-3 text-sm text-green-600">
          已使用優惠券：{{ order.couponCode }}
        </p>
      </section>

      <RouterLink to="/" class="inline-block text-sm text-rose-600 hover:underline">
        ← 繼續購物
      </RouterLink>
    </div>
  </div>
</template>
