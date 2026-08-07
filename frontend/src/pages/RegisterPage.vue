<script setup lang="ts">
// 註冊頁：成功即登入，並處理 ?redirect= 導回原頁
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const name = ref('')
const errorMessage = ref('')
const submitting = ref(false)

/** 送出註冊表單 */
async function handleSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await auth.register(email.value, password.value, name.value)
    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch (err) {
    errorMessage.value =
      err instanceof ApiError ? err.message : '註冊失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm">
    <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 class="mb-6 text-2xl font-bold">註冊新帳號</h1>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label
            class="mb-1 block text-sm font-medium text-gray-600"
            for="register-name"
            >姓名</label
          >
          <input
            id="register-name"
            v-model="name"
            data-testid="register-name"
            type="text"
            required
            autocomplete="name"
            placeholder="請輸入姓名"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 transition outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
          />
        </div>
        <div>
          <label
            class="mb-1 block text-sm font-medium text-gray-600"
            for="register-email"
            >Email</label
          >
          <input
            id="register-email"
            v-model="email"
            data-testid="register-email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 transition outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
          />
        </div>
        <div>
          <label
            class="mb-1 block text-sm font-medium text-gray-600"
            for="register-password"
            >密碼</label
          >
          <input
            id="register-password"
            v-model="password"
            data-testid="register-password"
            type="password"
            required
            autocomplete="new-password"
            placeholder="請設定密碼"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 transition outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
          />
        </div>
        <p
          v-if="errorMessage"
          data-testid="register-error"
          class="text-sm text-red-600"
        >
          {{ errorMessage }}
        </p>
        <button
          data-testid="register-submit"
          type="submit"
          :disabled="submitting"
          class="w-full rounded-lg bg-rose-600 py-2.5 font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? '註冊中…' : '註冊' }}
        </button>
      </form>
      <p class="mt-5 text-center text-sm text-gray-500">
        已經有帳號？
        <RouterLink
          :to="{ path: '/login', query: route.query }"
          class="font-medium text-rose-600 hover:underline"
        >
          前往登入
        </RouterLink>
      </p>
    </div>
  </div>
</template>
