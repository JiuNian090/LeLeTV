<template>
  <div v-show="visible && items.length > 0" class="search-history-inner">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="search-history-item flex items-center justify-between px-4 py-2.5 hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors group"
      @click="selectItem(item.text)"
    >
      <div class="flex items-center space-x-3 flex-1 min-w-0">
        <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="text-sm text-gray-300 truncate">{{ item.text }}</span>
      </div>
      <button
        class="delete-history-item text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
        @click.stop="deleteItem(item.text)"
        title="删除"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div v-if="items.length > 0" class="px-4 py-2 border-t border-[rgba(255,255,255,0.05)]">
      <button
        class="text-xs text-gray-500 hover:text-red-400 transition-colors w-full text-center"
        @click="clearAll"
      >
        清空搜索历史
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SearchHistoryDropdown.vue — 搜索历史下拉菜单
 *
 * 通过 Pinia store 读取搜索历史，通过 window 事件与原生搜索框通信。
 * 显示/隐藏由原生 JS 通过控制 #searchHistoryDropdown 容器的 class 控制。
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSearchStore } from '../stores/search';

const searchStore = useSearchStore();

// ===== 状态 =====

const visible = ref(false);
const filterText = ref('');

// ===== 计算属性 =====

const items = computed(() => {
  const history = searchStore.searchHistory;
  if (!filterText.value) return history;
  return history.filter(item =>
    item.toLowerCase().includes(filterText.value.toLowerCase())
  );
});

// ===== 生命周期 =====

onMounted(() => {
  window.addEventListener('leletv:show-search-history', onShow as EventListener);
  window.addEventListener('leletv:hide-search-history', onHide as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('leletv:show-search-history', onShow as EventListener);
  window.removeEventListener('leletv:hide-search-history', onHide as EventListener);
});

// ===== 事件处理 =====

function onShow(e: CustomEvent): void {
  filterText.value = e.detail?.filterText || '';
  visible.value = true;
}

function onHide(): void {
  visible.value = false;
}

function selectItem(text: string): void {
  // 通过自定义事件通知原生搜索框
  window.dispatchEvent(new CustomEvent('leletv:search-history-select', { detail: { text } }));
  visible.value = false;
}

function deleteItem(text: string): void {
  searchStore.removeHistoryItem(text);
}

function clearAll(): void {
  searchStore.clearHistory();
}
</script>

<style scoped>
.search-history-inner {
  padding: 4px 0;
}
</style>
