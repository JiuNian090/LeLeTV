/**
 * 搜索历史下拉组件
 *
 * 渐进式迁移：通过 Vue Pinia store 管理数据，
 * 发送自定义事件控制 Vue SearchHistoryDropdown 的显隐和定位。
 */

import { SEARCH_HISTORY_KEY, MAX_HISTORY_ITEMS } from '../../services/api/api-config';

// ==================== 类型定义 ====================

interface SearchHistoryItem {
  text: string;
  timestamp: number;
}

// ==================== 数据操作 ====================

export function getSearchHistory(): SearchHistoryItem[] {
  try {
    const data = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => {
        if (typeof item === 'string') return { text: item, timestamp: 0 };
        return item;
      })
      .filter((item: any) => item && item.text);
  } catch (e) {
    console.error('获取搜索历史出错:', e);
    return [];
  }
}

export function saveSearchHistory(query: string): void {
  if (!query?.trim()) return;
  query = query.trim().substring(0, 50).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let history = getSearchHistory();
  const now = Date.now();
  const TWO_MONTHS = 5184000000;

  history = history.filter(
    (item) => typeof item === 'object' && item.timestamp && now - item.timestamp < TWO_MONTHS
  );
  history = history.filter((item) =>
    typeof item === 'object' ? item.text !== query : item !== query
  );
  history.unshift({ text: query, timestamp: now });

  if (history.length > MAX_HISTORY_ITEMS) {
    history = history.slice(0, (MAX_HISTORY_ITEMS as number) + 20);
  }

  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* 静默 */
  }

  // 同步到 Vue Pinia store
  syncToVueStore();
}

function syncToVueStore(): void {
  try {
    const pinia = (window as any).__VUE_PINIA__;
    if (pinia) {
      // Vue store 会自动从 localStorage 读取，无需手动同步
    }
  } catch { /* noop */ }
}

// ==================== 渲染搜索历史下拉（Vue 接管后不再需要）====================

export function renderSearchHistory(filterText: string = ''): string {
  return ''; // Vue 组件负责渲染
}

export function showSearchHistoryDropdown(filterText: string = ''): void {
  // 尝试通过 Vue 显示
  const vueDropdown = document.querySelector('#searchHistoryDropdown .search-history-inner');
  if (vueDropdown) {
    window.dispatchEvent(new CustomEvent('leletv:show-search-history', { detail: { filterText } }));
    positionSearchHistoryDropdown();
    return;
  }

  // 回退：原生渲染（向后兼容）
  const dropdown = document.getElementById('searchHistoryDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = renderSearchHistory(filterText);
  dropdown.classList.remove('hidden');
  positionSearchHistoryDropdown();
}

export function positionSearchHistoryDropdown(): void {
  const searchBar = document.querySelector('[data-searchbar]') as HTMLElement;
  const dropdown = document.getElementById('searchHistoryDropdown') as HTMLElement;
  if (!searchBar || !dropdown) return;

  const rect = searchBar.getBoundingClientRect();
  const isMobile = window.innerWidth <= 640;

  if (isMobile) {
    dropdown.style.position = 'fixed';
    dropdown.style.top = '0';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.bottom = '0';
    dropdown.style.zIndex = '9999';
    dropdown.style.background = 'rgba(0,0,0,0.95)';
    dropdown.style.borderRadius = '0';
    dropdown.style.margin = '0';
  } else {
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;
    dropdown.style.zIndex = '9999';
    dropdown.style.maxHeight = '60vh';
    dropdown.style.overflowY = 'auto';
    dropdown.style.background = 'rgba(30,30,30,0.98)';
    dropdown.style.border = '1px solid rgba(255,255,255,0.1)';
    dropdown.style.borderRadius = '12px';
  }
}

export function hideSearchHistoryDropdown(): void {
  // 尝试通过 Vue 隐藏
  window.dispatchEvent(new CustomEvent('leletv:hide-search-history'));

  // 同时也隐藏原生下拉
  const dropdown = document.getElementById('searchHistoryDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
}

export function deleteSearchHistoryItem(text: string): void {
  let history = getSearchHistory();
  history = history.filter((item) =>
    typeof item === 'object' ? item.text !== text : item !== text
  );
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* 静默 */
  }
}

export function clearAllSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    /* 静默 */
  }
}
