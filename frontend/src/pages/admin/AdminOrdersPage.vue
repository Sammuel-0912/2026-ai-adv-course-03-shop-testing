<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ApiError,
  fetchAdminOrders,
  type Order,
  type OrderStatus,
} from '../../api/client'

type Filter = 'all' | OrderStatus

const orders = ref<Order[]>([])
const loading = ref(true)
const errorMessage = ref('')
const query = ref('')
const filter = ref<Filter>('all')

const filteredOrders = computed(() => {
  const keyword = query.value.trim()
  return orders.value.filter((order) => {
    const matchesQuery =
      keyword === '' ||
      String(order.id).includes(keyword) ||
      String(order.userId).includes(keyword)
    return (
      matchesQuery && (filter.value === 'all' || order.status === filter.value)
    )
  })
})

function statusLabel(status: OrderStatus) {
  if (status === 'paid') return '已付款'
  if (status === 'failed') return '付款失敗'
  return '待付款'
}

function formatDate(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

async function loadOrders() {
  loading.value = true
  errorMessage.value = ''
  try {
    orders.value = await fetchAdminOrders()
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '無法載入訂單資料'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <div
      class="flex flex-col justify-between gap-6 border-b border-[#171913] pb-8 md:flex-row md:items-end"
    >
      <div>
        <p class="admin-page-kicker">Orders / Operations</p>
        <h1
          class="mt-3 font-serif text-[clamp(2.5rem,6vw,5.6rem)] leading-[.9] tracking-[-.05em] italic"
        >
          訂單管理
        </h1>
      </div>
      <button
        type="button"
        class="admin-secondary-button"
        :disabled="loading"
        @click="loadOrders"
      >
        {{ loading ? '載入中…' : '重新整理' }}
      </button>
    </div>

    <div
      class="mt-8 flex flex-col gap-3 border border-[#171913] bg-[#fffdf8] p-4 md:flex-row"
    >
      <label class="flex-1">
        <span class="sr-only">搜尋訂單</span>
        <input
          v-model="query"
          type="search"
          class="admin-field"
          placeholder="搜尋訂單編號或會員 ID…"
        />
      </label>
      <select
        v-model="filter"
        class="admin-field md:w-40"
        aria-label="訂單狀態"
      >
        <option value="all">全部狀態</option>
        <option value="pending">待付款</option>
        <option value="paid">已付款</option>
        <option value="failed">付款失敗</option>
      </select>
    </div>

    <p v-if="loading" class="mt-8 text-sm text-[#73766c]">訂單載入中…</p>
    <div
      v-else-if="errorMessage"
      class="mt-8 border border-[#8b3a2e] bg-[#fff6f2] p-5 text-sm text-[#8b3a2e]"
    >
      {{ errorMessage }}
    </div>
    <div
      v-else-if="filteredOrders.length"
      class="mt-3 overflow-x-auto border border-[#171913] bg-[#fffdf8]"
    >
      <table class="w-full min-w-[900px] border-collapse text-left">
        <thead
          class="border-b border-[#171913] bg-[#e8e4da] font-mono text-[10px] tracking-[.12em] uppercase"
        >
          <tr>
            <th class="px-5 py-4 font-medium">訂單</th>
            <th class="px-5 py-4 font-medium">會員</th>
            <th class="px-5 py-4 font-medium">狀態</th>
            <th class="px-5 py-4 font-medium">品項</th>
            <th class="px-5 py-4 font-medium">時間</th>
            <th class="px-5 py-4 text-right font-medium">總計</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="order in filteredOrders"
            :key="order.id"
            class="border-b border-[#171913]/15 last:border-b-0"
          >
            <td class="px-5 py-5 font-mono font-bold">#{{ order.id }}</td>
            <td class="px-5 py-5 text-sm">Member {{ order.userId }}</td>
            <td class="px-5 py-5">
              <span class="border border-[#171913] px-2 py-1 text-xs">{{
                statusLabel(order.status)
              }}</span>
            </td>
            <td class="px-5 py-5 text-sm text-[#62655c]">
              {{
                order.items
                  ?.map(
                    (item) =>
                      `${item.name ?? `#${item.productId}`} ×${item.quantity}`,
                  )
                  .join('、')
              }}
            </td>
            <td class="px-5 py-5 font-mono text-xs text-[#74776d]">
              {{ formatDate(order.createdAt) }}
            </td>
            <td class="px-5 py-5 text-right font-serif text-xl italic">
              NT$ {{ order.total.toLocaleString('zh-TW') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-else
      class="mt-8 border border-dashed border-[#171913]/35 p-8 text-sm text-[#6d7067]"
    >
      目前沒有符合條件的訂單。
    </p>
  </div>
</template>
