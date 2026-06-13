/**
 * LeLeTV Vue 渐进式迁移 — 共享设置
 *
 * 提供全局 Pinia 实例和 mountVueComponent 辅助函数，
 * 每个 Vue 组件独立挂载到指定 DOM 容器（绞杀者模式）。
 *
 * 所有组件共享同一 Pinia store，实现状态同步。
 */

import { createApp, type Component } from 'vue';
import { createPinia, type Pinia } from 'pinia';

/** 全局 Pinia 实例 */
let _pinia: Pinia | null = null;

/**
 * 获取或创建全局 Pinia 实例
 */
export function getPinia(): Pinia {
  if (!_pinia) {
    _pinia = createPinia();
    (window as any).__VUE_PINIA__ = _pinia;
  }
  return _pinia;
}

/**
 * 将一个 Vue 组件挂载到指定容器
 * @param component Vue 组件
 * @param selector CSS 选择器或 HTMLElement
 * @returns Vue 应用实例（可用于 unmount）
 */
export function mountVueComponent(
  component: Component,
  selector: string | HTMLElement
): ReturnType<typeof createApp> {
  const container = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector;

  if (!container) {
    console.warn(`[LeLeTV Vue] 容器 "${selector}" 不存在，跳过挂载`);
    return null as unknown as ReturnType<typeof createApp>;
  }

  const app = createApp(component);
  app.use(getPinia());
  app.mount(container as HTMLElement);

  console.log(`[LeLeTV Vue] 组件已挂载到`, selector);
  return app;
}
