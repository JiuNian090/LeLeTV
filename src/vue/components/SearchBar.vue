<template>
  <div class="w-full max-w-5xl mx-auto">
    <div class="relative mb-3">
      <div
        class="home-search-bar h-12 rounded-full overflow-hidden flex items-center transition-all duration-300 hover:border-[#555] focus-within:border-[#555] focus-within:shadow-lg"
        data-searchbar
      >
          <!-- 首页按钮 -->
          <button
            @click="resetHome"
            class="h-full w-12 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="返回首页"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
          </button>

          <!-- 搜索输入框 -->
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="flex-1 bg-transparent text-white px-4 py-0 focus:outline-none transition-colors"
            placeholder="搜索你喜欢的视频..."
            autocomplete="off"
            aria-label="视频搜索框"
            @input="onInput"
            @keydown.enter="doSearch"
            @focus="onFocus"
            @blur="onBlur"
          >

          <!-- 关闭搜索结果按钮 -->
          <button
            v-if="hasResults"
            @click="closeResults"
            class="h-full w-12 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="关闭搜索结果"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>

          <!-- 搜索按钮 -->
          <button
            @click="doSearch"
            class="h-full w-12 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="搜索按钮"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
/**
 * SearchBar.vue — 搜索栏
 *
 * 原生 search bar 的 Vue 版本。
 * 搜索执行逻辑仍通过原生 app-search.ts 处理。
 */

import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useSearchStore } from '../stores/search';

const searchStore = useSearchStore();

// ===== 状态 =====

const query = ref('');
const hasResults = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ===== 生命周期 =====

onMounted(() => {
  // 监听搜索结果变化
  window.addEventListener('leletv:search-results-changed', onResultsChanged as EventListener);
  // 监听搜索历史选择事件
  window.addEventListener('leletv:search-history-select', onHistorySelect as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('leletv:search-results-changed', onResultsChanged as EventListener);
  window.removeEventListener('leletv:search-history-select', onHistorySelect as EventListener);
});

// ===== 事件处理 =====

function onResultsChanged(e: CustomEvent): void {
  hasResults.value = e.detail?.count > 0;
}

function onHistorySelect(e: CustomEvent): void {
  query.value = e.detail?.text || '';
  doSearch();
}

// ===== 方法 =====

function onInput(): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  const val = query.value.trim();
  if (val.length >= 2) {
    debounceTimer = setTimeout(() => {
      doSearch();
    }, 300);
  }
}

function doSearch(): void {
  const val = query.value.trim();
  if (!val) return;

  searchStore.setQuery(val);
  searchStore.addToHistory(val);

  // 通过原生搜索执行（保留向后兼容）
  executeNativeSearch(val);
}

function resetHome(): void {
  query.value = '';
  hasResults.value = false;
  hideSearchHistory();
  closeResultsArea();
}

function closeResults(): void {
  hasResults.value = false;
  closeResultsArea();
}

function onFocus(): void {
  if (query.value.trim()) {
    showSearchHistory();
  }
}

function onBlur(): void {
  // 延迟隐藏以允许点击历史项
  setTimeout(() => hideSearchHistory(), 200);
}

// ===== 原生桥接 =====

function executeNativeSearch(val: string): void {
  const native = (window as any).__nativeExecuteSearch;
  if (native) {
    native(val);
  }
}

function showSearchHistory(): void {
  window.dispatchEvent(new CustomEvent('leletv:show-search-history', { detail: { filterText: '' } }));
}

function hideSearchHistory(): void {
  window.dispatchEvent(new CustomEvent('leletv:hide-search-history'));
}

function closeResultsArea(): void {
  document.getElementById('resultsArea')?.classList.add('hidden');
}
</script>
