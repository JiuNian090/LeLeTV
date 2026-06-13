<template>
  <!-- 根组件：全局浮动组件和面板容器 -->
  <div id="vue-root" class="vue-root">
    <!-- 全局浮动组件（始终渲染） -->
    <ToastContainer />
    <ModalContainer />
  </div>
</template>

<script setup lang="ts">
/**
 * App.vue — Vue 根组件
 *
 * 管理全局浮动组件（Toast、Modal），
 * 面板组件通过对应的 DOM 容器逐步挂载。
 */

import ToastContainer from './components/ToastContainer.vue';
import ModalContainer from './components/ModalContainer.vue';
</script>

<style scoped>
.vue-root {
  position: static;
}
</style>
