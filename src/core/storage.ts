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

// 阶段 5B-3：数据域键名解析改为显式 import。
import { scopedKey } from './state';

// ==================== 键名常量 ====================

const StorageKeys = {
    // ---- API/Source 配置 ----
    SELECTED_APIS: 'selectedAPIs',
    CUSTOM_APIS: 'customAPIs',
    DATA_SOURCE_LOGIC_VERSION: 'dataSourceLogicVersion',
    HAS_USER_SELECTED_APIS: 'hasUserSelectedAPIs',
    LAST_REFRESH_TIME: 'lastRefreshTime',
    HIDDEN_CONTENT_MODE: 'hiddenContentMode',

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
} as const;

// ==================== 存储服务 ====================

// 阶段 5B-3：观看历史类型下沉 core，供 ui/player 与 services 共用。
export interface ViewingHistoryItem {
    [key: string]: unknown;
    title: string;
    url: string;
    timestamp: number;
    episodeIndex?: number;
    sourceName?: string;
    sourceCode?: string;
    vod_id?: string | number;
    episodes?: string[];
    playbackPosition?: number;
    duration?: number;
    cover?: string;
    desc?: string;
    type?: string;
    year?: string;
    area?: string;
    director?: string;
    actor?: string;
    remarks?: string;
    showIdentifier?: string;
    directVideoUrl?: string;
    lastSyncTime?: number;
}

export const StorageService = {

    // ---- 通用方法 ----

    /**
     * 读取字符串值
     */
    get: function (key: string, defaultValue?: string | null): string | null {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? value : (defaultValue !== undefined ? defaultValue : null);
        } catch (e) {
            console.warn('StorageService.get 失败:', e);
            return defaultValue !== undefined ? defaultValue : null;
        }
    },

    /**
     * 写入字符串值
     */
    set: function (key: string, value: unknown): void {
        try {
            localStorage.setItem(key, String(value));
        } catch (e) {
            console.warn('StorageService.set 失败:', e);
        }
    },

    /**
     * 删除指定键
     */
    remove: function (key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('StorageService.remove 失败:', e);
        }
    },

    /**
     * 清空所有 localStorage
     */
    clear: function (): void {
        try {
            localStorage.clear();
        } catch (e) {
            console.warn('StorageService.clear 失败:', e);
        }
    },

    // ---- 类型化方法 ----

    /**
     * 读取并解析 JSON
     */
    getJSON: function <T>(key: string, defaultValue?: T): T {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return (defaultValue !== undefined ? defaultValue : null) as T;
            return JSON.parse(raw) as T;
        } catch (e) {
            console.warn('StorageService.getJSON 解析失败:', key, e);
            return (defaultValue !== undefined ? defaultValue : null) as T;
        }
    },

    /**
     * 写入 JSON 值
     */
    setJSON: function (key: string, value: unknown): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('StorageService.setJSON 失败:', e);
        }
    },

    /**
     * 读取布尔值（支持 'true'/'false' 字符串）
     */
    getBool: function (key: string, defaultValue?: boolean): boolean {
        const raw = StorageService.get(key);
        if (raw === null) return defaultValue !== undefined ? defaultValue : false;
        return raw === 'true';
    },

    /**
     * 读取整数
     */
    getInt: function (key: string, defaultValue?: number): number {
        const raw = StorageService.get(key);
        if (raw === null) return defaultValue !== undefined ? defaultValue : 0;
        const num = parseInt(raw, 10);
        return isNaN(num) ? (defaultValue !== undefined ? defaultValue : 0) : num;
    },

    // ---- 常用数据的命名访问器 ----

    // 注意：下列 4 类数据按当前数据域隔离（scopedKey）——隐藏模式下读写 hidden:: 前缀的键
    getSelectedAPIs: function (): string[] {
        return StorageService.getJSON<string[]>(scopedKey(StorageKeys.SELECTED_APIS), []);
    },

    setSelectedAPIs: function (apis: string[]): void {
        StorageService.setJSON(scopedKey(StorageKeys.SELECTED_APIS), apis);
    },

    getCustomAPIs: function (): unknown[] {
        return StorageService.getJSON<unknown[]>(scopedKey(StorageKeys.CUSTOM_APIS), []);
    },

    setCustomAPIs: function (apis: unknown[]): void {
        StorageService.setJSON(scopedKey(StorageKeys.CUSTOM_APIS), apis);
    },

    getViewingHistory: function (): unknown[] {
        return StorageService.getJSON<unknown[]>(scopedKey(StorageKeys.VIEWING_HISTORY), []);
    },

    setViewingHistory: function (history: unknown[]): void {
        StorageService.setJSON(scopedKey(StorageKeys.VIEWING_HISTORY), history);
    },

    getSearchHistory: function (): unknown[] {
        return StorageService.getJSON<unknown[]>(scopedKey(StorageKeys.SEARCH_HISTORY), []);
    },

    setSearchHistory: function (history: unknown[]): void {
        StorageService.setJSON(scopedKey(StorageKeys.SEARCH_HISTORY), history);
    },

    getCurrentVideoInfo: function (): Record<string, unknown> | null {
        return StorageService.getJSON<Record<string, unknown> | null>(StorageKeys.CURRENT_VIDEO_INFO, null);
    },

    setCurrentVideoInfo: function (info: Record<string, unknown>): void {
        StorageService.setJSON(StorageKeys.CURRENT_VIDEO_INFO, info);
    },

    /** 是否处于隐藏内容模式（决定当前数据域） */
    isHiddenContentMode: function (): boolean {
        return StorageService.getBool(StorageKeys.HIDDEN_CONTENT_MODE, false);
    }
};

// ==================== 注册到 LeLeTV ====================

type LeLeTVStorageHost = Window & {
    LeLeTV?: { storage?: unknown; StorageKeys?: typeof StorageKeys };
};

const leleTVHost = (window as LeLeTVStorageHost).LeLeTV;
if (typeof leleTVHost !== 'undefined') {
    leleTVHost.storage = StorageService;
    leleTVHost.StorageKeys = StorageKeys;
}

// 阶段 5A-3 过渡期兼容桥：core bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  StorageService
});

// 阶段 5B-3 过渡期类型桥：storage.ts 已成为 ESM 模块，尚未改为 import 的调用方
// 仍以裸名访问（运行时由上方 window 兼容桥提供）。
type StorageServiceApi = typeof StorageService;
type SharedViewingHistoryItem = {
  [key: string]: unknown;
  title: string;
  url: string;
  timestamp: number;
  episodeIndex?: number;
  sourceName?: string;
  sourceCode?: string;
  vod_id?: string | number;
  episodes?: string[];
  playbackPosition?: number;
  duration?: number;
  cover?: string;
  desc?: string;
  type?: string;
  year?: string;
  area?: string;
  director?: string;
  actor?: string;
  remarks?: string;
  showIdentifier?: string;
  directVideoUrl?: string;
  lastSyncTime?: number;
};
declare global {
  const StorageService: StorageServiceApi;
  type ViewingHistoryItem = SharedViewingHistoryItem;
}
