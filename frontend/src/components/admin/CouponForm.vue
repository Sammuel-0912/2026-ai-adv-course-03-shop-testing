<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { Coupon, CreateCouponPayload } from '../../api/client'

const props = defineProps<{
  mode: 'create' | 'edit'
  initial?: Coupon
  submitting?: boolean
  serverError?: string
}>()

const emit = defineEmits<{
  submit: [payload: CreateCouponPayload]
}>()

const form = reactive({
  code: '',
  percentOff: 10,
  maxDiscount: 300,
  minSpend: 1000,
  usageLimit: 100,
  usageMode: 'limited',
  isActive: true,
})

const errors = ref<Record<string, string>>({})

watch(
  () => props.initial,
  (coupon) => {
    if (!coupon) return
    form.code = coupon.code
    form.percentOff = coupon.percentOff
    form.maxDiscount = coupon.maxDiscount
    form.minSpend = coupon.minSpend
    form.usageLimit = coupon.usageLimit ?? Math.max(coupon.usedCount, 1)
    form.usageMode = coupon.usageLimit === null ? 'unlimited' : 'limited'
    form.isActive = coupon.isActive
  },
  { immediate: true },
)

function normalizeCode() {
  form.code = form.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
}

function validate() {
  const nextErrors: Record<string, string> = {}
  const code = form.code.trim().toUpperCase()

  if (!code) nextErrors.code = '請輸入優惠券代碼'
  else if (code.length > 32 || !/^[A-Z0-9_-]+$/.test(code))
    nextErrors.code = '僅限 1–32 碼大寫英文、數字、底線或連字號'

  if (
    !Number.isInteger(form.percentOff) ||
    form.percentOff < 1 ||
    form.percentOff > 100
  ) {
    nextErrors.percentOff = '折扣百分比須為 1–100 的整數'
  }
  if (!Number.isInteger(form.maxDiscount) || form.maxDiscount < 0) {
    nextErrors.maxDiscount = '折抵上限須為 0 以上的整數'
  }
  if (!Number.isInteger(form.minSpend) || form.minSpend < 0) {
    nextErrors.minSpend = '最低消費須為 0 以上的整數'
  }
  if (
    form.usageMode === 'limited' &&
    (!Number.isInteger(form.usageLimit) || form.usageLimit < 1)
  ) {
    nextErrors.usageLimit = '使用上限須為 1 以上的整數'
  }

  errors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

function handleSubmit() {
  normalizeCode()
  if (!validate()) return
  emit('submit', {
    code: form.code,
    percentOff: form.percentOff,
    maxDiscount: form.maxDiscount,
    minSpend: form.minSpend,
    usageLimit: form.usageMode === 'unlimited' ? null : form.usageLimit,
    isActive: form.isActive,
  })
}
</script>

<template>
  <form
    class="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.65fr)]"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <div class="border border-[#171913] bg-[#fffdf8]">
      <div class="border-b border-[#171913] bg-[#e8e4da] px-5 py-4 sm:px-7">
        <p
          class="font-mono text-[10px] tracking-[.18em] text-[#666960] uppercase"
        >
          Coupon configuration
        </p>
        <h2 class="mt-1 font-serif text-2xl italic">基本折扣設定</h2>
      </div>

      <div class="space-y-8 p-5 sm:p-7">
        <div>
          <label class="admin-field-label" for="coupon-code">優惠券代碼</label>
          <div class="relative">
            <input
              id="coupon-code"
              v-model="form.code"
              data-testid="admin-coupon-code"
              type="text"
              maxlength="32"
              autocomplete="off"
              placeholder="SUMMER20"
              class="admin-field pr-28 font-mono tracking-[.08em] uppercase disabled:cursor-not-allowed disabled:bg-[#ece9e1] disabled:text-[#7d8076]"
              :disabled="mode === 'edit'"
              :aria-invalid="Boolean(errors.code)"
              @input="normalizeCode"
            />
            <span
              class="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[9px] tracking-[.12em] text-[#96988f] uppercase"
            >
              {{ mode === 'edit' ? 'Locked' : `${form.code.length} / 32` }}
            </span>
          </div>
          <p v-if="errors.code" class="mt-2 text-xs text-[#9a4032]">
            {{ errors.code }}
          </p>
          <p v-else class="mt-2 text-xs leading-5 text-[#81847a]">
            建立後無法修改；可使用大寫英文、數字、底線與連字號。
          </p>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="admin-field-label" for="percent-off"
              >折扣百分比</label
            >
            <div class="relative">
              <input
                id="percent-off"
                v-model.number="form.percentOff"
                data-testid="admin-percent-off"
                type="number"
                min="1"
                max="100"
                step="1"
                class="admin-field pr-11"
                :aria-invalid="Boolean(errors.percentOff)"
              />
              <span
                class="absolute top-1/2 right-4 -translate-y-1/2 font-serif text-xl text-[#777a70] italic"
                >%</span
              >
            </div>
            <p v-if="errors.percentOff" class="mt-2 text-xs text-[#9a4032]">
              {{ errors.percentOff }}
            </p>
          </div>
          <div>
            <label class="admin-field-label" for="max-discount">最高折抵</label>
            <div class="relative">
              <span
                class="absolute top-1/2 left-4 -translate-y-1/2 font-mono text-[10px] text-[#777a70]"
                >NT$</span
              >
              <input
                id="max-discount"
                v-model.number="form.maxDiscount"
                data-testid="admin-max-discount"
                type="number"
                min="0"
                step="1"
                class="admin-field pl-14"
                :aria-invalid="Boolean(errors.maxDiscount)"
              />
            </div>
            <p v-if="errors.maxDiscount" class="mt-2 text-xs text-[#9a4032]">
              {{ errors.maxDiscount }}
            </p>
          </div>
        </div>

        <div>
          <label class="admin-field-label" for="min-spend">最低消費門檻</label>
          <div class="relative">
            <span
              class="absolute top-1/2 left-4 -translate-y-1/2 font-mono text-[10px] text-[#777a70]"
              >NT$</span
            >
            <input
              id="min-spend"
              v-model.number="form.minSpend"
              data-testid="admin-min-spend"
              type="number"
              min="0"
              step="1"
              class="admin-field pl-14"
              :aria-invalid="Boolean(errors.minSpend)"
            />
          </div>
          <p v-if="errors.minSpend" class="mt-2 text-xs text-[#9a4032]">
            {{ errors.minSpend }}
          </p>
          <p v-else class="mt-2 text-xs text-[#81847a]">
            訂單小計等於此金額時即可使用。
          </p>
        </div>

        <fieldset>
          <legend class="admin-field-label">總使用次數</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              class="usage-option"
              :class="{
                'usage-option--selected': form.usageMode === 'limited',
              }"
            >
              <input
                v-model="form.usageMode"
                type="radio"
                value="limited"
                class="sr-only"
              />
              <span class="usage-option__mark">{{
                form.usageMode === 'limited' ? '●' : '○'
              }}</span>
              <span
                ><strong>限制次數</strong
                ><small>達上限後不再接受使用</small></span
              >
            </label>
            <label
              class="usage-option"
              :class="{
                'usage-option--selected': form.usageMode === 'unlimited',
              }"
            >
              <input
                v-model="form.usageMode"
                type="radio"
                value="unlimited"
                class="sr-only"
              />
              <span class="usage-option__mark">{{
                form.usageMode === 'unlimited' ? '●' : '○'
              }}</span>
              <span
                ><strong>不限次數</strong><small>API 將儲存為 null</small></span
              >
            </label>
          </div>
          <div v-if="form.usageMode === 'limited'" class="mt-4 max-w-sm">
            <label class="admin-field-label" for="usage-limit"
              >可使用次數</label
            >
            <input
              id="usage-limit"
              v-model.number="form.usageLimit"
              data-testid="admin-usage-limit"
              type="number"
              min="1"
              step="1"
              class="admin-field"
              :aria-invalid="Boolean(errors.usageLimit)"
            />
            <p v-if="errors.usageLimit" class="mt-2 text-xs text-[#9a4032]">
              {{ errors.usageLimit }}
            </p>
            <p
              v-if="mode === 'edit' && initial"
              class="mt-2 text-xs text-[#81847a]"
            >
              目前已使用
              {{ initial.usedCount.toLocaleString('zh-TW') }}
              次；已使用次數不可修改。
            </p>
          </div>
        </fieldset>

        <label
          class="flex cursor-pointer items-center justify-between gap-5 border border-[#171913]/30 bg-[#f4f1e9] p-4"
        >
          <span>
            <strong class="block text-sm">立即啟用</strong>
            <small class="mt-1 block text-xs leading-5 text-[#777a70]"
              >停用後不會刪除，歷史訂單仍保留優惠券資訊。</small
            >
          </span>
          <input
            v-model="form.isActive"
            data-testid="admin-coupon-active"
            type="checkbox"
            class="peer sr-only"
          />
          <span
            class="relative h-7 w-12 shrink-0 border border-[#171913] bg-[#bbbdb4] transition peer-checked:bg-[#a9d334] after:absolute after:top-1 after:left-1 after:size-[18px] after:bg-white after:transition peer-checked:after:translate-x-5"
            aria-hidden="true"
          />
        </label>
      </div>
    </div>

    <aside class="space-y-5 xl:sticky xl:top-24 xl:self-start">
      <section
        class="border border-[#171913] bg-[#d9ff57] p-6 shadow-[7px_7px_0_#171913]"
      >
        <p
          class="font-mono text-[10px] tracking-[.18em] text-[#555d2e] uppercase"
        >
          Terms preview
        </p>
        <div class="mt-7 border-y border-[#171913] py-5 text-center">
          <span class="font-serif text-6xl leading-none italic"
            >{{ form.percentOff || 0 }}%</span
          >
          <span class="ml-2 font-mono text-xs tracking-[.12em] uppercase"
            >off</span
          >
        </div>
        <dl class="mt-5 space-y-3 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-[#5d6342]">代碼</dt>
            <dd class="font-mono font-bold">{{ form.code || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-[#5d6342]">低消</dt>
            <dd>
              NT$ {{ Number(form.minSpend || 0).toLocaleString('zh-TW') }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-[#5d6342]">折抵上限</dt>
            <dd>
              NT$ {{ Number(form.maxDiscount || 0).toLocaleString('zh-TW') }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-[#5d6342]">使用額度</dt>
            <dd>
              {{
                form.usageMode === 'unlimited'
                  ? '不限'
                  : `${form.usageLimit || 0} 次`
              }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-[#5d6342]">狀態</dt>
            <dd>{{ form.isActive ? '啟用' : '停用' }}</dd>
          </div>
        </dl>
        <p
          class="mt-6 border-t border-[#171913]/25 pt-4 text-xs leading-6 text-[#5a603d]"
        >
          後端會以訂單小計計算百分比折扣、無條件捨去，再套用折抵上限；實際金額以後端結果為準。
        </p>
      </section>

      <p
        v-if="serverError"
        data-testid="admin-coupon-error"
        class="border border-[#983f32] bg-[#f7e4df] p-4 text-sm leading-6 text-[#86382d]"
        role="alert"
      >
        {{ serverError }}
      </p>

      <div class="grid grid-cols-2 gap-3">
        <RouterLink to="/admin/coupons" class="admin-secondary-button"
          >取消</RouterLink
        >
        <button
          data-testid="admin-coupon-submit"
          type="submit"
          class="admin-primary-button"
          :disabled="submitting"
        >
          {{
            submitting
              ? '儲存中…'
              : mode === 'create'
                ? '建立優惠券'
                : '儲存變更'
          }}
        </button>
      </div>
    </aside>
  </form>
</template>

<style scoped>
.usage-option {
  display: flex;
  cursor: pointer;
  gap: 0.75rem;
  border: 1px solid rgb(23 25 19 / 0.28);
  padding: 0.9rem;
  transition: 160ms ease;
}
.usage-option:hover {
  border-color: #171913;
}
.usage-option--selected {
  border-color: #171913;
  background: #eef9ca;
  box-shadow: 3px 3px 0 #171913;
}
.usage-option__mark {
  color: #668224;
}
.usage-option strong {
  display: block;
  font-size: 0.78rem;
}
.usage-option small {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.65rem;
  color: #7a7d73;
}
</style>
