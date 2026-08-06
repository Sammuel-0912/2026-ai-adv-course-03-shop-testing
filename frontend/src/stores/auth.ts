// 會員驗證 store：token / user 持久化到 localStorage（key 前綴 shop_）
import { defineStore } from 'pinia'
import { login as apiLogin, register as apiRegister, type User } from '../api/client'

const TOKEN_KEY = 'shop_token'
const USER_KEY = 'shop_user'

/** 從 localStorage 還原使用者資料（壞資料時回傳 null） */
function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    user: loadUser(),
  }),
  getters: {
    isLoggedIn: (state) => state.token !== '',
  },
  actions: {
    /** 寫入 token 與 user 並持久化 */
    setAuth(token: string, user: User) {
      this.token = token
      this.user = user
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },
    /** 登入 */
    async login(email: string, password: string) {
      const { token, user } = await apiLogin({ email, password })
      this.setAuth(token, user)
    },
    /** 註冊（成功即視同登入） */
    async register(email: string, password: string, name: string) {
      const { token, user } = await apiRegister({ email, password, name })
      this.setAuth(token, user)
    },
    /** 登出：清除記憶體與 localStorage */
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})
