/**
 * 搜索历史下拉组件
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
}

// ==================== 渲染搜索历史下拉 ====================

export function renderSearchHistory(filterText: string = ''): string {
  const history = getSearchHistory();
  const filtered = filterText
    ? history.filter((h) => h.text.toLowerCase().includes(filterText.toLowerCase()))
    : history;

  if (filtered.length === 0) {
    return `<div class="px-4 py-6 text-center text-gray-500 text-sm">${
      filterText ? '无匹配的历史记录' : '暂无搜索历史'
    }</div>`;
  }

  return filtered
    .map(
      (item, index) => `
      <div class="search-history-item flex items-center justify-between px-4 py-2.5 hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors group" data-index="${index}" data-text="${item.text}">
        <div class="flex items-center space-x-3 flex-1 min-w-0">
          <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm text-gray-300 truncate">${item.text}</span>
        </div>
        <button class="delete-history-item text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100" data-text="${item.text}" title="删除">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `
    )
    .join('');
}

export function showSearchHistoryDropdown(filterText: string = ''): void {
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
