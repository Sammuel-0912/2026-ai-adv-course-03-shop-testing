// 路由設定：需登入頁面（/checkout、/orders/:id）以 navigation guard 保護
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'products',
      component: () => import('../pages/ProductListPage.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../pages/RegisterPage.vue'),
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('../pages/CartPage.vue'),
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('../pages/CheckoutPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../pages/OrderDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, admin: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../pages/admin/AdminDashboardPage.vue'),
        },
        {
          path: 'coupons',
          name: 'admin-coupons',
          component: () => import('../pages/admin/AdminCouponsPage.vue'),
        },
        {
          path: 'coupons/new',
          name: 'admin-coupon-create',
          component: () => import('../pages/admin/AdminCouponCreatePage.vue'),
        },
        {
          path: 'coupons/:id/edit',
          name: 'admin-coupon-edit',
          component: () => import('../pages/admin/AdminCouponEditPage.vue'),
        },
      ],
    },
  ],
})

// 未登入導向 /login?redirect=<原路徑>，登入後由 Login/Register 頁導回
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
