/**
 * 搜索业务逻辑模块
 * 搜索输入处理、结果渲染、data-action 事件分发
 */

import { searchByAPIAndKeyWord, SearchResult } from '../../services/api/search';
import { getSearchHistory, saveSearchHistory } from '../components/search-history';
import { showToast } from '../components/toast';
import { AGGREGATED_SEARCH_CONFIG } from '../../services/api/api-config';

// ==================== 搜索状态 ====================

let currentQuery = '';
let allResults: SearchResult[] = [];
let searchThrottled = false;

export function getCurrentQuery(): string {
  return currentQuery;
}

export function setCurrentQuery(q: string): void {
  currentQuery = q;
}

export function getAllResults(): SearchResult[] {
  return allResults;
}

// ==================== 搜索执行 ====================

export async function executeSearch(query: string): Promise<void> {
  if (!query?.trim()) return;
  if (searchThrottled) return;

  searchThrottled = true;
  setTimeout(() => {
    searchThrottled = false;
  }, 500);

  currentQuery = query.trim();
  saveSearchHistory(currentQuery);

  const resultsArea = document.getElementById('resultsArea');
  const resultsContainer = document.getElementById('results');
  if (resultsArea) resultsArea.classList.remove('hidden');
  if (resultsContainer) {
    resultsContainer.innerHTML = '<div class="col-span-full text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-gray-400 mt-2">搜索中...</p></div>';
  }

  try {
    const selectedAPIs: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
      } catch {
        return [];
      }
    })();

    if (selectedAPIs.length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">请先在设置中选择数据源</div>';
      }
      return;
    }

    const promises = selectedAPIs.map((apiId: string) =>
      searchByAPIAndKeyWord(apiId, currentQuery).then((results) => ({
        source: apiId,
        results,
      }))
    );

    const settledResults = await Promise.allSettled(promises);
    allResults = [];

    settledResults.forEach((r) => {
      if (r.status === 'fulfilled') {
        allResults.push(...r.value.results);
      }
    });

    renderResults(allResults, 'all');
  } catch (error) {
    console.error('搜索失败:', error);
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div class="col-span-full text-center py-8 text-red-400">搜索失败，请稍后重试</div>';
    }
  }
}

// ==================== 结果渲染 ====================

export function renderResults(results: SearchResult[], activeFilter: string): void {
  const container = document.getElementById('results');
  if (!container) return;

  const filtered =
    activeFilter === 'all'
      ? results
      : results.filter((r) => r.source_code === activeFilter);

  if (filtered.length === 0) {
    // 仅在容器有实际卡片内容时才不覆盖（防止瞬时空白闪烁）
    const hasCards = container.querySelector('.result-card');
    if (hasCards) return;
    container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400"><svg class="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg><p>没有找到匹配的视频</p></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'result-card group bg-[rgba(26,26,30,0.6)] rounded-xl overflow-hidden border border-[var(--color-border-default)] hover:border-pink-500/40 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-pink-500/5';
    card.setAttribute('data-action', 'play-video');
    card.setAttribute('data-id', String(item.vod_id || ''));
    card.setAttribute('data-title', String(item.vod_name || ''));
    card.setAttribute('data-source', String(item.source_code || ''));

    const cover = item.vod_pic || 'image/nomedia.png';
    const title = String(item.vod_name || '未知');
    const sourceName = String(item.source_name || '');

    card.innerHTML = `
      <div class="aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
        <img src="${cover}" alt="${title}" class="w-full h-full object-cover transition-all duration-300 group-hover:scale-110 group-hover:brightness-110" loading="lazy" onerror="this.src='image/nomedia.png'">
      </div>
      <div class="p-3 space-y-1">
        <h3 class="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">${escapeHtml(title)}</h3>
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-pink-500/60 flex-shrink-0"></span>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(sourceName)}</p>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);

  // 更新源过滤标签
  renderSourceFilterTabs(results, activeFilter);
}

function renderSourceFilterTabs(results: SearchResult[], activeFilter: string): void {
  const container = document.getElementById('sourceFilterTabs');
  if (!container) return;

  const sourceMap = new Map<string, number>();
  results.forEach((r) => {
    const code = r.source_code || 'unknown';
    sourceMap.set(code, (sourceMap.get(code) || 0) + 1);
  });

  let html = `<button class="source-filter-tab ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">全部 (${results.length})</button>`;
  sourceMap.forEach((count, code) => {
    const name = results.find((r) => r.source_code === code)?.source_name || code;
    html += `<button class="source-filter-tab ${activeFilter === code ? 'active' : ''}" data-filter="${code}">${escapeHtml(name)} (${count})</button>`;
  });

  container.innerHTML = html;

  container.querySelectorAll('.source-filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLElement).dataset.filter || 'all';
      renderResults(allResults, filter);

      container.querySelectorAll('.source-filter-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== 搜索就绪 ====================

export function setupSearchReady(): void {
  const input = document.getElementById('searchInput') as HTMLInputElement;
  if (!input) return;

  let debounceTimer: ReturnType<typeof setTimeout>;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    if (val.length >= 2) {
      debounceTimer = setTimeout(() => executeSearch(val), 300);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(input.value.trim());
    }
  });
}
