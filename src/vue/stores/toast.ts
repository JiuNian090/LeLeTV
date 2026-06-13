/**
 * Pinia Store — Toast 消息
 *
 * 管理全局 Toast 通知。支持多条消息堆叠、自动消失。
 * 暴露全局 showToast 函数供原生 JS 代码调用。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([]);
  let nextId = 1;

  function show(message: string, type: ToastItem['type'] = 'info', duration = 3000): number {
    const id = nextId++;
    toasts.value.push({ id, message, type, duration });

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  function dismiss(id: number): void {
    const idx = toasts.value.findIndex(t => t.id === id);
    if (idx >= 0) {
      toasts.value.splice(idx, 1);
    }
  }

  function clear(): void {
    toasts.value = [];
  }

  return { toasts, show, dismiss, clear };
});

/**
 * 全局 showToast 函数（供原生 JS 代码直接调用）
 *
 * 使用方式：
 *   import { showToast } from '@/vue/stores/toast';
 *   showToast('操作成功', 'success');
 *
 * 需在 Pinia 初始化（src/main.ts 中已提前初始化）后调用。
 */
let _toastStore: ReturnType<typeof useToastStore> | null = null;

export function showToast(
  message: string,
  type: ToastItem['type'] = 'info',
  duration = 3000
): number {
  if (!_toastStore) {
    // Pinia 需先初始化（main.ts 已处理），这里直接获取当前活跃 store
    const pinia = (window as any).__VUE_PINIA__;
    if (!pinia) {
      console.warn('[LeLeTV Toast] Pinia 未就绪');
      return -1;
    }
    _toastStore = useToastStore();
  }
  return _toastStore.show(message, type, duration);
}
