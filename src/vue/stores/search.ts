/**
 * Pinia Store — 搜索状态
 *
 * 管理搜索相关状态：关键词、结果、加载状态、搜索历史。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SearchResult {
  title: string;
  url: string;
  cover?: string;
  source?: string;
  type?: string;
  [key: string]: unknown;
}

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const isLoading = ref(false);
  const activeFilter = ref('all');
  const searchHistory = ref<string[]>(loadHistory());

  function setQuery(q: string): void {
    query.value = q;
  }

  function setResults(r: SearchResult[]): void {
    results.value = r;
  }

  function setLoading(v: boolean): void {
    isLoading.value = v;
  }

  function setActiveFilter(f: string): void {
    activeFilter.value = f;
  }

  // ===== 搜索历史 =====

  function loadHistory(): string[] {
    try {
      const raw = localStorage.getItem('leletv_search_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(): void {
    try {
      localStorage.setItem('leletv_search_history', JSON.stringify(searchHistory.value));
    } catch { /* noop */ }
  }

  function addToHistory(q: string): void {
    const trimmed = q.trim();
    if (!trimmed) return;

    const idx = searchHistory.value.indexOf(trimmed);
    if (idx >= 0) {
      searchHistory.value.splice(idx, 1);
    }
    searchHistory.value.unshift(trimmed);
    if (searchHistory.value.length > 20) {
      searchHistory.value = searchHistory.value.slice(0, 20);
    }
    saveHistory();
  }

  function removeHistoryItem(q: string): void {
    searchHistory.value = searchHistory.value.filter(item => item !== q);
    saveHistory();
  }

  function clearHistory(): void {
    searchHistory.value = [];
    saveHistory();
  }

  return {
    query,
    results,
    isLoading,
    activeFilter,
    searchHistory,
    setQuery,
    setResults,
    setLoading,
    setActiveFilter,
    addToHistory,
    removeHistoryItem,
    clearHistory,
  };
});
