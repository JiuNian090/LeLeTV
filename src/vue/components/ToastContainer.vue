<template>
  <!-- Toast 容器 — 固定在屏幕底部，多条消息堆叠 -->
  <div class="toast-container">
    <TransitionGroup name="toast" tag="div" class="toast-list">
      <div
        v-for="item in toasts"
        :key="item.id"
        :class="['toast-item', `toast-${item.type}`]"
        @click="dismiss(item.id)"
      >
        <span class="toast-icon">{{ iconFor(item.type) }}</span>
        <span class="toast-message">{{ item.message }}</span>
        <button class="toast-close" @click.stop="dismiss(item.id)">&times;</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
/**
 * ToastContainer.vue — 全局 Toast 通知容器
 *
 * 支持 success / error / info / warning 四种类型，
 * 多条消息堆叠显示，自动消失，入场/出场动画。
 */

import { computed } from 'vue';
import { useToastStore, type ToastItem } from '../stores/toast';

const toastStore = useToastStore();

const toasts = computed(() => toastStore.toasts);

function dismiss(id: number): void {
  toastStore.dismiss(id);
}

function iconFor(type: ToastItem['type']): string {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
    default: return 'ℹ';
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: auto;
  max-width: 90vw;
}

.toast-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.55rem 1.25rem;
  border-radius: 999px;
  font-size: 0.9rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  cursor: pointer;
  max-width: 100%;
  word-break: break-word;
}

.toast-item.toast-success {
  background: rgba(34, 197, 94, 0.85);
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.toast-item.toast-error {
  background: rgba(239, 68, 68, 0.85);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.toast-item.toast-warning {
  background: rgba(234, 179, 8, 0.85);
  border: 1px solid rgba(234, 179, 8, 0.3);
}
.toast-item.toast-info {
  background: rgba(40, 40, 40, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.toast-icon {
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 700;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}

.toast-message {
  flex: 1;
  text-align: center;
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 0 0 4px;
  line-height: 1;
}
.toast-close:hover {
  color: white;
}

/* TransitionGroup 动画 */
.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.8);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.8);
}

/* 响应式 */
@media (max-width: 640px) {
  .toast-container {
    bottom: 4rem;
    max-width: 95vw;
  }
  .toast-item {
    font-size: 0.85rem;
    padding: 0.5rem 1rem;
  }
}
</style>
