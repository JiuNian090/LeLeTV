/**
 * PlayerManager — 播放器生命周期管理器
 *
 * 集中管理 ArtPlayer + HLS.js 的创建、销毁和定时器清理。
 */

import { ListenerTracker } from '../../core/listener-tracker';

// ==================== 类型定义 ====================

declare const Hls: any;
declare const art: any;
declare const currentHls: any;

// ==================== 播放器管理器 ====================

export const PlayerManager = {
  _art: null as any | null,
  _hls: null as any | null,
  _intervals: [] as number[],
  _timeouts: [] as number[],
  _tracker: null as ListenerTracker | null,

  /** 获取 ArtPlayer 实例 */
  getInstance(): any | null {
    return this._art;
  },

  /** 获取 Hls 实例 */
  getHlsInstance(): any | null {
    return this._hls;
  },

  /** 设置 ArtPlayer 实例 */
  setInstance(instance: any | null): void {
    this._art = instance;
  },

  /** 设置 Hls 实例（自动销毁旧实例） */
  setHlsInstance(instance: any | null): void {
    if (this._hls && this._hls !== instance) {
      try {
        this._hls.destroy();
      } catch {
        /* 静默 */
      }
    }
    this._hls = instance;
    // 同步全局变量（向后兼容）
    if (typeof currentHls !== 'undefined') {
      (window as any).currentHls = instance;
    }
  },

  /** 获取或创建 ListenerTracker 实例 */
  getTracker(): ListenerTracker | null {
    if (!this._tracker && typeof ListenerTracker !== 'undefined') {
      this._tracker = new ListenerTracker();
    }
    return this._tracker;
  },

  /** 销毁当前播放器 */
  destroy(): void {
    // 销毁 ArtPlayer
    if (this._art) {
      try {
        this._art.destroy(true);
      } catch (e) {
        console.warn('PlayerManager: ArtPlayer 销毁时出错:', e);
      }
      this._art = null;
    }

    // 同步全局变量
    if (typeof art !== 'undefined') {
      (window as any).art = null;
    }

    // 销毁 HLS
    if (this._hls) {
      try {
        this._hls.destroy();
      } catch {
        /* 静默 */
      }
      this._hls = null;
    }

    // 清理事件监听器
    if (this._tracker) {
      this._tracker.removeAll();
      this._tracker = null;
    }

    this._clearAllTimers();
  },

  /** 追踪 interval ID */
  trackInterval(id: number | null | undefined): number | null | undefined {
    if (id != null) {
      this._intervals.push(id);
    }
    return id;
  },

  /** 追踪 timeout ID */
  trackTimeout(id: number | null | undefined): number | null | undefined {
    if (id != null) {
      this._timeouts.push(id);
    }
    return id;
  },

  /** 清空所有定时器 */
  _clearAllTimers(): void {
    this._intervals.forEach((id: number) => {
      try {
        clearInterval(id);
      } catch {
        /* 静默 */
      }
    });
    this._intervals = [];

    this._timeouts.forEach((id: number) => {
      try {
        clearTimeout(id);
      } catch {
        /* 静默 */
      }
    });
    this._timeouts = [];
  },
};
