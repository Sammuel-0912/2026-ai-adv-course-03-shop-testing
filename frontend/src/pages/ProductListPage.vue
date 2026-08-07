<script setup lang="ts">
// 商品列表頁：載入商品卡片，可加入購物車（nav 數量即時更新）
import { onMounted, ref } from 'vue'
import { ApiError, fetchProducts, type Product } from '../api/client'
import { useCartStore } from '../stores/cart'

const cart = useCartStore()
const products = ref<Product[]>([])
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    products.value = await fetchProducts()
  } catch (err) {
    errorMessage.value =
      err instanceof ApiError ? err.message : '載入商品失敗，請稍後再試'
  } finally {
    loading.value = false
  }
})

/** 加入購物車 */
function addToCart(product: Product) {
  cart.add({ productId: product.id, name: product.name, price: product.price })
}
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-bold">全部商品</h1>

    <p v-if="loading" class="text-gray-500">商品載入中…</p>
    <p
      v-else-if="errorMessage"
      data-testid="products-error"
      class="text-red-600"
    >
      {{ errorMessage }}
    </p>
    <p v-else-if="products.length === 0" class="text-gray-500">
      目前沒有商品。
    </p>

    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="product in products"
        :key="product.id"
        class="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
      >
        <h2 class="text-lg font-semibold">{{ product.name }}</h2>
        <p class="mt-1 flex-1 text-sm text-gray-500">
          {{ product.description }}
        </p>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-lg font-bold text-rose-600"
            >NT$ {{ product.price }}</span
          >
          <span class="text-xs text-gray-400">庫存 {{ product.stock }}</span>
        </div>
        <button
          type="button"
          :data-testid="`add-to-cart-${product.id}`"
          :disabled="product.stock <= 0"
          class="mt-4 w-full rounded-lg bg-rose-600 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          @click="addToCart(product)"
        >
          {{ product.stock > 0 ? '加入購物車' : '已售完' }}
        </button>
      </article>
    </div>
  </div>
</template>
