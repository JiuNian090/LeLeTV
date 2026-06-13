/**
 * Pinia Store — 设置状态
 *
 * 管理 API 源选择、自定义 API、功能开关等设置。
 * 与 localStorage 双向同步，兼容原生 JS 设置逻辑。
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface CustomApi {
  name: string;
  url: string;
  detail?: string;
  isHidden?: boolean;
}

export const useSettingsStore = defineStore('settings', () => {
  // ===== 状态 =====

  /** 已选择的 API 源 key 列表 */
  const selectedAPIs = ref<string[]>(loadArray('leletv_selected_apis', []));

  /** 自定义 API 列表 */
  const customAPIs = ref<CustomApi[]>(loadArray<CustomApi>('leletv_custom_apis', []));

  /** 隐藏内容过滤开关 */
  const hiddenContentEnabled = ref(loadBoolean('leletv_hidden_filter', false));

  /** 广告过滤开关 */
  const adFilteringEnabled = ref(loadBoolean('leletv_ad_filter', true));

  // ===== 同步到 localStorage =====

  watch(selectedAPIs, (val) => {
    try { localStorage.setItem('leletv_selected_apis', JSON.stringify(val)); } catch { /* noop */ }
  }, { deep: true });

  watch(customAPIs, (val) => {
    try { localStorage.setItem('leletv_custom_apis', JSON.stringify(val)); } catch { /* noop */ }
  }, { deep: true });

  watch(hiddenContentEnabled, (val) => {
    try { localStorage.setItem('leletv_hidden_filter', String(val)); } catch { /* noop */ }
  });

  watch(adFilteringEnabled, (val) => {
    try { localStorage.setItem('leletv_ad_filter', String(val)); } catch { /* noop */ }
  });

  // ===== 辅助函数 =====

  function loadArray<T>(key: string, fallback: T[]): T[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadBoolean(key: string, fallback: boolean): boolean {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? raw === 'true' : fallback;
    } catch {
      return fallback;
    }
  }

  // ===== Actions =====

  function toggleAPI(key: string): void {
    const idx = selectedAPIs.value.indexOf(key);
    if (idx >= 0) {
      selectedAPIs.value = selectedAPIs.value.filter(k => k !== key);
    } else {
      selectedAPIs.value.push(key);
    }
  }

  function selectAllAPIs(keys: string[]): void {
    selectedAPIs.value = [...keys];
  }

  function resetAPIs(): void {
    selectedAPIs.value = [];
    customAPIs.value = [];
  }

  function addCustomAPI(api: CustomApi): void {
    customAPIs.value.push(api);
  }

  function removeCustomAPI(index: number): void {
    customAPIs.value.splice(index, 1);
  }

  function toggleHiddenContent(): void {
    hiddenContentEnabled.value = !hiddenContentEnabled.value;
  }

  function toggleAdFilter(): void {
    adFilteringEnabled.value = !adFilteringEnabled.value;
  }

  return {
    selectedAPIs,
    customAPIs,
    hiddenContentEnabled,
    adFilteringEnabled,
    toggleAPI,
    selectAllAPIs,
    resetAPIs,
    addCustomAPI,
    removeCustomAPI,
    toggleHiddenContent,
    toggleAdFilter,
  };
});
