<script setup lang="ts">
// 購物車頁：品項調整、優惠券試算；金額一律顯示後端 preview 回傳值
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, previewCoupon, type PreviewResult } from '../api/client'
import { useCartStore } from '../stores/cart'

const router = useRouter()
const cart = useCartStore()

const couponInput = ref(cart.couponCode)
const couponError = ref('')
const amounts = ref<PreviewResult | null>(null)
const loading = ref(false)

/**
 * 向後端試算金額（無券時也呼叫以取得 subtotal）。
 * 若已套用的優惠券失效（如低消不足），顯示錯誤並改用無券試算。
 */
async function refreshPreview() {
  if (cart.items.length === 0) {
    amounts.value = null
    return
  }
  loading.value = true
  try {
    amounts.value = await previewCoupon({
      items: cart.itemsPayload,
      code: cart.couponCode || undefined,
    })
  } catch (err) {
    if (err instanceof ApiError && cart.couponCode) {
      // 已套用的券在目前金額下不可用：顯示原因並退回無券試算
      couponError.value = err.message
      cart.setCouponCode('')
      try {
        amounts.value = await previewCoupon({ items: cart.itemsPayload })
      } catch {
        amounts.value = null
      }
    } else {
      couponError.value = err instanceof ApiError ? err.message : '金額試算失敗，請稍後再試'
    }
  } finally {
    loading.value = false
  }
}

/** 套用優惠券：成功才寫入 store；失敗顯示錯誤並退回無券試算 */
async function applyCoupon() {
  couponError.value = ''
  const code = couponInput.value.trim()
  if (!code || cart.items.length === 0) return
  try {
    amounts.value = await previewCoupon({ items: cart.itemsPayload, code })
    cart.setCouponCode(code)
  } catch (err) {
    couponError.value = err instanceof ApiError ? err.message : '套用優惠券失敗，請稍後再試'
    if (cart.couponCode) cart.setCouponCode('')
    try {
      amounts.value = await previewCoupon({ items: cart.itemsPayload })
    } catch {
      // 保留原金額顯示
    }
  }
}

/** 移除已套用的優惠券 */
async function removeCoupon() {
  couponError.value = ''
  couponInput.value = ''
  cart.setCouponCode('')
  await refreshPreview()
}

/** 數量輸入框變更 */
function onQuantityInput(productId: number, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value) && value >= 1) {
    cart.setQuantity(productId, value)
  }
}

/** 前往結帳（未登入時由 router guard 導向登入頁） */
function goCheckout() {
  router.push('/checkout')
}

// 品項變動（數量調整、移除）時重新試算
watch(
  () => JSON.stringify(cart.itemsPayload),
  () => {
    refreshPreview()
  },
)

onMounted(refreshPreview)
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-bold">購物車</h1>

    <div v-if="cart.items.length === 0" class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p class="text-gray-500">購物車是空的，快去逛逛吧！</p>
      <RouterLink to="/" class="mt-4 inline-block rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700">
        前往商品列表
      </RouterLink>
    </div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- 品項列表 -->
      <section class="space-y-3 lg:col-span-2">
        <div
          v-for="item in cart.items"
          :key="item.productId"
          class="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ item.name }}</p>
            <p class="text-sm text-gray-500">單價 NT$ {{ item.price }}</p>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :data-testid="`decrease-${item.productId}`"
              class="h-8 w-8 rounded-lg border border-gray-300 text-gray-600 transition hover:border-rose-400 hover:text-rose-600"
              @click="cart.setQuantity(item.productId, item.quantity - 1)"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              :value="item.quantity"
              :data-testid="`quantity-${item.productId}`"
              class="h-8 w-14 rounded-lg border border-gray-300 text-center text-sm"
              @change="onQuantityInput(item.productId, $event)"
            />
            <button
              type="button"
              :data-testid="`increase-${item.productId}`"
              class="h-8 w-8 rounded-lg border border-gray-300 text-gray-600 transition hover:border-rose-400 hover:text-rose-600"
              @click="cart.setQuantity(item.productId, item.quantity + 1)"
            >
              ＋
            </button>
          </div>
          <button
            type="button"
            :data-testid="`remove-${item.productId}`"
            class="text-sm text-gray-400 transition hover:text-red-600"
            @click="cart.remove(item.productId)"
          >
            移除
          </button>
        </div>
      </section>

      <!-- 優惠券與金額摘要 -->
      <aside class="space-y-4">
        <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 class="mb-3 font-semibold">優惠券</h2>
          <div class="flex gap-2">
            <input
              v-model="couponInput"
              data-testid="coupon-input"
              type="text"
              placeholder="輸入優惠券代碼"
              class="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
            />
            <button
              type="button"
              data-testid="apply-coupon"
              class="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
              @click="applyCoupon"
            >
              套用
            </button>
          </div>
          <p v-if="couponError" data-testid="coupon-error" class="mt-2 text-sm text-red-600">
            {{ couponError }}
          </p>
          <p v-else-if="cart.couponCode" data-testid="coupon-applied" class="mt-2 flex items-center gap-2 text-sm text-green-600">
            已套用優惠券：{{ cart.couponCode }}
            <button type="button" data-testid="remove-coupon" class="text-xs text-gray-400 underline hover:text-red-600" @click="removeCoupon">
              取消
            </button>
          </p>
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 class="mb-3 font-semibold">金額明細</h2>
          <div v-if="amounts" class="space-y-2 text-sm" :class="{ 'opacity-60': loading }">
            <div class="flex items-center justify-between">
              <span class="text-gray-500">小計</span>
              <span class="flex items-baseline gap-1">
                <span class="text-gray-400">NT$</span>
                <span data-testid="subtotal" class="font-medium">{{ amounts.subtotal }}</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500">折扣</span>
              <span class="flex items-baseline gap-1 text-green-600">
                <span>−NT$</span>
                <span data-testid="discount" class="font-medium">{{ amounts.discount }}</span>
              </span>
            </div>
            <div class="flex items-center justify-between border-t border-gray-100 pt-2 text-base">
              <span class="font-semibold">總計</span>
              <span class="flex items-baseline gap-1 text-rose-600">
                <span>NT$</span>
                <span data-testid="total" class="text-lg font-bold">{{ amounts.total }}</span>
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">金額試算中…</p>
          <button
            type="button"
            data-testid="go-checkout"
            :disabled="cart.items.length === 0"
            class="mt-4 w-full rounded-lg bg-rose-600 py-2.5 font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="goCheckout"
          >
            前往結帳
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
