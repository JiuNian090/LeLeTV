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

const PlayerManager = {
    _art: null,
    _hls: null,
    _intervals: [],
    _timeouts: [],
    _tracker: null,

    /** @returns {Artplayer|null} */
    getInstance() {
        return this._art;
    },

    /** @returns {Hls|null} */
    getHlsInstance() {
        return this._hls;
    },

    /**
     * @param {Artplayer|null} instance
     */
    setInstance(instance) {
        this._art = instance;
    },

    /**
     * @param {Hls|null} instance
     */
    setHlsInstance(instance) {
        // 销毁旧的 HLS 实例
        if (this._hls && this._hls !== instance) {
            try { this._hls.destroy(); } catch (e) { /* 静默处理 */ }
        }
        this._hls = instance;
    },

    /**
     * 获取或创建 ListenerTracker 实例
     * @returns {Object}
     */
    getTracker() {
        if (!this._tracker && typeof ListenerTracker !== 'undefined') {
            this._tracker = new ListenerTracker();
        }
        return this._tracker;
    },

    /**
     * 销毁当前播放器（ArtPlayer + HLS + 清理所有定时器和事件）
     */
    destroy() {
        // 销毁 ArtPlayer
        if (this._art) {
            try {
                this._art.destroy(true);
            } catch (e) {
                console.warn('PlayerManager: ArtPlayer 销毁时出错:', e);
            }
            this._art = null;
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

        this._clearAllTimers();
    },

    /**
     * 追踪一个 interval ID（销毁时自动清理）
     * @param {number|null|undefined} id
     * @returns {number|null|undefined}
     */
    trackInterval(id) {
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
    trackTimeout(id) {
        if (id != null) {
            this._timeouts.push(id);
        }
        return id;
    },

    /** 清空所有追踪的定时器 */
    _clearAllTimers() {
        this._intervals.forEach(function (id) {
            try { clearInterval(id); } catch (e) { /* 静默处理 */ }
        });
        this._intervals = [];

        this._timeouts.forEach(function (id) {
            try { clearTimeout(id); } catch (e) { /* 静默处理 */ }
        });
        this._timeouts = [];
    }
};
