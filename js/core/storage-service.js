/**
 * StorageService — 统一存储服务
 *
 * 集中管理所有 localStorage 键名和读写操作，消除散落的硬编码字符串。
 * 挂载到 LeLeTV.storage，新代码优先使用此模块。
 *
 * 使用方式：
 *   StorageService.set(StorageKeys.VIEWING_HISTORY, data)
 *   StorageService.getJSON(StorageKeys.VIEWING_HISTORY, [])
 *   StorageService.setSelectedAPIs(['tyyszy', 'bfzy'])
 *
 * 迁移说明：
 *   逐步替换 localStorage.getItem/setItem 为 StorageService 方法。
 *   旧代码继续有效，不破坏现有功能。
 */

// ==================== 键名常量 ====================

const StorageKeys = {
    // ---- API/Source 配置 ----
    SELECTED_APIS: 'selectedAPIs',
    CUSTOM_APIS: 'customAPIs',
    DATA_SOURCE_LOGIC_VERSION: 'dataSourceLogicVersion',
    HAS_USER_SELECTED_APIS: 'hasUserSelectedAPIs',
    LAST_REFRESH_TIME: 'lastRefreshTime',
    HIDDEN_FILTER_ENABLED: 'hiddenFilterEnabled',

    // ---- 播放器状态 ----
    CURRENT_VIDEO_TITLE: 'currentVideoTitle',
    CURRENT_EPISODES: 'currentEpisodes',
    CURRENT_EPISODE_INDEX: 'currentEpisodeIndex',
    CURRENT_SOURCE_CODE: 'currentSourceCode',
    CURRENT_VIDEO_INFO: 'currentVideoInfo',
    CURRENT_PLAYING_ID: 'currentPlayingId',
    CURRENT_PLAYING_SOURCE: 'currentPlayingSource',
    EPISODES_REVERSED: 'episodesReversed',
    LAST_PLAY_TIME: 'lastPlayTime',
    LAST_SEARCH_PAGE: 'lastSearchPage',
    LAST_PAGE_URL: 'lastPageUrl',

    // ---- 播放设置 ----
    AUTOPLAY_ENABLED: 'autoplayEnabled',
    AD_FILTER_ENABLED: 'adFilteringEnabled',

    // ---- 认证 ----
    PASSWORD_VERIFIED: 'passwordVerified',
    PASSWORD_HASH: 'passwordHash',
    PROXY_AUTH_HASH: 'proxyAuthHash',
    USER_PASSWORD: 'userPassword',

    // ---- 历史记录 ----
    VIEWING_HISTORY: 'viewingHistory',
    SEARCH_HISTORY: 'videoSearchHistory',

    // ---- 负载均衡/缓存 ----
    LOAD_BALANCER_STATS: 'loadBalancerStats',

    // ---- 版本/初始化 ----
    HAS_INITIALIZED_DEFAULTS: 'hasInitializedDefaults',
    LAST_VERSION: 'leletv_last_version',
    UPDATING: 'leletv_updating',

    // ---- 其他 ----
    LAST_ACCEPTED_DISCLAIMER: 'lastAcceptedDisclaimer'
};

// ==================== 存储服务 ====================

const StorageService = {

    // ---- 通用方法 ----

    /**
     * 读取字符串值
     * @param {string} key
     * @param {string|null} [defaultValue=null]
     * @returns {string|null}
     */
    get: function (key, defaultValue) {
        try {
            var value = localStorage.getItem(key);
            return value !== null ? value : (defaultValue !== undefined ? defaultValue : null);
        } catch (e) {
            console.warn('StorageService.get 失败:', e);
            return defaultValue !== undefined ? defaultValue : null;
        }
    },

    /**
     * 写入字符串值
     * @param {string} key
     * @param {string} value
     */
    set: function (key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (e) {
            console.warn('StorageService.set 失败:', e);
        }
    },

    /**
     * 删除指定键
     * @param {string} key
     */
    remove: function (key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('StorageService.remove 失败:', e);
        }
    },

    /**
     * 清空所有 localStorage
     */
    clear: function () {
        try {
            localStorage.clear();
        } catch (e) {
            console.warn('StorageService.clear 失败:', e);
        }
    },

    // ---- 类型化方法 ----

    /**
     * 读取并解析 JSON
     * @param {string} key
     * @param {*} [defaultValue=null]
     * @returns {*}
     */
    getJSON: function (key, defaultValue) {
        try {
            var raw = localStorage.getItem(key);
            if (raw === null) return defaultValue !== undefined ? defaultValue : null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('StorageService.getJSON 解析失败:', key, e);
            return defaultValue !== undefined ? defaultValue : null;
        }
    },

    /**
     * 写入 JSON 值
     * @param {string} key
     * @param {*} value
     */
    setJSON: function (key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('StorageService.setJSON 失败:', e);
        }
    },

    /**
     * 读取布尔值（支持 'true'/'false' 字符串）
     * @param {string} key
     * @param {boolean} [defaultValue=false]
     * @returns {boolean}
     */
    getBool: function (key, defaultValue) {
        var raw = this.get(key);
        if (raw === null) return defaultValue !== undefined ? defaultValue : false;
        return raw === 'true';
    },

    /**
     * 读取整数
     * @param {string} key
     * @param {number} [defaultValue=0]
     * @returns {number}
     */
    getInt: function (key, defaultValue) {
        var raw = this.get(key);
        if (raw === null) return defaultValue !== undefined ? defaultValue : 0;
        var num = parseInt(raw, 10);
        return isNaN(num) ? (defaultValue !== undefined ? defaultValue : 0) : num;
    },

    // ---- 常用数据的命名访问器 ----

    /** @returns {string[]} */
    getSelectedAPIs: function () {
        return this.getJSON(StorageKeys.SELECTED_APIS, []);
    },

    /** @param {string[]} apis */
    setSelectedAPIs: function (apis) {
        this.setJSON(StorageKeys.SELECTED_APIS, apis);
    },

    /** @returns {Array} */
    getCustomAPIs: function () {
        return this.getJSON(StorageKeys.CUSTOM_APIS, []);
    },

    /** @param {Array} apis */
    setCustomAPIs: function (apis) {
        this.setJSON(StorageKeys.CUSTOM_APIS, apis);
    },

    /** @returns {Array} */
    getViewingHistory: function () {
        return this.getJSON(StorageKeys.VIEWING_HISTORY, []);
    },

    /** @param {Array} history */
    setViewingHistory: function (history) {
        this.setJSON(StorageKeys.VIEWING_HISTORY, history);
    },

    /** @returns {Array} */
    getSearchHistory: function () {
        return this.getJSON(StorageKeys.SEARCH_HISTORY, []);
    },

    /** @param {Array} history */
    setSearchHistory: function (history) {
        this.setJSON(StorageKeys.SEARCH_HISTORY, history);
    },

    /** @returns {Object|null} */
    getCurrentVideoInfo: function () {
        return this.getJSON(StorageKeys.CURRENT_VIDEO_INFO, null);
    },

    /** @param {Object} info */
    setCurrentVideoInfo: function (info) {
        this.setJSON(StorageKeys.CURRENT_VIDEO_INFO, info);
    },

    /** @returns {boolean} */
    isHiddenFilterEnabled: function () {
        return this.getBool(StorageKeys.HIDDEN_FILTER_ENABLED, true);
    }
};

// ==================== 注册到 LeLeTV ====================

if (typeof window.LeLeTV !== 'undefined') {
    window.LeLeTV.storage = StorageService;
    window.LeLeTV.StorageKeys = StorageKeys;
}
