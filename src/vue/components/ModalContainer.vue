<template>
  <!-- 模态框容器 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-box" :style="{ maxWidth: width }">
          <!-- 标题栏 -->
          <div class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close-btn" @click="close">&times;</button>
          </div>
          <!-- 内容区域 -->
          <div class="modal-body">
            <slot />
            <!-- 如果 content 是字符串，直接渲染 -->
            <div v-if="typeof content === 'string'" v-html="content"></div>
            <!-- 如果是组件，通过 component 动态渲染 -->
            <component v-else-if="content" :is="content" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * ModalContainer.vue — 全局模态框容器
 *
 * 通过 useModalStore 控制显隐。
 * 支持自定义标题、内容（字符串或组件）、宽度。
 * 淡入 + 缩放动画。
 */

import { computed } from 'vue';
import { useModalStore } from '../stores/modal';

const modalStore = useModalStore();

const isOpen = computed(() => modalStore.isOpen);
const title = computed(() => modalStore.title);
const content = computed(() => modalStore.content);
const width = computed(() => '500px');

function close(): void {
  modalStore.close();
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-box {
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #ec4899, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.modal-close-btn {
  background: none;
  border: none;
  color: #9CA3AF;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s;
}
.modal-close-btn:hover {
  color: white;
}

.modal-body {
  color: #D1D5DB;
  font-size: 0.9rem;
}

/* Transition 动画 */
.modal-enter-active {
  transition: all 0.25s ease-out;
}
.modal-leave-active {
  transition: all 0.2s ease-in;
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-box {
  transform: scale(0.9);
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-box {
  transform: scale(0.9);
}
</style>
