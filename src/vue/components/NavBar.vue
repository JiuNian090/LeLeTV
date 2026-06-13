<template>
  <nav class="top-nav-bar">
    <div class="nav-container">
      <!-- 左侧 Logo -->
      <div class="nav-logo">
        <a href="#" class="flex items-center" @click.prevent="goHome">
          <img src="/image/nomedia.png" alt="LeLeTV Logo" class="logo-img">
        </a>
      </div>

      <!-- 右侧功能按钮 -->
      <div class="nav-actions">
        <button
          v-for="btn in buttons"
          :key="btn.page"
          :class="['nav-btn', { active: currentPage === btn.page }]"
          :aria-label="btn.label"
          @click="switchTo(btn.page)"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" v-html="btn.icon" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
/**
 * NavBar.vue — 顶部导航栏
 *
 * 替换原生导航栏 HTML。
 * 页面切换通过 Vue Router 或原生 hash 路由完成。
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// ===== 按钮配置 =====

const buttons = [
  {
    page: 'home',
    label: '搜索',
    icon: '<path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>',
  },
  {
    page: 'category',
    label: '分类',
    icon: '<path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"/>',
  },
  {
    page: 'history',
    label: '观看历史',
    icon: '<path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  },
  {
    page: 'settings',
    label: '打开设置',
    icon: '<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
  },
  {
    page: 'about',
    label: '关于',
    icon: '<path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>',
  },
];

// ===== 状态 =====

const currentPage = ref(getPageFromHash());

// ===== 生命周期 =====

onMounted(() => {
  window.addEventListener('hashchange', onHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange);
});

// ===== 方法 =====

function getPageFromHash(): string {
  const hash = location.hash.replace('#', '');
  return hash || 'home';
}

function onHashChange(): void {
  currentPage.value = getPageFromHash();
}

function switchTo(page: string): void {
  const targetHash = page === 'home' ? '' : page;
  if (location.hash.replace('#', '') !== targetHash) {
    location.hash = targetHash;
  }
}

function goHome(): void {
  switchTo('home');
}
</script>
