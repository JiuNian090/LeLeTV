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
(function () {
    'use strict';

    // 已存在的全局变量适配器（getter 读取当前值，setter 写入当前值）
    var _adapter = {};

    // ==================== 配置 ====================

    /**
     * 选中的视频源列表
     * @type {string[]}
     */
    _adapter.selectedAPIs = [];

    /**
     * 自定义视频源列表
     * @type {Array}
     */
    _adapter.customAPIs = [];

    // ==================== 播放器 ====================

    /**
     * 播放器管理器实例引用
     * PlayerManager 在 js/player/player-manager.js 中定义
     */
    _adapter.player = null;

    // ==================== 搜索状态 ====================

    /**
     * 搜索相关状态
     */
    _adapter.search = {
        /** @type {string} 当前激活的源过滤标签 */
        activeSourceFilter: 'all',

        /** @type {Array} 最后一批完整搜索结果 */
        lastAllResults: [],

        /** @type {boolean} 搜索框是否就绪 */
        ready: false,

        /** @type {boolean} 搜索节流锁 */
        throttled: false,

        /** @type {boolean} 隐藏内容过滤是否启用 */
        hiddenFilterEnabled: true
    };

    // ==================== 缓存/存储服务占位 ====================

    /**
     * 存储服务（将在 storage-service.js 中实现）
     */
    _adapter.storage = null;

    // ==================== 工具 ====================

    /**
     * ListenerTracker 构造函数引用
     */
    _adapter.ListenerTracker = null;

    /**
     * 显示 Toast 消息
     * @param {string} message
     * @param {string} [type='error']
     * @param {number} [duration=3000]
     */
    _adapter.showToast = function (message, type, duration) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type, duration);
        }
    };

    /**
     * 加载完成回调
     */
    _adapter.onReady = function (fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    };

    // ==================== 注册到 window ====================
    window.LeLeTV = _adapter;

    // 同步关键全局变量引用（向后兼容）
    Object.defineProperty(window.LeLeTV, 'selectedAPIs', {
        get: function () {
            return typeof window.selectedAPIs !== 'undefined' ? window.selectedAPIs : [];
        },
        set: function (v) {
            window.selectedAPIs = v;
        },
        configurable: true
    });

    Object.defineProperty(window.LeLeTV, 'customAPIs', {
        get: function () {
            return typeof window.customAPIs !== 'undefined' ? window.customAPIs : [];
        },
        set: function (v) {
            window.customAPIs = v;
        },
        configurable: true
    });

    // 同步 PlayerManager
    Object.defineProperty(window.LeLeTV, 'player', {
        get: function () {
            return typeof PlayerManager !== 'undefined' ? PlayerManager : null;
        },
        set: function (v) {
            // 只读属性
        },
        configurable: true
    });

    // 同步 ListenerTracker
    Object.defineProperty(window.LeLeTV, 'ListenerTracker', {
        get: function () {
            return typeof ListenerTracker !== 'undefined' ? ListenerTracker : null;
        },
        set: function (v) {
            // 只读属性
        },
        configurable: true
    });

})();
