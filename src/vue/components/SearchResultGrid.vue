<template>
  <div class="w-full mt-4" :class="{ hidden: !visible }">
    <div class="mx-auto max-w-7xl px-2">
      <!-- 源过滤标签 -->
      <SourceFilterTabs
        :results="results"
        :active-filter="activeFilter"
        @filter="setFilter"
      />

      <!-- 加载状态 -->
      <div v-if="isLoading" class="col-span-full text-center py-8">
        <div class="loading-spinner mx-auto"></div>
        <p class="text-gray-400 mt-2">搜索中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="results.length === 0 && !isLoading" class="col-span-full text-center py-12 text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <p>没有找到匹配的视频</p>
      </div>

      <!-- 结果网格 -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        <SearchResultCard
          v-for="(item, index) in filteredResults"
          :key="index"
          :item="item"
          @play="handlePlay"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SearchResultGrid.vue — 搜索结果网格
 *
 * 通过自定义事件从原生搜索接收结果数据。
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import SearchResultCard from './SearchResultCard.vue';
import SourceFilterTabs from './SourceFilterTabs.vue';
import { playDirectly } from '../../services/player/player-bridge';

// ===== 状态 =====

const visible = ref(false);
const isLoading = ref(false);
const results = ref<Record<string, any>[]>([]);
const activeFilter = ref('all');

// ===== 计算属性 =====

const filteredResults = computed(() => {
  if (activeFilter.value === 'all') return results.value;
  return results.value.filter((r) => r.source_code === activeFilter.value);
});

// ===== 生命周期 =====

onMounted(() => {
  window.addEventListener('leletv:search-results-changed', onResultsChanged as EventListener);
  window.addEventListener('leletv:search-loading', onLoading as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('leletv:search-results-changed', onResultsChanged as EventListener);
  window.removeEventListener('leletv:search-loading', onLoading as EventListener);
});

// ===== 事件处理 =====

function onResultsChanged(e: CustomEvent): void {
  const detail = e.detail || {};
  results.value = detail.results || [];
  isLoading.value = false;
  activeFilter.value = 'all';
  visible.value = results.value.length > 0 || !!detail.keepVisible;
}

function onLoading(e: CustomEvent): void {
  isLoading.value = e.detail?.loading !== false;
  if (isLoading.value) {
    visible.value = true;
  }
}

// ===== 方法 =====

function setFilter(key: string): void {
  activeFilter.value = key;
}

function handlePlay(item: Record<string, any>): void {
  const id = String(item.vod_id || '');
  const title = String(item.vod_name || '');
  const sourceCode = String(item.source_code || '');
  if (id && title && sourceCode) {
    playDirectly(id, title, sourceCode);
  }
}
</script>
