/**
 * LeLeTV 全局适配器 — 统一命名空间
 *
 * 将所有跨模块访问的变量/函数集中到 window.LeLeTV 下，
 * 为后续模块化迁移做准备。
 *
 * 迁移完成后将逐步缩小此模块的作用域。
 */

import { ListenerTracker } from './listener-tracker';

// ==================== 类型定义 ====================

export interface LeLeTVNamespace {
  /** 选中的视频源列表 */
  selectedAPIs: string[];
  /** 自定义视频源列表 */
  customAPIs: Record<string, unknown>[];
  /** 播放器管理器实例 */
  player: unknown | null;
  /** 搜索相关状态 */
  search: {
    activeSourceFilter: string;
    lastAllResults: unknown[];
    ready: boolean;
    throttled: boolean;
    hiddenFilterEnabled: boolean;
  };
  /** 存储服务 */
  storage: Record<string, unknown> | null;
  /** ListenerTracker 构造函数 */
  ListenerTracker: typeof ListenerTracker | null;
  /** 显示 Toast 消息 */
  showToast: (message: string, type?: string, duration?: number) => void;
  /** 加载完成回调 */
  onReady: (fn: () => void) => void;
  /** TIMING 常量 */
  TIMING?: Record<string, number>;
  /** AppInit */
  AppInit?: Record<string, unknown>;
  /** StorageKeys 常量 */
  StorageKeys?: Record<string, string>;
}

// ==================== 初始化全局适配器 ====================

export function initLeLeTVGlobal(): LeLeTVNamespace {
  const adapter: LeLeTVNamespace = {
    selectedAPIs: [],
    customAPIs: [],

    player: null,

    search: {
      activeSourceFilter: 'all',
      lastAllResults: [],
      ready: false,
      throttled: false,
      hiddenFilterEnabled: true,
    },

    storage: null,
    ListenerTracker: null,

    showToast(message: string, type?: string, duration?: number) {
      if (typeof (window as any).showToast === 'function') {
        (window as any).showToast(message, type, duration);
      }
    },

    onReady(fn: () => void) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        fn();
      }
    },
  };

  // 注册到 window
  (window as any).LeLeTV = adapter;

  // 向后兼容：通过 getter/setter 同步全局变量
  Object.defineProperty(adapter, 'selectedAPIs', {
    get() {
      return typeof (window as any).selectedAPIs !== 'undefined'
        ? (window as any).selectedAPIs
        : [];
    },
    set(v: string[]) {
      (window as any).selectedAPIs = v;
    },
    configurable: true,
  });

  Object.defineProperty(adapter, 'customAPIs', {
    get() {
      return typeof (window as any).customAPIs !== 'undefined'
        ? (window as any).customAPIs
        : [];
    },
    set(v: Record<string, unknown>[]) {
      (window as any).customAPIs = v;
    },
    configurable: true,
  });

  Object.defineProperty(adapter, 'player', {
    get() {
      return typeof (window as any).PlayerManager !== 'undefined'
        ? (window as any).PlayerManager
        : null;
    },
    set(_v: unknown) {
      // 只读属性
    },
    configurable: true,
  });

  Object.defineProperty(adapter, 'ListenerTracker', {
    get() {
      return typeof (window as any).ListenerTracker !== 'undefined'
        ? (window as any).ListenerTracker
        : null;
    },
    set(_v: unknown) {
      // 只读属性
    },
    configurable: true,
  });

  return adapter;
}

// 自动初始化
initLeLeTVGlobal();
