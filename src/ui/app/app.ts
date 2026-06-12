/**
 * 主页面应用入口
 * 整合搜索、配置、历史、分类等模块
 */

import { initAurora } from '../../effects/aurora-bg';
import { initTitleAnimation } from '../../effects/title-animation';
import { setupSearchReady, executeSearch, getAllResults } from './app-search';
import { initAPICheckboxes, renderCustomAPIsList, loadSelectedAPIs, selectAllAPIs, resetAPIs, exportConfig, importConfig, importConfigFromUrl, addCustomApi, removeCustomApi } from './app-config';
import { loadViewingHistory, playFromHistory, clearAllHistory, deleteHistoryItem } from '../../services/history';
import { showToast, showLoading, hideLoading } from '../components/toast';
import { showModal, clearLocalStorage } from '../components/modal';
import { showSearchHistoryDropdown, hideSearchHistoryDropdown, deleteSearchHistoryItem, clearAllSearchHistory } from '../components/search-history';
import { playDirectly } from '../../services/player/player-bridge';
import { CacheManager } from '../../services/cache';

// ==================== 初始化 ====================

export function initApp(): void {
  // 极光背景
  initAurora({
    selector: '#auroraContainer',
    colorStops: ['#3A29FF', '#ec4899', '#FFD700'],
    amplitude: 0.45,
    blend: 0.6,
    speed: 0.35,
  });

  // 标题动画
  initTitleAnimation('titleContainer');

  // 搜索就绪
  setupSearchReady();
  loadSelectedAPIs();

  // 缓存管理
  try {
    new CacheManager();
  } catch {
    /* 静默 */
  }
}

// ==================== data-action 事件分发 ====================

export function handleAction(action: string, element: HTMLElement): void {
  switch (action) {
    // === 搜索 ===
    case 'search': {
      const input = document.getElementById('searchInput') as HTMLInputElement;
      if (input) executeSearch(input.value.trim());
      break;
    }
    case 'reset-home': {
      const input = document.getElementById('searchInput') as HTMLInputElement;
      if (input) input.value = '';
      hideSearchHistoryDropdown();
      document.getElementById('resultsArea')?.classList.add('hidden');
      break;
    }
    case 'close-results': {
      document.getElementById('resultsArea')?.classList.add('hidden');
      break;
    }

    // === 搜索历史 ===
    case 'show-search-history': {
      const input = document.getElementById('searchInput') as HTMLInputElement;
      showSearchHistoryDropdown(input?.value || '');
      break;
    }
    case 'hide-search-history': {
      hideSearchHistoryDropdown();
      break;
    }
    case 'delete-search-item': {
      const text = element.dataset.text;
      if (text) {
        deleteSearchHistoryItem(text);
        const input = document.getElementById('searchInput') as HTMLInputElement;
        showSearchHistoryDropdown(input?.value || '');
      }
      break;
    }
    case 'clear-search-history': {
      clearAllSearchHistory();
      showSearchHistoryDropdown('');
      showToast('搜索历史已清除', 'success');
      break;
    }
    case 'search-history-item': {
      const text = element.dataset.text;
      if (text) {
        const input = document.getElementById('searchInput') as HTMLInputElement;
        if (input) {
          input.value = text;
          executeSearch(text);
        }
      }
      break;
    }

    // === 视频播放 ===
    case 'play-video': {
      const id = element.dataset.id;
      const title = element.dataset.title;
      const sourceCode = element.dataset.source;
      if (id && title && sourceCode) {
        playDirectly(id, title, sourceCode);
      }
      break;
    }

    // === 配置 ===
    case 'select-all-apis': {
      selectAllAPIs(true, true);
      break;
    }
    case 'deselect-all-apis': {
      selectAllAPIs(false);
      break;
    }
    case 'reset-apis': {
      resetAPIs();
      break;
    }
    case 'show-add-custom-api': {
      const form = document.getElementById('addCustomApiForm');
      if (form) form.classList.remove('hidden');
      break;
    }
    case 'cancel-add-custom-api': {
      const form = document.getElementById('addCustomApiForm');
      if (form) {
        form.classList.add('hidden');
        (document.getElementById('customApiName') as HTMLInputElement).value = '';
        (document.getElementById('customApiUrl') as HTMLInputElement).value = '';
        (document.getElementById('customApiDetail') as HTMLInputElement).value = '';
      }
      break;
    }
    case 'add-custom-api': {
      const name = (document.getElementById('customApiName') as HTMLInputElement).value.trim();
      const url = (document.getElementById('customApiUrl') as HTMLInputElement).value.trim();
      const detail = (document.getElementById('customApiDetail') as HTMLInputElement).value.trim();
      const isHidden = (document.getElementById('customApiIsHidden') as HTMLInputElement).checked;
      addCustomApi(name, url, detail, isHidden);
      break;
    }
    case 'remove-custom-api': {
      const idx = parseInt(element.dataset.index || '-1');
      removeCustomApi(idx);
      break;
    }
    case 'export-config': {
      exportConfig();
      break;
    }
    case 'import-config': {
      importConfig();
      break;
    }
    case 'import-config-from-url': {
      importConfigFromUrl();
      break;
    }

    // === 历史 ===
    case 'switch-to-category': {
      switchPage('category');
      break;
    }
    case 'play-from-history': {
      const idx = parseInt(element.dataset.index || '-1');
      playFromHistory(idx);
      break;
    }
    case 'delete-history-item': {
      const idx2 = parseInt(element.dataset.index || '-1');
      deleteHistoryItem(idx2);
      loadViewingHistory();
      break;
    }
    case 'clear-history': {
      showModal({
        title: '清空观看历史',
        content: (body, overlay) => {
          body.innerHTML = `
            <p class="text-gray-300 mb-4">确定要清空所有观看历史记录吗？</p>
            <div class="flex justify-end space-x-2">
              <button id="confirmClearHistory" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">确定清空</button>
              <button class="modal-close-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">取消</button>
            </div>
          `;
          body.querySelector('#confirmClearHistory')!.addEventListener('click', () => {
            clearAllHistory();
            loadViewingHistory();
            overlay.remove();
            showToast('观看历史已清空', 'success');
          });
        },
      });
      break;
    }

    // === 清除缓存 ===
    case 'clear-cache': {
      clearLocalStorage();
      break;
    }

    // === 页面切换 ===
    case 'switch-page': {
      const page = element.dataset.page;
      if (page) switchPage(page);
      break;
    }
  }
}

// ==================== 页面切换（hash 路由） ====================

function showPage(pageName: string): void {
  document.querySelectorAll('.page-content').forEach((p) => p.classList.remove('active'));

  const target = document.getElementById('page-' + pageName);
  if (target) target.classList.add('active');

  const main = document.querySelector('.main-container');
  if (main) main.setAttribute('data-page', pageName);

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === pageName);
  });

  // 页面特定初始化
  switch (pageName) {
    case 'category':
      import('../../services/api/tmdb').then(() => {
        if (typeof (window as any).initTmdbCategory === 'function') {
          (window as any).initTmdbCategory();
        }
      });
      break;
    case 'history':
      loadViewingHistory();
      break;
    case 'settings':
      initAPICheckboxes();
      renderCustomAPIsList();
      break;
    case 'about':
      loadAboutPage();
      break;
  }
}

function switchPage(pageName: string): void {
  const targetHash = pageName === 'home' ? '' : '#' + pageName;
  if (location.hash !== targetHash) {
    location.hash = targetHash;
  } else {
    showPage(pageName);
  }
}

function handleHashChange(): void {
  showPage(location.hash.slice(1) || 'home');
}

// ==================== 关于页面 ====================

function loadAboutPage(): void {
  const container = document.getElementById('aboutChangelogContent');
  if (!container || container.dataset.loaded === 'true') return;
  container.dataset.loaded = 'true';

  fetch('/CHANGELOG.md', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('获取更新日志失败');
      return r.text();
    })
    .then((md) => {
      container.innerHTML = '';
      container.appendChild(parseAndRenderChangelog(md));
    })
    .catch(() => {
      container.innerHTML =
        '<div class="bg-red-900/30 border border-red-800/50 rounded-lg p-4 text-center mt-4"><p class="text-red-400 text-sm">加载更新日志失败</p></div>';
    });
}

function parseAndRenderChangelog(markdown: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className =
    'changelog-timeline max-h-[500px] overflow-y-auto pr-2 scrollbar-thin';
  (wrapper as any).style.scrollbarWidth = 'thin';
  (wrapper as any).style.scrollbarColor = '#4B5563 transparent';

  const lines = markdown.split('\n');
  let currentVersion = '';
  let currentDate = '';
  let currentContent = '';
  let isInEntry = false;

  const finalizeEntry = () => {
    if (!currentVersion) return;
    const entry = document.createElement('div');
    entry.className = 'changelog-entry';

    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    const dot = document.createElement('div');
    dot.className = 'timeline-dot' + (wrapper.children.length === 0 ? ' latest' : '');
    marker.appendChild(dot);
    const line = document.createElement('div');
    line.className = 'timeline-line';
    marker.appendChild(line);
    entry.appendChild(marker);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'timeline-content';
    const header = document.createElement('div');
    header.className = 'entry-header';
    const vSpan = document.createElement('span');
    vSpan.className = 'version-number';
    vSpan.textContent = currentVersion;
    header.appendChild(vSpan);
    if (wrapper.children.length === 0) {
      const badge = document.createElement('span');
      badge.className = 'latest-badge';
      badge.textContent = '最新';
      header.appendChild(badge);
    }
    if (currentDate) {
      const dSpan = document.createElement('span');
      dSpan.className = 'version-date';
      dSpan.textContent = currentDate;
      header.appendChild(dSpan);
    }
    contentDiv.appendChild(header);
    const body = document.createElement('div');
    body.className = 'entry-body';
    body.innerHTML = currentContent;
    contentDiv.appendChild(body);
    entry.appendChild(contentDiv);
    wrapper.appendChild(entry);
  };

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (isInEntry) finalizeEntry();
      isInEntry = true;
      currentContent = '';
      const m = line.match(/### (v[\d\.]+) \(([\d\-:\s]+)\)/);
      if (m) {
        currentVersion = m[1];
        currentDate = m[2];
      } else if (line.includes('初始版本')) {
        currentVersion = '初始版本';
        currentDate = '';
      }
    } else if (line.startsWith('- ') && isInEntry) {
      const tagMatch = line.match(/- \[(.*?)\] (.*?)$/);
      if (tagMatch) {
        currentContent += `<p class="mb-1"><span class="text-green-400">[${tagMatch[1]}]</span> ${tagMatch[2]}</p>`;
      } else {
        currentContent += `<p class="mb-1">${line.substring(2)}</p>`;
      }
    } else if (line.trim() !== '' && isInEntry) {
      currentContent += `<p class="text-gray-400 text-sm mt-2">${line}</p>`;
    }
  }

  if (isInEntry) finalizeEntry();
  return wrapper;
}

// ==================== DOM 就绪初始化 ====================

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // hash 路由
    showPage(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', handleHashChange);

    // data-action 事件委托
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
      if (target) {
        const action = target.dataset.action;
        if (action) handleAction(action, target);
      }
    });
  });
}
