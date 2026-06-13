<template>
  <div class="settings-dashboard-container">
    <div class="settings-dashboard-header">
      <h2 class="settings-dashboard-title">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/>
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        设置
      </h2>
    </div>

    <div class="settings-dashboard-grid">
      <!-- 数据源设置 -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
            </svg>
          </span>
          <h3 class="dash-card-title">数据源</h3>
        </div>
        <div class="dash-card-body">
          <div class="flex gap-2 mb-3 flex-wrap">
            <button @click="selectAll(true)" class="dash-btn dash-btn-gray">全选</button>
            <button @click="selectAll(false)" class="dash-btn dash-btn-gray">全不选</button>
            <button @click="resetAPIs" class="dash-btn dash-btn-green">重置</button>
          </div>
          <div class="dash-api-grid">
            <!-- 普通 API -->
            <div class="api-group-title">普通资源</div>
            <label v-for="(api, key) in normalAPIs" :key="key" class="flex items-center py-0.5">
              <input type="checkbox" :checked="isSelected(key)" @change="toggle(key)" class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]">
              <span class="ml-1 text-xs text-gray-400 truncate">{{ api.name }}</span>
            </label>

            <!-- 隐藏 API（条件显示） -->
            <template v-if="showHiddenAPIs">
              <div class="api-group-title hidden">隐藏资源采集站 <span class="hidden-warning">⚠️</span></div>
              <label v-for="(api, key) in hiddenAPIs" :key="key" class="flex items-center py-0.5">
                <input type="checkbox" :checked="isSelected(key)" @change="toggle(key)" class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]">
                <span class="ml-1 text-xs text-pink-400 truncate">{{ api.name }}</span>
              </label>
            </template>
          </div>
          <div class="dash-stats">
            <span>已选 <span class="text-white font-semibold">{{ selectedCount }}</span></span>
          </div>
        </div>
      </div>

      <!-- 自定义API管理 -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>
            </svg>
          </span>
          <h3 class="dash-card-title">自定义API</h3>
          <button @click="showAddForm = true" class="dash-add-btn" title="添加">+</button>
        </div>
        <div class="dash-card-body">
          <!-- 自定义 API 列表 -->
          <div v-if="customAPIs.length === 0" class="text-xs text-gray-500 text-center my-2">未添加自定义API</div>
          <div v-for="(api, index) in customAPIs" :key="index" class="flex items-center justify-between p-1 mb-1 bg-[#222] rounded">
            <div class="flex items-center flex-1 min-w-0">
              <input type="checkbox" :checked="isSelected('custom_' + index)" @change="toggleCustom(index)" class="form-checkbox h-3 w-3 text-blue-600 mr-1">
              <div class="flex-1 min-w-0">
                <div :class="['text-xs font-medium truncate', api.isHidden ? 'text-pink-400' : 'text-white']">
                  <span v-if="api.isHidden" class="text-xs text-pink-400 mr-1">(18+)</span>{{ api.name }}
                </div>
                <div class="text-xs text-gray-500 truncate">{{ api.url }}</div>
              </div>
            </div>
            <div class="flex items-center">
              <button @click="removeCustomAPI(index)" class="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
            </div>
          </div>

          <!-- 添加自定义 API 表单 -->
          <div v-if="showAddForm" class="mt-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
            <input v-model="newApiName" type="text" placeholder="API名称" class="dash-input mb-2" autocomplete="off">
            <input v-model="newApiUrl" type="text" placeholder="https://abc.com" class="dash-input mb-2" autocomplete="off">
            <input v-model="newApiDetail" type="text" placeholder="detail地址（可选）" class="dash-input mb-2" autocomplete="off">
            <div class="flex items-center mb-3">
              <input v-model="newApiIsHidden" type="checkbox" id="vue-customApiIsHidden" class="dash-checkbox">
              <label for="vue-customApiIsHidden" class="ml-2 text-xs text-pink-400">隐藏资源站</label>
            </div>
            <div class="flex gap-2">
              <button @click="addCustomAPI" class="dash-btn dash-btn-green flex-1">添加</button>
              <button @click="cancelAddForm" class="dash-btn dash-btn-gray flex-1">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 功能开关 -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
            </svg>
          </span>
          <h3 class="dash-card-title">功能开关</h3>
        </div>
        <div class="dash-card-body dash-switch-body">
          <label class="dash-switch-row" :class="{ 'filter-disabled': hiddenFilterDisabled }">
            <div class="dash-switch-info">
              <span class="dash-switch-label">🈲 隐藏内容过滤</span>
              <span class="dash-switch-desc" v-html="hiddenFilterDesc"></span>
            </div>
            <div class="dash-switch-toggle">
              <input type="checkbox" :checked="settings.hiddenContentEnabled" @change="toggleHiddenFilter" :disabled="hiddenFilterDisabled" class="dash-switch-input">
              <div class="dash-switch-track"></div>
              <div class="dash-switch-dot"></div>
            </div>
          </label>
          <label class="dash-switch-row">
            <div class="dash-switch-info">
              <span class="dash-switch-label">分片广告过滤</span>
              <span class="dash-switch-desc">关闭可减少旧版浏览器卡顿</span>
            </div>
            <div class="dash-switch-toggle">
              <input type="checkbox" :checked="settings.adFilteringEnabled" @change="settings.toggleAdFilter()" class="dash-switch-input">
              <div class="dash-switch-track"></div>
              <div class="dash-switch-dot"></div>
            </div>
          </label>
        </div>
      </div>

      <!-- 一般功能 -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"/>
            </svg>
          </span>
          <h3 class="dash-card-title">一般功能</h3>
        </div>
        <div class="dash-card-body">
          <div class="dash-action-grid">
            <button @click="importConfig" class="dash-action-btn dash-action-btn-gray">导入配置</button>
            <button @click="exportConfig" class="dash-action-btn dash-action-btn-export">导出配置</button>
            <button @click="clearCache" class="dash-action-btn dash-action-btn-danger">清除Cookie</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SettingsPanel.vue — 设置面板
 *
 * 管理 API 源选择、自定义 API、功能开关、配置导入导出。
 */

import { ref, computed, onMounted } from 'vue';
import { useSettingsStore, type CustomApi } from '../stores/settings';
import { API_SITES, HIDE_BUILTIN_HIDDEN_APIS, CUSTOM_API_CONFIG } from '../../services/api/api-config';
import { showToast } from '../stores/toast';
import { useModalStore } from '../stores/modal';

const settings = useSettingsStore();
const modalStore = useModalStore();

// ===== 计算属性 =====

const apiSites = API_SITES as Record<string, { api: string; name: string; hidden?: boolean }>;

const normalAPIs = computed(() => {
  const result: Record<string, { api: string; name: string }> = {};
  for (const [key, val] of Object.entries(apiSites)) {
    if (!val.hidden) result[key] = val;
  }
  return result;
});

const hiddenAPIs = computed(() => {
  const result: Record<string, { api: string; name: string; hidden: boolean }> = {};
  for (const [key, val] of Object.entries(apiSites)) {
    if (val.hidden) result[key] = val as any;
  }
  return result;
});

const showHiddenAPIs = computed(() => {
  return !HIDE_BUILTIN_HIDDEN_APIS && !settings.hiddenContentEnabled;
});

const selectedCount = computed(() => settings.selectedAPIs.length);

const hiddenFilterDisabled = computed(() => {
  // 检查是否有隐藏源被选中
  const hasHiddenSelected = Object.keys(hiddenAPIs.value).some(k => settings.selectedAPIs.includes(k));
  const hasCustomHiddenSelected = settings.customAPIs.some((api, idx) =>
    api.isHidden && settings.selectedAPIs.includes('custom_' + idx)
  );
  return hasHiddenSelected || hasCustomHiddenSelected;
});

const hiddenFilterDesc = computed(() => {
  if (hiddenFilterDisabled.value) {
    return '<strong class="text-pink-300">选中隐藏资源站时无法启用此过滤</strong>';
  }
  return '过滤"伦理片🈲"等隐藏内容';
});

// ===== 添加自定义 API 表单状态 =====

const showAddForm = ref(false);
const newApiName = ref('');
const newApiUrl = ref('');
const newApiDetail = ref('');
const newApiIsHidden = ref(false);

// ===== 方法 =====

function isSelected(key: string): boolean {
  return settings.selectedAPIs.includes(key);
}

function toggle(key: string): void {
  settings.toggleAPI(key);
}

function toggleCustom(index: number): void {
  settings.toggleAPI('custom_' + index);
}

function selectAll(select: boolean): void {
  const allKeys = Object.keys(normalAPIs.value);
  if (select) {
    settings.selectAllAPIs(allKeys);
  } else {
    settings.selectedAPIs = settings.selectedAPIs.filter(k => k.startsWith('custom_'));
  }
}

function resetAPIs(): void {
  settings.resetAPIs();
  showToast('数据源已重置', 'success');
}

function toggleHiddenFilter(): void {
  settings.toggleHiddenContent();
}

function cancelAddForm(): void {
  showAddForm.value = false;
  newApiName.value = '';
  newApiUrl.value = '';
  newApiDetail.value = '';
  newApiIsHidden.value = false;
}

function addCustomAPI(): void {
  const name = newApiName.value.trim();
  const url = newApiUrl.value.trim();
  const detail = newApiDetail.value.trim();

  if (!name || !url) {
    showToast('请输入API名称和链接', 'warning');
    return;
  }
  if (!/^https?:\/\/.+/.test(url)) {
    showToast('API链接格式不正确', 'warning');
    return;
  }

  const maxSources = CUSTOM_API_CONFIG.maxSources as number;
  if (settings.customAPIs.length >= maxSources) {
    showToast(`最多添加${maxSources}个自定义API`, 'warning');
    return;
  }

  settings.addCustomAPI({
    name,
    url: url.endsWith('/') ? url.slice(0, -1) : url,
    detail: detail || undefined,
    isHidden: newApiIsHidden.value,
  });

  cancelAddForm();
  showToast('已添加自定义API: ' + name, 'success');
}

function removeCustomAPI(index: number): void {
  const name = settings.customAPIs[index]?.name;
  settings.removeCustomAPI(index);
  showToast('已删除自定义API: ' + name, 'success');
}

function exportConfig(): void {
  const config = {
    selectedAPIs: [...settings.selectedAPIs],
    customAPIs: [...settings.customAPIs],
    hiddenFilterEnabled: settings.hiddenContentEnabled,
    adFilteringEnabled: settings.adFilteringEnabled,
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

function importConfig(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      if (config.selectedAPIs) {
        settings.selectedAPIs = config.selectedAPIs;
      }
      if (config.customAPIs) {
        settings.customAPIs = config.customAPIs;
      }
      if (config.hiddenFilterEnabled !== undefined) {
        settings.hiddenContentEnabled = config.hiddenFilterEnabled;
      }
      if (config.adFilteringEnabled !== undefined) {
        settings.adFilteringEnabled = config.adFilteringEnabled;
      }
      showToast('配置导入成功，页面即将刷新', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast('配置导入失败: ' + ((e as Error).message || '格式错误'), 'error');
    }
  };
  input.click();
}

function clearCache(): void {
  modalStore.open({
    title: '⚠️ 警告',
    content: '', // will use slot
  });
  // For now, use the native clearLocalStorage
  // This will be enhanced later
  import('../../ui/components/modal').then(m => m.clearLocalStorage());
}
</script>
