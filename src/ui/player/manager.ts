/**
 * PlayerManager — 播放器生命周期管理器
 *
 * 集中管理 ArtPlayer + HLS.js 的创建、销毁和定时器清理。
 * 保留全局 `art` 变量向后兼容（约 90 处引用），后续可逐步迁移到 getInstance()。
 *
 * 职责：
 *   - 统一销毁 ArtPlayer 和 HLS 实例
 *   - 追踪并清理 interval / timeout 定时器
 *   - 为未来播放器实例无全局化提供接入点
 */

import { setArt, setCurrentHls } from './state';
import { ListenerTracker } from '../../core/listener-tracker';

interface PlayerManagerArt extends ArtplayerInstance {
    destroy?: (removeDom?: boolean) => void;
}

export const PlayerManager = {
    _art: null as PlayerManagerArt | null,
    _hls: null as HlsInstance | null,
    _intervals: [] as number[],
    _timeouts: [] as number[],
    _tracker: null as ListenerTracker | null,

    /** @returns {Artplayer|null} */
    getInstance(): PlayerManagerArt | null {
        return this._art;
    },

    /** @returns {Hls|null} */
    getHlsInstance(): HlsInstance | null {
        return this._hls;
    },

    /**
     * @param {Artplayer|null} instance
     */
    setInstance(instance: PlayerManagerArt | null): void {
        this._art = instance;
    },

    /**
     * @param {Hls|null} instance
     */
    setHlsInstance(instance: HlsInstance | null): void {
        // 销毁旧的 HLS 实例
        if (this._hls && this._hls !== instance) {
            try { this._hls.destroy(); } catch (e) { /* 静默处理 */ }
        }
        this._hls = instance;
        // 同步全局变量（向后兼容，旧代码仍读取 currentHls）
        if (typeof currentHls !== 'undefined') {
            setCurrentHls(instance);
        }
    },

    /**
     * 获取或创建 ListenerTracker 实例
     * @returns {Object}
     */
    getTracker(): ListenerTracker | null {
        if (!this._tracker && typeof ListenerTracker !== 'undefined') {
            this._tracker = new ListenerTracker();
        }
        return this._tracker;
    },

    /**
     * 销毁当前播放器（ArtPlayer + HLS + 清理所有定时器和事件）
     */
    destroy(): void {
        // 销毁 ArtPlayer
        if (this._art) {
            try {
                this._art.destroy?.(true);
            } catch (e) {
                console.warn('PlayerManager: ArtPlayer 销毁时出错:', e);
            }
            this._art = null;
        }

        // 同步全局变量
        if (typeof art !== 'undefined') {
            setArt(null);
        }

        // 销毁 HLS
        if (this._hls) {
            try {
                this._hls.destroy();
            } catch (e) {
                // 静默处理
            }
            this._hls = null;
        }

        // 清理事件监听器
        if (this._tracker) {
            this._tracker.removeAll();
            this._tracker = null;
        }

        // 清理自定义 overlay（setupControlsBehavior 创建）
        const overlay = document.querySelector('.player-click-overlay');
        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }

        // 清理长按播放的右键菜单禁用（setupLongPressSpeedControl 设置）
        const playerEl = document.getElementById('player');
        if (playerEl) {
            playerEl.oncontextmenu = null;
        }

        this._clearAllTimers();
    },

    /**
     * 追踪一个 interval ID（销毁时自动清理）
     * @param {number|null|undefined} id
     * @returns {number|null|undefined}
     */
    trackInterval(id: number | null | undefined): number | null | undefined {
        if (id != null) {
            this._intervals.push(id);
        }
        return id;
    },

    /**
     * 追踪一个 timeout ID（销毁时自动清理）
     * @param {number|null|undefined} id
     * @returns {number|null|undefined}
     */
    trackTimeout(id: number | null | undefined): number | null | undefined {
        if (id != null) {
            this._timeouts.push(id);
        }
        return id;
    },

    /** 清空所有追踪的定时器 */
    _clearAllTimers(): void {
        this._intervals.forEach(function (id: number) {
            try { clearInterval(id); } catch (e) { /* 静默处理 */ }
        });
        this._intervals = [];

        this._timeouts.forEach(function (id: number) {
            try { clearTimeout(id); } catch (e) { /* 静默处理 */ }
        });
        this._timeouts = [];
    }
};

// 阶段 5A-6 过渡期兼容桥：player bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  PlayerManager
});

// 阶段 5B-3 过渡期类型桥：manager.ts 已成为 ESM 模块，尚未改为 import 的模块
// 仍以裸名访问。
type PlayerManagerApi = typeof PlayerManager;
declare global {
  const PlayerManager: PlayerManagerApi;
}
