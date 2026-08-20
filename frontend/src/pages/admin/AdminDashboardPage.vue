<script setup lang="ts">
import { computed } from 'vue'
import CouponStatusBadge from '../../components/admin/CouponStatusBadge.vue'
import { useAdminCouponsStore } from '../../stores/adminCoupons'

const store = useAdminCouponsStore()

const attentionCoupons = computed(() =>
  [...store.coupons]
    .filter((coupon) => coupon.isActive)
    .sort((a, b) => {
      const aRate = a.usageLimit === null ? 0 : a.usedCount / a.usageLimit
      const bRate = b.usageLimit === null ? 0 : b.usedCount / b.usageLimit
      return bRate - aRate || b.usedCount - a.usedCount
    })
    .slice(0, 4),
)

function usagePercent(used: number, limit: number | null) {
  if (limit === null) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <div
      class="flex flex-col justify-between gap-6 border-b border-[#171913] pb-8 md:flex-row md:items-end"
    >
      <div>
        <p class="admin-page-kicker">Control room / Overview</p>
        <h1
          class="mt-3 font-serif text-[clamp(2.5rem,6vw,5.6rem)] leading-[0.9] tracking-[-0.05em] italic"
        >
          營運總覽
        </h1>
      </div>
      <p class="max-w-sm text-sm leading-7 text-[#5d6057]">
        先讓每一張折扣券保持可控。數據直接來自後端 API，不在前端推測訂單營收。
      </p>
    </div>

    <section
      class="grid border-b border-l border-[#171913] sm:grid-cols-2 xl:grid-cols-4"
      aria-label="優惠券摘要"
    >
      <article class="dashboard-stat">
        <span class="dashboard-stat__index">01 / LIVE</span>
        <strong>{{ store.activeCount.toString().padStart(2, '0') }}</strong>
        <p>啟用中的優惠券</p>
      </article>
      <article class="dashboard-stat dashboard-stat--acid">
        <span class="dashboard-stat__index">02 / CLAIMED</span>
        <strong>{{ store.totalUsed.toLocaleString('zh-TW') }}</strong>
        <p>累計使用次數</p>
      </article>
      <article class="dashboard-stat">
        <span class="dashboard-stat__index">03 / LIMIT</span>
        <strong>{{ store.exhaustedCount.toString().padStart(2, '0') }}</strong>
        <p>已達使用上限</p>
      </article>
      <article class="dashboard-stat">
        <span class="dashboard-stat__index">04 / ARCHIVE</span>
        <strong>{{
          store.readOnly ? '—' : store.inactiveCount.toString().padStart(2, '0')
        }}</strong>
        <p>{{ store.readOnly ? '停用券資料未公開' : '已停用優惠券' }}</p>
      </article>
    </section>

    <section
      class="grid gap-8 py-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)] xl:gap-12"
    >
      <div>
        <div class="mb-5 flex items-end justify-between">
          <div>
            <p class="admin-page-kicker">Usage watch</p>
            <h2 class="mt-2 font-serif text-3xl italic">使用額度觀測</h2>
          </div>
          <RouterLink
            to="/admin/coupons"
            class="text-xs font-semibold underline decoration-[#a4c834] decoration-2 underline-offset-4"
            >查看全部</RouterLink
          >
        </div>

        <div
          v-if="attentionCoupons.length"
          class="border border-[#171913] bg-[#fffdf8]"
        >
          <article
            v-for="(coupon, index) in attentionCoupons"
            :key="coupon.id"
            class="grid gap-4 border-b border-[#171913]/20 p-5 last:border-b-0 sm:grid-cols-[2rem_minmax(130px,1fr)_minmax(160px,1.4fr)_auto] sm:items-center"
          >
            <span class="font-mono text-[10px] text-[#8a8d82]">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div>
              <RouterLink
                v-if="!store.readOnly"
                :to="`/admin/coupons/${coupon.id}/edit`"
                class="font-mono text-sm font-bold tracking-wide hover:underline"
                >{{ coupon.code }}</RouterLink
              >
              <code v-else class="font-mono text-sm font-bold tracking-wide">{{
                coupon.code
              }}</code>
              <p class="mt-1 text-xs text-[#777a70]">
                {{ coupon.percentOff }}% off · 上限 NT$
                {{ coupon.maxDiscount.toLocaleString('zh-TW') }}
              </p>
            </div>
            <div>
              <div
                class="mb-2 flex justify-between font-mono text-[10px] text-[#73766c]"
              >
                <span>{{ coupon.usedCount.toLocaleString('zh-TW') }} USED</span>
                <span>{{
                  coupon.usageLimit === null
                    ? '∞'
                    : `${usagePercent(coupon.usedCount, coupon.usageLimit)}%`
                }}</span>
              </div>
              <div class="h-2 border border-[#171913]/25 bg-[#e5e2d9]">
                <div
                  class="h-full bg-[#171913] transition-[width] duration-700"
                  :class="{ 'bg-[#a8cf32]': coupon.usageLimit === null }"
                  :style="{
                    width:
                      coupon.usageLimit === null
                        ? '100%'
                        : `${usagePercent(coupon.usedCount, coupon.usageLimit)}%`,
                  }"
                />
              </div>
            </div>
            <CouponStatusBadge :coupon="coupon" />
          </article>
        </div>
        <div
          v-else
          class="border border-dashed border-[#171913]/35 p-8 text-sm text-[#6d7067]"
        >
          目前沒有啟用中的優惠券。
        </div>
      </div>

      <aside>
        <div class="mb-5">
          <p class="admin-page-kicker">System map</p>
          <h2 class="mt-2 font-serif text-3xl italic">後台 API 版圖</h2>
        </div>
        <div
          class="border border-[#171913] bg-[#171913] p-5 text-[#f3f0e8] shadow-[8px_8px_0_#d9ff57]"
        >
          <div class="system-row system-row--ready">
            <span>優惠券</span><span>GET · POST · PATCH</span
            ><strong>READY</strong>
          </div>
          <div class="system-row">
            <span>商品</span><span>GET LIST ONLY</span><strong>WAIT</strong>
          </div>
          <div class="system-row system-row--ready">
            <span>訂單</span><span>GET LIST · GET BY ID</span
            ><strong>READY</strong>
          </div>
          <div class="system-row">
            <span>會員</span><span>NO ADMIN API</span><strong>WAIT</strong>
          </div>
          <p
            class="mt-5 border-t border-white/15 pt-4 text-xs leading-6 text-white/45"
          >
            選單已預留擴充位置；待 OpenAPI
            增加管理端契約後即可接上，不先製造假資料或無效按鈕。
          </p>
        </div>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.dashboard-stat {
  min-height: 10.5rem;
  border-top: 1px solid #171913;
  border-right: 1px solid #171913;
  padding: 1.4rem;
  background: rgb(255 253 248 / 0.72);
}

.dashboard-stat--acid {
  background: #d9ff57;
}
.dashboard-stat__index {
  display: block;
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.13em;
  color: #707369;
}
.dashboard-stat strong {
  display: block;
  margin-top: 1.35rem;
  font-family: Georgia, serif;
  font-size: 3.25rem;
  font-style: italic;
  font-weight: 400;
  line-height: 1;
}
.dashboard-stat p {
  margin-top: 0.8rem;
  font-size: 0.75rem;
  color: #55584f;
}

.system-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem 1rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.12);
  padding: 1rem 0;
}
.system-row > span:first-child {
  font-size: 0.85rem;
  font-weight: 700;
}
.system-row > span:nth-child(2) {
  grid-row: 2;
  font-family: ui-monospace, monospace;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  color: rgb(255 255 255 / 0.38);
}
.system-row strong {
  grid-row: 1 / 3;
  grid-column: 2;
  align-self: center;
  font-family: ui-monospace, monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: #777b70;
}
.system-row--ready strong {
  color: #d9ff57;
}
</style>
