<script setup lang="ts">
import { computed } from 'vue'
import type { Coupon } from '../../api/client'

const props = defineProps<{ coupon: Coupon }>()

const status = computed(() => {
  if (!props.coupon.isActive) return { label: '已停用', tone: 'inactive' }
  if (props.coupon.usageLimit !== null && props.coupon.usedCount >= props.coupon.usageLimit) {
    return { label: '已用罄', tone: 'exhausted' }
  }
  return { label: '進行中', tone: 'active' }
})
</script>

<template>
  <span class="coupon-status" :class="`coupon-status--${status.tone}`">
    <span class="size-1.5 rounded-full bg-current" />
    {{ status.label }}
  </span>
</template>

<style scoped>
.coupon-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid currentColor;
  padding: 0.3rem 0.55rem;
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.coupon-status--active { color: #486d25; background: #ecf7d8; }
.coupon-status--inactive { color: #77796f; background: #efeee9; }
.coupon-status--exhausted { color: #934436; background: #f8e9e4; }
</style>
