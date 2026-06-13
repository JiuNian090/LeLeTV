/**
 * LeLeTV Vue 应用入口
 *
 * 绞杀者模式入口：Vue 组件渐进式替换原生 UI。
 * 本模块初始化全局 Pinia store，挂载全局组件（Toast、Modal），
 * 导出 mountVueComponent 辅助函数供各面板使用。
 */

import { createApp } from 'vue';
import { mountVueComponent, getPinia } from './setup';
import App from './App.vue';
import NavBar from './components/NavBar.vue';
import router from './router';

// 初始化全局 Pinia
const pinia = getPinia();

// 挂载根组件（包含全局浮动组件：ToastContainer、ModalContainer）
const globalMountId = 'vue-globals';
let mountEl = document.getElementById(globalMountId);
if (!mountEl) {
  mountEl = document.createElement('div');
  mountEl.id = globalMountId;
  document.body.appendChild(mountEl);
}
const rootApp = createApp(App);
rootApp.use(pinia);
rootApp.use(router);
rootApp.mount(mountEl);

// 挂载导航栏（替换原生 nav.top-nav-bar 内容）
const navEl = document.querySelector('nav.top-nav-bar');
if (navEl) {
  const navApp = createApp(NavBar);
  navApp.use(pinia);
  navApp.use(router);
  navApp.mount(navEl);
}

export { mountVueComponent, getPinia };

// 导出所有 store
export { useSettingsStore } from './stores/settings';
export { useToastStore } from './stores/toast';
export { useModalStore } from './stores/modal';
export { useSearchStore } from './stores/search';
