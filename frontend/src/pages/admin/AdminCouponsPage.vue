<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import CouponStatusBadge from '../../components/admin/CouponStatusBadge.vue'
import type { Coupon } from '../../api/client'
import { useAdminCouponsStore } from '../../stores/adminCoupons'

type Filter = 'all' | 'active' | 'inactive' | 'exhausted'

const route = useRoute()
const store = useAdminCouponsStore()
const query = ref('')
const filter = ref<Filter>('all')

const successMessage = computed(() => {
  if (route.query.saved === 'created') return '優惠券已建立並加入列表。'
  if (route.query.saved === 'updated') return '優惠券設定已更新。'
  return ''
})

const filteredCoupons = computed(() => {
  const keyword = query.value.trim().toUpperCase()
  return store.coupons.filter((coupon) => {
    const matchesSearch = keyword === '' || coupon.code.includes(keyword)
    const exhausted =
      coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit
    const matchesFilter =
      filter.value === 'all' ||
      (filter.value === 'active' && coupon.isActive && !exhausted) ||
      (filter.value === 'inactive' && !coupon.isActive) ||
      (filter.value === 'exhausted' && exhausted)
    return matchesSearch && matchesFilter
  })
})

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '進行中' },
  { value: 'exhausted', label: '已用罄' },
  { value: 'inactive', label: '已停用' },
]

function usageText(coupon: Coupon) {
  return coupon.usageLimit === null
    ? `${coupon.usedCount.toLocaleString('zh-TW')} / 不限`
    : `${coupon.usedCount.toLocaleString('zh-TW')} / ${coupon.usageLimit.toLocaleString('zh-TW')}`
}

function reload() {
  store.loadCoupons(true).catch(() => undefined)
}

function clearFilters() {
  query.value = ''
  filter.value = 'all'
}
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <div
      class="flex flex-col justify-between gap-6 border-b border-[#171913] pb-8 md:flex-row md:items-end"
    >
      <div>
        <p class="admin-page-kicker">Coupons / Inventory</p>
        <h1
          class="mt-3 font-serif text-[clamp(2.5rem,6vw,5.6rem)] leading-[.9] tracking-[-.05em] italic"
        >
          優惠券管理
        </h1>
      </div>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="admin-secondary-button"
          :disabled="store.loading"
          @click="reload"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': store.loading }"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path d="M20 11a8.1 8.1 0 1 0 .1 3M20 4v7h-7" />
          </svg>
          重新整理
        </button>
        <RouterLink to="/admin/coupons/new" class="admin-primary-button"
          >＋ 建立優惠券</RouterLink
        >
      </div>
    </div>

    <div
      v-if="successMessage"
      class="mt-6 flex items-center justify-between border border-[#5d7c2d] bg-[#eaf8cc] px-4 py-3 text-sm text-[#3f5b1c]"
      role="status"
    >
      <span>✓ {{ successMessage }}</span>
      <RouterLink
        to="/admin/coupons"
        replace
        class="font-mono text-xs underline"
        >關閉</RouterLink
      >
    </div>

    <section class="mt-8">
      <div
        class="flex flex-col gap-4 border border-[#171913] bg-[#fffdf8] p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <label class="relative block w-full max-w-xl">
          <span class="sr-only">搜尋優惠券代碼</span>
          <svg
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#7d8076]"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            v-model="query"
            type="search"
            placeholder="搜尋優惠券代碼…"
            class="admin-field py-2.5 pl-10 font-mono uppercase"
          />
        </label>

        <div
          class="flex max-w-full gap-1 overflow-x-auto"
          aria-label="優惠券狀態篩選"
        >
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="shrink-0 border border-transparent px-3 py-2 text-xs text-[#73766c] transition"
            :class="
              filter === option.value
                ? 'border-[#171913] bg-[#171913] text-white'
                : 'hover:border-[#171913]/25 hover:text-[#171913]'
            "
            @click="filter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div
        class="mt-3 flex items-center justify-between font-mono text-[10px] tracking-[.14em] text-[#777a70] uppercase"
      >
        <span>{{ filteredCoupons.length }} records</span>
        <span>All amounts in TWD</span>
      </div>

      <div v-if="filteredCoupons.length" class="mt-3 grid gap-3 md:hidden">
        <article
          v-for="coupon in filteredCoupons"
          :key="coupon.id"
          class="border border-[#171913] bg-[#fffdf8] p-5 shadow-[4px_4px_0_rgba(23,25,19,.12)]"
        >
          <div
            class="flex items-start justify-between gap-3 border-b border-[#171913]/20 pb-4"
          >
            <div>
              <code class="block text-sm font-bold tracking-[.06em]">{{
                coupon.code
              }}</code>
              <CouponStatusBadge :coupon="coupon" class="mt-2" />
            </div>
            <strong class="font-serif text-2xl font-normal italic"
              >{{ coupon.percentOff }}% off</strong
            >
          </div>
          <dl class="grid grid-cols-2 gap-x-5 gap-y-4 py-4 text-xs">
            <div>
              <dt
                class="font-mono text-[9px] tracking-[.1em] text-[#85887e] uppercase"
              >
                最低消費
              </dt>
              <dd class="mt-1 font-semibold">
                NT$ {{ coupon.minSpend.toLocaleString('zh-TW') }}
              </dd>
            </div>
            <div>
              <dt
                class="font-mono text-[9px] tracking-[.1em] text-[#85887e] uppercase"
              >
                折抵上限
              </dt>
              <dd class="mt-1 font-semibold">
                NT$ {{ coupon.maxDiscount.toLocaleString('zh-TW') }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt
                class="font-mono text-[9px] tracking-[.1em] text-[#85887e] uppercase"
              >
                使用額度
              </dt>
              <dd class="mt-1 font-semibold">{{ usageText(coupon) }}</dd>
            </div>
          </dl>
          <RouterLink
            :to="`/admin/coupons/${coupon.id}/edit`"
            class="admin-secondary-button w-full py-2.5"
            >編輯設定 <span aria-hidden="true">↗</span></RouterLink
          >
        </article>
      </div>

      <div
        v-if="filteredCoupons.length"
        class="mt-3 hidden overflow-x-auto border border-[#171913] bg-[#fffdf8] md:block"
      >
        <table class="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr
              class="border-b border-[#171913] bg-[#e8e4da] font-mono text-[10px] tracking-[.12em] text-[#666960] uppercase"
            >
              <th class="px-5 py-4 font-medium">代碼 / 狀態</th>
              <th class="px-5 py-4 font-medium">折扣內容</th>
              <th class="px-5 py-4 font-medium">消費門檻</th>
              <th class="px-5 py-4 font-medium">使用額度</th>
              <th class="px-5 py-4 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="coupon in filteredCoupons"
              :key="coupon.id"
              class="coupon-row border-b border-[#171913]/15 last:border-b-0"
            >
              <td class="px-5 py-5">
                <code
                  class="block text-sm font-bold tracking-[.06em] text-[#171913]"
                  >{{ coupon.code }}</code
                >
                <CouponStatusBadge :coupon="coupon" class="mt-2" />
              </td>
              <td class="px-5 py-5">
                <strong class="font-serif text-2xl font-normal italic"
                  >{{ coupon.percentOff }}% off</strong
                >
                <p class="mt-1 text-xs text-[#74776d]">
                  最高折抵 NT$ {{ coupon.maxDiscount.toLocaleString('zh-TW') }}
                </p>
              </td>
              <td class="px-5 py-5">
                <span class="text-sm"
                  >NT$ {{ coupon.minSpend.toLocaleString('zh-TW') }}</span
                >
                <p class="mt-1 text-xs text-[#8a8d83]">含門檻金額即可使用</p>
              </td>
              <td class="px-5 py-5">
                <span class="font-mono text-xs font-bold">{{
                  usageText(coupon)
                }}</span>
                <div
                  v-if="coupon.usageLimit !== null"
                  class="mt-2 h-1.5 w-32 border border-[#171913]/20 bg-[#e7e4dc]"
                >
                  <div
                    class="h-full bg-[#91b72e]"
                    :style="{
                      width: `${Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)}%`,
                    }"
                  />
                </div>
                <p v-else class="mt-1 text-xs text-[#8a8d83]">無使用次數限制</p>
              </td>
              <td class="px-5 py-5 text-right">
                <RouterLink
                  :to="`/admin/coupons/${coupon.id}/edit`"
                  class="inline-flex items-center gap-2 border-b border-[#171913] pb-1 text-xs font-semibold hover:text-[#62811f]"
                >
                  編輯設定 <span aria-hidden="true">↗</span>
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else
        class="mt-3 border border-dashed border-[#171913]/35 bg-[#fffdf8]/45 p-12 text-center"
      >
        <span class="font-serif text-5xl text-[#bec0b6] italic">0</span>
        <h2 class="mt-3 text-base font-semibold">找不到符合條件的優惠券</h2>
        <p class="mt-2 text-sm text-[#777a70]">
          試著清除搜尋文字，或切換其他狀態。
        </p>
        <button
          type="button"
          class="mt-5 text-xs font-semibold underline"
          @click="clearFilters"
        >
          清除篩選
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.coupon-row {
  transition: background 160ms ease;
}
.coupon-row:hover {
  background: #f4f8e8;
}
</style>
