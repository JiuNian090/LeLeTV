/**
 * 配置管理模块
 * 设置面板的配置导入导出、API 复选框管理
 */

import { API_SITES, HIDE_BUILTIN_HIDDEN_APIS, CUSTOM_API_CONFIG } from '../../services/api/api-config';
import { showToast, showLoading, hideLoading } from '../components/toast';
import { showModal, showImportBox } from '../components/modal';

// ==================== 状态 ====================

export let selectedAPIs: string[] = [];
export let customAPIs: any[] = [];

export function loadSelectedAPIs(): void {
  try {
    selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
  } catch {
    selectedAPIs = [];
  }
}

export function loadCustomAPIs(): void {
  try {
    customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
  } catch {
    customAPIs = [];
  }
}

// ==================== 配置导入导出 ====================

export function exportConfig(): void {
  const config = {
    selectedAPIs: (() => {
      try { return JSON.parse(localStorage.getItem('selectedAPIs') || '[]'); } catch { return []; }
    })(),
    customAPIs: (() => {
      try { return JSON.parse(localStorage.getItem('customAPIs') || '[]'); } catch { return []; }
    })(),
    hiddenFilterEnabled: localStorage.getItem('hiddenFilterEnabled') === 'true',
    adFilteringEnabled: localStorage.getItem('adFilteringEnabled') !== 'false',
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leletv-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('配置已导出', 'success');
}

export function importConfig(): void {
  showImportBox(async (file: File) => {
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      if (config.selectedAPIs) {
        localStorage.setItem('selectedAPIs', JSON.stringify(config.selectedAPIs));
        loadSelectedAPIs();
      }
      if (config.customAPIs) {
        localStorage.setItem('customAPIs', JSON.stringify(config.customAPIs));
        loadCustomAPIs();
      }
      if (config.hiddenFilterEnabled !== undefined) {
        localStorage.setItem('hiddenFilterEnabled', String(config.hiddenFilterEnabled));
      }
      if (config.adFilteringEnabled !== undefined) {
        localStorage.setItem('adFilteringEnabled', String(config.adFilteringEnabled));
      }
      showToast('配置导入成功，页面即将刷新', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast('配置导入失败: ' + ((e as Error).message || '格式错误'), 'error');
    }
  });
}

export function importConfigFromUrl(): void {
  showModal({
    title: '从 URL 导入配置',
    content: (body) => {
      body.innerHTML = `
        <div class="mb-4">
          <input type="url" id="configUrlInput" class="w-full bg-[#111] border border-[var(--color-border-default)] text-white px-4 py-3 rounded-lg focus:outline-none focus:border-white transition-colors" placeholder="https://example.com/config.json">
        </div>
        <div class="flex justify-end space-x-2">
          <button id="importUrlBtn" class="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded text-sm">导入</button>
          <button class="modal-close-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">取消</button>
        </div>
      `;
      body.querySelector('#importUrlBtn')!.addEventListener('click', async () => {
        const url = (document.getElementById('configUrlInput') as HTMLInputElement).value.trim();
        if (!url) { showToast('请输入配置 URL', 'warning'); return; }
        try {
          showLoading('正在下载配置...');
          const response = await fetch(url);
          const config = await response.json();
          if (config.selectedAPIs) localStorage.setItem('selectedAPIs', JSON.stringify(config.selectedAPIs));
          if (config.customAPIs) localStorage.setItem('customAPIs', JSON.stringify(config.customAPIs));
          hideLoading();
          showToast('配置导入成功', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
          hideLoading();
          showToast('导入失败: ' + ((e as Error).message || '网络错误'), 'error');
        }
      });
    },
  });
}

// ==================== API 复选框管理 ====================

export function initAPICheckboxes(): void {
  const container = document.getElementById('apiCheckboxes');
  if (!container) return;

  loadSelectedAPIs();
  container.innerHTML = '';

  // 普通 API
  const normalDiv = document.createElement('div');
  normalDiv.className = 'contents';
  const normalTitle = document.createElement('div');
  normalTitle.className = 'api-group-title';
  normalTitle.textContent = '普通资源';
  normalDiv.appendChild(normalTitle);

  Object.keys(API_SITES).forEach((key) => {
    const api = API_SITES[key];
    if (api.hidden) return;
    const checked = selectedAPIs.includes(key);
    const item = document.createElement('div');
    item.className = 'flex items-center';
    item.innerHTML = `
      <input type="checkbox" id="api_${key}" class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]" ${checked ? 'checked' : ''} data-api="${key}" data-role="api-toggle">
      <label for="api_${key}" class="ml-1 text-xs text-gray-400 truncate">${api.name}</label>
    `;
    item.querySelector('[data-role="api-toggle"]')!.addEventListener('change', updateSelectedAPIs);
    normalDiv.appendChild(item);
  });
  container.appendChild(normalDiv);

  // 隐藏 API
  if (!HIDE_BUILTIN_HIDDEN_APIS && localStorage.getItem('hiddenFilterEnabled') === 'false') {
    const hiddenDiv = document.createElement('div');
    hiddenDiv.id = 'hiddendiv';
    hiddenDiv.className = 'contents';
    const hiddenTitle = document.createElement('div');
    hiddenTitle.className = 'api-group-title hidden';
    hiddenTitle.innerHTML = `隐藏资源采集站 <span class="hidden-warning">⚠️</span>`;
    hiddenDiv.appendChild(hiddenTitle);

    Object.keys(API_SITES).forEach((key) => {
      const api = API_SITES[key];
      if (!api.hidden) return;
      const checked = selectedAPIs.includes(key);
      const item = document.createElement('div');
      item.className = 'flex items-center';
      item.innerHTML = `
        <input type="checkbox" id="api_${key}" class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333] api-hidden" ${checked ? 'checked' : ''} data-api="${key}" data-role="api-toggle">
        <label for="api_${key}" class="ml-1 text-xs text-pink-400 truncate">${api.name}</label>
      `;
      item.querySelector('[data-role="api-toggle"]')!.addEventListener('change', () => {
        updateSelectedAPIs();
        checkHiddenAPIsSelected();
      });
      hiddenDiv.appendChild(item);
    });
    container.appendChild(hiddenDiv);
  }

  updateSelectedApiCount();
}

export function updateSelectedAPIs(): void {
  const builtInApis = Array.from(
    document.querySelectorAll('#apiCheckboxes input:checked:not(.api-hidden)')
  ).map((el) => (el as HTMLInputElement).dataset.api || '');

  const hiddenApis = Array.from(
    document.querySelectorAll('#apiCheckboxes .api-hidden:checked')
  ).map((el) => (el as HTMLInputElement).dataset.api || '');

  const customSelected = Array.from(
    document.querySelectorAll('#customApisList input:checked')
  ).map((el) => 'custom_' + (el as HTMLInputElement).dataset.customIndex);

  selectedAPIs = [...builtInApis, ...hiddenApis, ...customSelected];
  localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
  localStorage.setItem('hasUserSelectedAPIs', 'true');
  updateSelectedApiCount();
}

function updateSelectedApiCount(): void {
  const el = document.getElementById('selectedApiCount');
  if (el) el.textContent = String(selectedAPIs.length);
}

export function selectAllAPIs(selectAll: boolean = true, excludeHidden: boolean = false): void {
  document.querySelectorAll('#apiCheckboxes input[type="checkbox"]').forEach((el) => {
    const cb = el as HTMLInputElement;
    if (excludeHidden && cb.classList.contains('api-hidden')) {
      cb.checked = false;
    } else {
      cb.checked = selectAll;
    }
  });
  updateSelectedAPIs();
  checkHiddenAPIsSelected();
}

export function resetAPIs(): void {
  localStorage.removeItem('selectedAPIs');
  localStorage.removeItem('hasUserSelectedAPIs');
  localStorage.removeItem('lastRefreshTime');
  loadSelectedAPIs();
  initAPICheckboxes();
  showToast('数据源已重置', 'success');
}

// ==================== 隐藏 API 检查 ====================

function checkHiddenAPIsSelected(): void {
  const hiddenChecked =
    document.querySelectorAll<HTMLInputElement>('#apiCheckboxes .api-hidden:checked').length +
    document.querySelectorAll<HTMLInputElement>('#customApisList .api-hidden:checked').length;

  const toggle = document.getElementById('hiddenFilterToggle') as HTMLInputElement;
  const filterSection = document.querySelector('[data-role="filter-section"]');
  const desc = filterSection?.querySelector('.dash-switch-desc');

  if (hiddenChecked > 0 && toggle) {
    toggle.checked = false;
    toggle.disabled = true;
    localStorage.setItem('hiddenFilterEnabled', 'false');
    filterSection?.classList.add('filter-disabled');
    if (desc) desc.innerHTML = '<strong class="text-pink-300">选中隐藏资源站时无法启用此过滤</strong>';
  } else if (toggle) {
    toggle.disabled = false;
    filterSection?.classList.remove('filter-disabled');
    if (desc) desc.innerHTML = '过滤"伦理片🈲"等隐藏内容';
  }
}

// ==================== 自定义 API 管理 ====================

export function renderCustomAPIsList(): void {
  const container = document.getElementById('customApisList');
  if (!container) return;

  loadCustomAPIs();
  if (customAPIs.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
    return;
  }

  container.innerHTML = customAPIs
    .map(
      (api: any, index: number) => `
      <div class="flex items-center justify-between p-1 mb-1 bg-[#222] rounded">
        <div class="flex items-center flex-1 min-w-0">
          <input type="checkbox" id="custom_api_${index}" class="form-checkbox h-3 w-3 text-blue-600 mr-1 ${api.isHidden ? 'api-hidden' : ''}" ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''} data-custom-index="${index}" data-role="api-toggle">
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium ${api.isHidden ? 'text-pink-400' : 'text-white'} truncate">${api.isHidden ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : ''}${api.name}</div>
            <div class="text-xs text-gray-500 truncate">${api.url}</div>
          </div>
        </div>
        <div class="flex items-center">
          <button class="text-blue-500 hover:text-blue-700 text-xs px-1" data-action="edit-custom-api" data-index="${index}">✎</button>
          <button class="text-red-500 hover:text-red-700 text-xs px-1" data-action="remove-custom-api" data-index="${index}">✕</button>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('[data-role="api-toggle"]').forEach((el) => {
    el.addEventListener('change', () => { updateSelectedAPIs(); checkHiddenAPIsSelected(); });
  });
}

export function addCustomApi(
  name: string,
  url: string,
  detail: string = '',
  isHidden: boolean = false
): void {
  if (!name || !url) {
    showToast('请输入API名称和链接', 'warning');
    return;
  }
  if (!/^https?:\/\/.+/.test(url)) {
    showToast('API链接格式不正确', 'warning');
    return;
  }

  loadCustomAPIs();
  if (customAPIs.length >= (CUSTOM_API_CONFIG.maxSources as number)) {
    showToast(`最多添加${CUSTOM_API_CONFIG.maxSources}个自定义API`, 'warning');
    return;
  }

  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  customAPIs.push({ name, url: cleanUrl, detail, isHidden });
  localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
  renderCustomAPIsList();
  showToast('已添加自定义API: ' + name, 'success');
}

export function removeCustomApi(index: number): void {
  loadCustomAPIs();
  if (index < 0 || index >= customAPIs.length) return;
  const name = customAPIs[index].name;
  customAPIs.splice(index, 1);
  localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
  // 更新 selectedAPIs 中的引用
  selectedAPIs = selectedAPIs.filter((api) => api !== 'custom_' + index);
  // 更新所有 custom_N 索引
  selectedAPIs = selectedAPIs.map((api) => {
    if (api.startsWith('custom_')) {
      const num = parseInt(api.replace('custom_', ''));
      return num > index ? 'custom_' + (num - 1) : api;
    }
    return api;
  });
  localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
  renderCustomAPIsList();
  showToast('已删除自定义API: ' + name, 'success');
}
