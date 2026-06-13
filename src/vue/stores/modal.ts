/**
 * Pinia Store — 模态框
 *
 * 管理全局模态框状态。支持自定义标题、内容和回调。
 */

import { defineStore } from 'pinia';
import { ref, type Component } from 'vue';

export interface ModalOptions {
  title: string;
  content: string | Component;
  onClose?: () => void;
}

export const useModalStore = defineStore('modal', () => {
  const isOpen = ref(false);
  const title = ref('');
  const content = ref<string | Component>('');
  const onCloseCallback = ref<(() => void) | null>(null);

  function open(options: ModalOptions): void {
    title.value = options.title;
    content.value = options.content;
    onCloseCallback.value = options.onClose || null;
    isOpen.value = true;
  }

  function close(): void {
    isOpen.value = false;
    if (onCloseCallback.value) {
      onCloseCallback.value();
      onCloseCallback.value = null;
    }
  }

  return { isOpen, title, content, open, close };
});
