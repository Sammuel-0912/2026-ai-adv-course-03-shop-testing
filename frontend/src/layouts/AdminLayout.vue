<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminCouponsStore } from '../stores/adminCoupons'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const coupons = useAdminCouponsStore()
const mobileNavOpen = ref(false)

onMounted(() => {
  coupons.loadCoupons().catch(() => undefined)
})

function handleLogout() {
  auth.logout()
  void router.push('/login')
}

function retry() {
  coupons.loadCoupons(true).catch(() => undefined)
}
</script>

<template>
  <div class="admin-shell min-h-screen bg-[#f3f0e8] text-[#171913]">
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[272px] -translate-x-full flex-col border-r border-[#171913] bg-[#171913] text-[#f3f0e8] transition-transform duration-300 lg:translate-x-0"
      :class="{ 'translate-x-0': mobileNavOpen }"
    >
      <div class="border-b border-white/15 px-6 py-7">
        <RouterLink
          to="/admin"
          class="group block"
          @click="mobileNavOpen = false"
        >
          <span
            class="block font-mono text-[10px] tracking-[0.28em] text-[#d9ff57] uppercase"
            >Bloom Ops / 01</span
          >
          <span class="mt-2 block font-serif text-2xl tracking-tight italic"
            >花漾營運室</span
          >
        </RouterLink>
      </div>

      <nav class="flex-1 space-y-2 px-4 py-6" aria-label="後台主選單">
        <RouterLink
          to="/admin"
          exact-active-class="admin-nav-active"
          class="admin-nav-link"
          @click="mobileNavOpen = false"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"
            />
          </svg>
          <span>營運總覽</span>
          <span class="ml-auto font-mono text-[10px] opacity-50">01</span>
        </RouterLink>
        <RouterLink
          to="/admin/coupons"
          active-class="admin-nav-active"
          class="admin-nav-link"
          @click="mobileNavOpen = false"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M20 12a2 2 0 0 0 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 0 0-4V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 0-2 2Zm-6-5h-4v2h4V7Zm0 4h-4v2h4v-2Zm0 4h-4v2h4v-2Z"
            />
          </svg>
          <span>優惠券管理</span>
          <span class="ml-auto font-mono text-[10px] opacity-50">02</span>
        </RouterLink>

        <div
          class="px-3 pt-8 pb-2 font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase"
        >
          Awaiting API
        </div>
        <div class="admin-nav-disabled">
          <span>商品管理</span><span>規劃中</span>
        </div>
        <RouterLink
          to="/admin/orders"
          active-class="admin-nav-active"
          class="admin-nav-link"
          @click="mobileNavOpen = false"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v16l-4-2-5 2-5-2-4 2V5a2 2 0 0 1 2-2Zm2 5v2h10V8H7Zm0 4v2h7v-2H7Z"
            />
          </svg>
          <span>訂單管理</span>
          <span class="ml-auto font-mono text-[10px] opacity-50">03</span>
        </RouterLink>
        <div class="admin-nav-disabled">
          <span>會員管理</span><span>規劃中</span>
        </div>
      </nav>

      <div class="border-t border-white/15 p-4">
        <div class="mb-3 flex items-center gap-3 px-3">
          <span
            class="grid size-9 place-items-center rounded-full bg-[#d9ff57] font-serif text-lg text-[#171913] italic"
          >
            {{ auth.user?.name?.slice(0, 1) || 'A' }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">{{ auth.user?.name }}</p>
            <p class="truncate text-[11px] text-white/45">
              {{ auth.user?.email }}
            </p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <RouterLink to="/" class="admin-side-action">前往商店</RouterLink>
          <button type="button" class="admin-side-action" @click="handleLogout">
            登出
          </button>
        </div>
      </div>
    </aside>

    <button
      v-if="mobileNavOpen"
      type="button"
      aria-label="關閉選單"
      class="fixed inset-0 z-30 bg-black/45 lg:hidden"
      @click="mobileNavOpen = false"
    />

    <div class="lg:pl-[272px]">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#171913]/20 bg-[#f3f0e8]/90 px-4 backdrop-blur-md sm:px-7 lg:px-10"
      >
        <button
          type="button"
          class="grid size-10 place-items-center border border-[#171913] lg:hidden"
          aria-label="開啟選單"
          @click="mobileNavOpen = true"
        >
          <span class="text-xl leading-none">≡</span>
        </button>
        <div
          class="hidden items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[#5f6258] uppercase sm:flex"
        >
          <span
            class="size-2 rounded-full bg-[#7dbd3b] shadow-[0_0_0_4px_rgba(125,189,59,.15)]"
          />
          Operations online
        </div>
        <div class="ml-auto flex items-center gap-3">
          <span
            class="hidden font-mono text-[10px] tracking-[0.16em] text-[#74776c] uppercase sm:inline"
            >API-backed console</span
          >
          <RouterLink
            v-if="route.name !== 'admin-orders'"
            to="/admin/coupons/new"
            class="admin-primary-button py-2.5 text-xs"
          >
            <span aria-hidden="true">＋</span> 新增優惠券
          </RouterLink>
        </div>
      </header>

      <main class="min-h-[calc(100vh-4rem)]">
        <div
          v-if="coupons.loading && !coupons.loaded"
          class="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14"
        >
          <div class="mb-10 h-4 w-36 animate-pulse bg-[#171913]/10" />
          <div
            class="mb-4 h-12 w-72 max-w-full animate-pulse bg-[#171913]/10"
          />
          <div class="grid gap-4 pt-8 sm:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="item in 4"
              :key="item"
              class="h-40 animate-pulse border border-[#171913]/15 bg-white/45"
            />
          </div>
        </div>

        <section
          v-else-if="coupons.errorCode"
          class="grid min-h-[calc(100vh-4rem)] place-items-center px-5 py-12"
        >
          <div
            class="w-full max-w-xl border border-[#171913] bg-[#fffdf8] p-7 shadow-[10px_10px_0_#171913] sm:p-10"
          >
            <span
              class="font-mono text-[10px] tracking-[0.2em] text-[#8b3a2e] uppercase"
              >Access checkpoint</span
            >
            <h1 class="mt-4 font-serif text-4xl italic sm:text-5xl">
              {{
                coupons.errorCode === 'FORBIDDEN'
                  ? '這裡只對管理員開放。'
                  : '後台暫時無法連線。'
              }}
            </h1>
            <p class="mt-5 max-w-md text-sm leading-7 text-[#606359]">
              {{
                coupons.errorCode === 'FORBIDDEN'
                  ? '目前登入的帳號沒有管理員權限。後端登入回應未包含角色欄位，因此我們以受保護的優惠券 API 作為最終權限檢查。'
                  : coupons.errorMessage
              }}
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <RouterLink to="/" class="admin-secondary-button"
                >返回商店</RouterLink
              >
              <button
                v-if="coupons.errorCode !== 'FORBIDDEN'"
                type="button"
                class="admin-primary-button"
                @click="retry"
              >
                重新連線
              </button>
              <button
                v-else
                type="button"
                class="admin-primary-button"
                @click="handleLogout"
              >
                切換帳號
              </button>
            </div>
          </div>
        </section>

        <RouterView v-else />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  font-family: 'Avenir Next', 'Noto Sans TC', sans-serif;
  background-image:
    linear-gradient(rgba(23, 25, 19, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 25, 19, 0.035) 1px, transparent 1px);
  background-size: 36px 36px;
}

.admin-nav-link {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid transparent;
  padding: 0.85rem 0.9rem;
  color: rgb(243 240 232 / 0.65);
  font-size: 0.875rem;
  transition: 180ms ease;
}

.admin-nav-link:hover {
  border-color: rgb(255 255 255 / 0.15);
  color: #fff;
}

.admin-nav-link svg {
  width: 1.1rem;
  fill: currentColor;
}

.admin-nav-active {
  border-color: #d9ff57;
  background: #d9ff57;
  color: #171913;
  box-shadow: 4px 4px 0 rgb(217 255 87 / 0.18);
}

.admin-nav-active:hover {
  border-color: #d9ff57;
  color: #171913;
}

.admin-nav-disabled {
  display: flex;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  color: rgb(255 255 255 / 0.28);
  font-size: 0.75rem;
}

.admin-nav-disabled span:last-child {
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
}

.admin-side-action {
  border: 1px solid rgb(255 255 255 / 0.18);
  padding: 0.6rem;
  text-align: center;
  font-size: 0.7rem;
  color: rgb(255 255 255 / 0.65);
  transition: 160ms ease;
}

.admin-side-action:hover {
  border-color: #d9ff57;
  color: #d9ff57;
}
</style>
