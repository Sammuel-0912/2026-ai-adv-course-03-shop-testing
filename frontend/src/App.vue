<script setup lang="ts">
// 全站外框：頂部導覽列 + 路由出口
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useCartStore } from './stores/cart'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const cart = useCartStore()
const isAdminRoute = computed(() => route.matched.some((record) => record.meta.admin))

/** 登出後回到商品列表 */
function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<template>
  <RouterView v-if="isAdminRoute" />

  <div v-else class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <RouterLink to="/" class="text-xl font-bold text-rose-600">花漾商店</RouterLink>
        <div class="flex items-center gap-5 text-sm">
          <RouterLink to="/" class="text-gray-600 transition hover:text-rose-600">商品</RouterLink>
          <RouterLink
            to="/cart"
            data-testid="nav-cart"
            class="relative inline-flex items-center gap-1 text-gray-600 transition hover:text-rose-600"
          >
            購物車
            <span
              v-if="cart.count > 0"
              data-testid="cart-count"
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white"
            >{{ cart.count }}</span>
          </RouterLink>
          <template v-if="auth.isLoggedIn">
            <RouterLink
              to="/admin"
              class="hidden text-gray-600 transition hover:text-rose-600 sm:inline"
            >
              營運後台
            </RouterLink>
            <span class="hidden text-gray-500 sm:inline">{{ auth.user?.name }}，您好</span>
            <button
              type="button"
              data-testid="logout-button"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-600 transition hover:border-rose-400 hover:text-rose-600"
              @click="handleLogout"
            >
              登出
            </button>
          </template>
          <RouterLink
            v-else
            to="/login"
            class="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white transition hover:bg-rose-700"
          >
            登入
          </RouterLink>
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <RouterView />
    </main>

    <footer class="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
      花漾商店 — 測試教學課程範例
    </footer>
  </div>
</template>
