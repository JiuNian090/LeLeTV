/**
 * Vue Router 配置
 *
 * 渐进式迁移：使用 hash 模式，与原生 hash 路由兼容。
 * 路由切换时，Vue Router 控制页面显隐和导航高亮。
 */

import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../components/PlaceholderPage.vue'),
  },
  {
    path: '/category',
    name: 'category',
    component: () => import('../components/PlaceholderPage.vue'),
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../components/PlaceholderPage.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../components/PlaceholderPage.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../components/PlaceholderPage.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由切换后，更新 data-page 属性以兼容原生 CSS 选择器
router.afterEach((to) => {
  const main = document.querySelector('.main-container');
  if (main) {
    const pageName = to.name as string || 'home';
    main.setAttribute('data-page', pageName);
  }
});

export default router;
