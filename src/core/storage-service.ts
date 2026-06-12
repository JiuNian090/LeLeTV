/**
 * StorageService — 统一存储服务
 *
 * 集中管理所有 localStorage 键名和读写操作，消除散落的硬编码字符串。
 *
 * 使用方式：
 *   StorageService.set(StorageKeys.VIEWING_HISTORY, data)
 *   StorageService.getJSON(StorageKeys.VIEWING_HISTORY, [])
 *   StorageService.setSelectedAPIs(['tyyszy', 'bfzy'])
 */

// ==================== 键名常量 ====================

export const StorageKeys = {
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
  LAST_ACCEPTED_DISCLAIMER: 'lastAcceptedDisclaimer',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

// ==================== 存储服务 ====================

interface StorageServiceType {
  // 通用方法
  get(key: string, defaultValue?: string | null): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;

  // 类型化方法
  getJSON<T = unknown>(key: string, defaultValue?: T): T | null;
  setJSON(key: string, value: unknown): void;
  getBool(key: string, defaultValue?: boolean): boolean;
  getInt(key: string, defaultValue?: number): number;

  // 命名访问器
  getSelectedAPIs(): string[];
  setSelectedAPIs(apis: string[]): void;
  getCustomAPIs(): Record<string, unknown>[];
  setCustomAPIs(apis: Record<string, unknown>[]): void;
  getViewingHistory(): Record<string, unknown>[];
  setViewingHistory(history: Record<string, unknown>[]): void;
  getSearchHistory(): string[];
  setSearchHistory(history: string[]): void;
  getCurrentVideoInfo(): Record<string, unknown> | null;
  setCurrentVideoInfo(info: Record<string, unknown>): void;
  isHiddenFilterEnabled(): boolean;
}

export const StorageService: StorageServiceType = {
  // ---- 通用方法 ----

  get(key: string, defaultValue?: string | null): string | null {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? value : (defaultValue !== undefined ? defaultValue : null);
    } catch (e) {
      console.warn('StorageService.get 失败:', e);
      return defaultValue !== undefined ? defaultValue : null;
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {
      console.warn('StorageService.set 失败:', e);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('StorageService.remove 失败:', e);
    }
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('StorageService.clear 失败:', e);
    }
  },

  // ---- 类型化方法 ----

  getJSON<T = unknown>(key: string, defaultValue?: T): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue !== undefined ? defaultValue : null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn('StorageService.getJSON 解析失败:', key, e);
      return defaultValue !== undefined ? defaultValue : null;
    }
  },

  setJSON(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('StorageService.setJSON 失败:', e);
    }
  },

  getBool(key: string, defaultValue?: boolean): boolean {
    const raw = this.get(key);
    if (raw === null) return defaultValue !== undefined ? defaultValue : false;
    return raw === 'true';
  },

  getInt(key: string, defaultValue?: number): number {
    const raw = this.get(key);
    if (raw === null) return defaultValue !== undefined ? defaultValue : 0;
    const num = parseInt(raw, 10);
    return isNaN(num) ? (defaultValue !== undefined ? defaultValue : 0) : num;
  },

  // ---- 常用数据的命名访问器 ----

  getSelectedAPIs(): string[] {
    const raw = localStorage.getItem(StorageKeys.SELECTED_APIS);
    if (raw === null) return [];
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  },

  setSelectedAPIs(apis: string[]): void {
    this.setJSON(StorageKeys.SELECTED_APIS, apis);
  },

  getCustomAPIs(): Record<string, unknown>[] {
    const raw = localStorage.getItem(StorageKeys.CUSTOM_APIS);
    if (raw === null) return [];
    try { return JSON.parse(raw) as Record<string, unknown>[]; } catch { return []; }
  },

  setCustomAPIs(apis: Record<string, unknown>[]): void {
    this.setJSON(StorageKeys.CUSTOM_APIS, apis);
  },

  getViewingHistory(): Record<string, unknown>[] {
    const raw = localStorage.getItem(StorageKeys.VIEWING_HISTORY);
    if (raw === null) return [];
    try { return JSON.parse(raw) as Record<string, unknown>[]; } catch { return []; }
  },

  setViewingHistory(history: Record<string, unknown>[]): void {
    this.setJSON(StorageKeys.VIEWING_HISTORY, history);
  },

  getSearchHistory(): string[] {
    const raw = localStorage.getItem(StorageKeys.SEARCH_HISTORY);
    if (raw === null) return [];
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  },

  setSearchHistory(history: string[]): void {
    this.setJSON(StorageKeys.SEARCH_HISTORY, history);
  },

  getCurrentVideoInfo(): Record<string, unknown> | null {
    const raw = localStorage.getItem(StorageKeys.CURRENT_VIDEO_INFO);
    if (raw === null) return null;
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  },

  setCurrentVideoInfo(info: Record<string, unknown>): void {
    this.setJSON(StorageKeys.CURRENT_VIDEO_INFO, info);
  },

  isHiddenFilterEnabled(): boolean {
    return this.getBool(StorageKeys.HIDDEN_FILTER_ENABLED, true);
  },
};
