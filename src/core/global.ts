/**
 * LeLeTV 全局适配器 — 统一命名空间
 *
 * 将所有跨模块访问的变量/函数挂载到此对象下，为后续模块化迁移做准备。
 * 现有全局变量（var/function 顶层声明）保持向后兼容。
 *
 * 迁移策略：
 *   1. 新代码优先使用 LeLeTV.xxx 而非全局变量
 *   2. 旧代码逐步迁移，每次迁移后验证功能
 *   3. 最终移除所有顶层 var/function 声明
 *
 * @namespace window.LeLeTV
 */

interface LeLeTVAdapter {
    selectedAPIs: string[];
    customAPIs: unknown[];
    player: unknown;
    search: {
        activeSourceFilter: string;
        lastAllResults: unknown[];
        ready: boolean;
        throttled: boolean;
        hiddenContentMode: boolean;
    };
    storage: unknown;
    ListenerTracker: unknown;
    showToast(message: string, type?: string, duration?: number): void;
    onReady(fn: () => void): void;
}

type LeLeTVWindow = Window & {
    LeLeTV?: LeLeTVAdapter;
    selectedAPIs?: string[];
    customAPIs?: unknown[];
    getCustomApiInfo?: (customApiIndex: string | number) => unknown;
    showToast?: (message: string, type?: string, duration?: number) => void;
};

(function () {
    'use strict';

    // 已存在的全局变量适配器（getter 读取当前值，setter 写入当前值）
    const _adapter: LeLeTVAdapter = {
        // ==================== 配置 ====================
        /** 选中的视频源列表 */
        selectedAPIs: [],
        /** 自定义视频源列表 */
        customAPIs: [],

        // ==================== 播放器 ====================
        /** 播放器管理器实例引用（PlayerManager 在 js/player/player-manager.js 中定义） */
        player: null,

        // ==================== 搜索状态 ====================
        search: {
            /** 当前激活的源过滤标签 */
            activeSourceFilter: 'all',
            /** 最后一批完整搜索结果 */
            lastAllResults: [],
            /** 搜索框是否就绪 */
            ready: false,
            /** 搜索节流锁 */
            throttled: false,
            /** 是否处于隐藏内容模式（决定当前数据域） */
            hiddenContentMode: false
        },

        // ==================== 缓存/存储服务占位 ====================
        /** 存储服务（将在 storage-service.js 中实现） */
        storage: null,

        // ==================== 工具 ====================
        /** ListenerTracker 构造函数引用 */
        ListenerTracker: null,

        /**
         * 显示 Toast 消息
         */
        showToast: function (message: string, type?: string, duration?: number): void {
            const toast = (window as LeLeTVWindow).showToast;
            if (typeof toast === 'function') {
                toast(message, type, duration);
            }
        },

        /**
         * 加载完成回调
         */
        onReady: function (fn: () => void): void {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', fn);
            } else {
                fn();
            }
        }
    };

    // ==================== 注册到 window ====================
    (window as LeLeTVWindow).LeLeTV = _adapter;

    // 同步关键全局变量引用（向后兼容）
    Object.defineProperty(_adapter, 'selectedAPIs', {
        get: function (): string[] {
            const value = (window as LeLeTVWindow).selectedAPIs;
            return typeof value !== 'undefined' ? value : [];
        },
        set: function (v: string[]): void {
            (window as LeLeTVWindow).selectedAPIs = v;
        },
        configurable: true
    });

    Object.defineProperty(_adapter, 'customAPIs', {
        get: function (): unknown[] {
            const value = (window as LeLeTVWindow).customAPIs;
            return typeof value !== 'undefined' ? value : [];
        },
        set: function (v: unknown[]): void {
            (window as LeLeTVWindow).customAPIs = v;
        },
        configurable: true
    });

    // ==================== 自定义API信息查询 ====================

    /**
     * 全局 getCustomApiInfo — 供搜索/播放各模块跨 bundle 使用。
     * 优先读取 window.customAPIs（由 js/api/api-config.js 注入），
     * 缺失时从 localStorage 兜底，确保 APP/PLAYER 两个 bundle 都能工作。
     */
    (window as LeLeTVWindow).getCustomApiInfo = function getCustomApiInfo(customApiIndex: string | number): unknown {
        let list: unknown = (window as LeLeTVWindow).customAPIs;
        if (typeof list === 'undefined' || !Array.isArray(list)) {
            try {
                list = JSON.parse(localStorage.getItem(scopedKey('customAPIs')) || '[]');
            } catch (e) {
                list = [];
            }
        }
        const items = list as unknown[];
        const index = parseInt(String(customApiIndex), 10);
        if (isNaN(index) || index < 0 || index >= items.length) {
            return null;
        }
        return items[index];
    };

    // 同步 PlayerManager
    Object.defineProperty(_adapter, 'player', {
        get: function (): unknown {
            return typeof PlayerManager !== 'undefined' ? PlayerManager : null;
        },
        set: function (v: unknown): void {
            // 只读属性
        },
        configurable: true
    });

    // 同步 ListenerTracker
    Object.defineProperty(_adapter, 'ListenerTracker', {
        get: function (): unknown {
            return typeof ListenerTracker !== 'undefined' ? ListenerTracker : null;
        },
        set: function (v: unknown): void {
            // 只读属性
        },
        configurable: true
    });

})();
