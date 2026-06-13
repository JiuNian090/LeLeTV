<template>
  <div class="history-page-layout">
    <div class="history-content-container">
      <!-- 空状态 -->
      <div v-if="history.length === 0" class="empty-state text-center py-16">
        <div class="empty-icon mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <p class="text-gray-400 text-lg mb-2">暂无观看记录</p>
        <p class="text-gray-600 text-sm mb-6">去分类发现更多精彩内容</p>
        <button @click="goToCategory" class="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-full text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg">
          去分类浏览
        </button>
      </div>

      <!-- 历史列表 -->
      <div v-else>
        <div class="flex justify-between items-center mb-4 px-1">
          <h2 class="text-lg font-semibold text-white">观看历史</h2>
          <button @click="confirmClear" class="text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)]">清空全部</button>
        </div>

        <div v-for="(items, groupName) in groupedHistory" :key="groupName" class="mb-4">
          <h3 v-if="items.length" class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">{{ groupName }}</h3>
          <div
            v-for="(item, idx) in items"
            :key="getGlobalIndex(item)"
            class="history-item flex items-center p-3 mb-1 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors group cursor-pointer"
            @click="playItem(item)"
          >
            <div class="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[#1a1a1a] mr-3">
              <img :src="coverSrc(item)" :alt="item.title" class="w-full h-full object-cover" loading="lazy" @error="onImgError(item)">
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-200 truncate">{{ item.title }}</div>
              <div class="flex items-center mt-1 space-x-2 text-xs text-gray-500">
                <span>{{ item.sourceName || '' }}</span>
                <span>·</span>
                <span>第 {{ (item.episodeIndex || 0) + 1 }} 集</span>
              </div>
              <div class="text-xs text-gray-600 mt-0.5">{{ formatTime(item.timestamp) }}</div>
            </div>
            <button @click.stop="deleteItem(item)" class="delete-history-btn text-gray-600 hover:text-red-400 transition-colors p-2 opacity-0 group-hover:opacity-100" title="删除">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ViewingHistory.vue — 观看历史页面
 *
 * 从 localStorage 读取观看历史，按时间分组显示。
 */

import { ref, computed, onMounted } from 'vue';

interface HistoryItem {
  title: string;
  episodeIndex?: number;
  timestamp: number;
  cover?: string;
  sourceName?: string;
  showIdentifier?: string;
  vod_id?: string;
}

// ===== 状态 =====

const history = ref<HistoryItem[]>([]);
const erroredCovers = ref<Set<string>>(new Set());

// ===== 生命周期 =====

onMounted(() => {
  loadHistory();
});

// ===== 计算属性 =====

const groupedHistory = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgoStart = new Date(todayStart);
  weekAgoStart.setDate(weekAgoStart.getDate() - 7);

  const groups: Record<string, HistoryItem[]> = { '今天': [], '昨天': [], '本周': [], '更早': [] };

  history.value.forEach((item) => {
    const itemDate = new Date(item.timestamp);
    const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    if (itemDay >= todayStart) groups['今天'].push(item);
    else if (itemDay >= yesterdayStart) groups['昨天'].push(item);
    else if (itemDay >= weekAgoStart) groups['本周'].push(item);
    else groups['更早'].push(item);
  });

  return groups;
});

// ===== 方法 =====

function loadHistory(): void {
  try {
    const data = localStorage.getItem('viewingHistory');
    history.value = data ? JSON.parse(data) : [];
  } catch {
    history.value = [];
  }
}

function saveHistory(): void {
  try {
    localStorage.setItem('viewingHistory', JSON.stringify(history.value));
  } catch { /* noop */ }
}

function getGlobalIndex(item: HistoryItem): number {
  return history.value.indexOf(item);
}

function coverSrc(item: HistoryItem): string {
  if (!item.cover || item.cover === 'none' || erroredCovers.value.has(item.title)) {
    return '/image/nomedia.png';
  }
  return item.cover;
}

function onImgError(item: HistoryItem): void {
  erroredCovers.value.add(item.title);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return mins <= 0 ? '刚刚' : `${mins}分钟前`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }

  const y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${M}-${d} ${h}:${m}`;
}

function playItem(item: HistoryItem): void {
  const params = new URLSearchParams();
  if (item.title) params.set('title', item.title);
  if (item.sourceName) params.set('source', item.sourceName);
  if (item.showIdentifier) params.set('id', item.showIdentifier);
  if (item.vod_id) params.set('vod_id', item.vod_id);
  if (item.episodeIndex !== undefined) params.set('index', String(item.episodeIndex));
  window.location.href = `/player.html?${params.toString()}`;
}

function deleteItem(item: HistoryItem): void {
  const idx = history.value.indexOf(item);
  if (idx >= 0) {
    history.value.splice(idx, 1);
    saveHistory();
  }
}

function confirmClear(): void {
  if (confirm('确定要清空所有观看历史记录吗？')) {
    history.value = [];
    saveHistory();
  }
}

function goToCategory(): void {
  (window as any).switchPage?.('category');
}
</script>
