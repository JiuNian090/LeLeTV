/**
 * API 配置常量
 *
 * 集中管理所有 API 站点配置、搜索/详情参数、播放器配置等。
 * 从 js/core/config.js 提取的纯数据部分。
 */

// ==================== 站点配置 ====================

export interface ApiSiteConfig {
  api: string;
  name: string;
  hidden?: boolean;
  detail?: string;
}

/**
 * API 站点映射表
 * key: 站点标识符, value: 站点配置
 */
export const API_SITES: Record<string, ApiSiteConfig> = {
  bdzy: { api: 'https://api.apibdzy.com/api.php/provide/vod/', name: '百度资源' },
  moduzy: { api: 'https://caiji.moduapi.cc/api.php/provide/vod', name: '魔都资源' },
  zy360: { api: 'https://360zy.com/api.php/provide/vod', name: '360资源' },
  bfzy: { api: 'https://bfzyapi.com/api.php/provide/vod', name: '暴风资源' },
  dbzy: { api: 'https://dbzy.tv/api.php/provide/vod', name: '豆瓣资源' },
  zuid: { api: 'https://api.zuidapi.com/api.php/provide/vod', name: '最大资源' },
  wujin: { api: 'https://api.wujinapi.me/api.php/provide/vod', name: '无尽资源' },
  mtzy: { api: 'https://caiji.maotaizy.cc/api.php/provide/vod/at/josn', name: '茅台资源' },
  ikun: { api: 'https://ikunzyapi.com/api.php/provide/vod', name: 'iKun资源' },
  hnzy: { api: 'https://hongniuzy2.com/api.php/provide/vod', name: '红牛资源' },
  // 隐藏源
  ckzy: { api: 'https://ckzy.me/api.php/provide/vod', name: 'ck资源', hidden: true },
  fhzy: { api: 'http://fhapi9.com/api.php/provide/vod', name: 'fh资源', hidden: true },
  ywzy: { api: 'https://155api.com/api.php/provide/vod', name: '155资源', hidden: true },
  mdzy: { api: 'https://91md.me/api.php/provide/vod', name: 'md资源', hidden: true },
  kgzy: { api: 'https://jkunzyapi.com/api.php/provide/vod', name: 'kg资源', hidden: true },
  nxzy: { api: 'https://naixxzy.com/api.php/provide/vod', name: '奶香资源', hidden: true },
  lbzy: { api: 'https://lbapi9.com/api.php/provide/vod', name: 'lb资源', hidden: true },
};

/** 扩展/合并新的 API 站点 */
export function extendAPISites(newSites: Record<string, ApiSiteConfig>): void {
  Object.assign(API_SITES, newSites);
}

// ==================== 代理、搜索历史 ====================

/** 代理 URL 前缀 */
export const PROXY_URL = '/proxy/';

/** 搜索历史存储键名 */
export const SEARCH_HISTORY_KEY = 'videoSearchHistory';

/** 搜索历史最大条数 */
export const MAX_HISTORY_ITEMS = 5;

/** TMDB Worker URL（从环境变量读取） */
export function getTmdbWorkerUrl(): string {
  return window.__ENV__?.TMDB_WORKER_URL || '';
}

// ==================== 搜索/详情 API 参数配置 ====================

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}',
    maxPages: 3,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
} as const;

// ==================== 播放器配置 ====================

export const PLAYER_CONFIG = {
  autoplay: true,
  allowFullscreen: true,
  width: '100%',
  height: '600',
  timeout: 15000,
  filterAds: true,
  autoPlayNext: true,
  adFilteringEnabled: true,
  adFilteringStorage: 'adFilteringEnabled',
} as const;

// ==================== 聚合搜索配置 ====================

export const AGGREGATED_SEARCH_CONFIG = {
  enabled: true,
  timeout: 8000,
  maxResults: 10000,
  parallelRequests: true,
  showSourceBadges: true,
} as const;

// ==================== 错误消息 ====================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接错误，请检查网络设置',
  TIMEOUT_ERROR: '请求超时，服务器响应时间过长',
  API_ERROR: 'API接口返回错误，请尝试更换数据源',
  PLAYER_ERROR: '播放器加载失败，请尝试其他视频源',
  UNKNOWN_ERROR: '发生未知错误，请刷新页面重试',
} as const;

// ==================== 安全配置 ====================

export const SECURITY_CONFIG = {
  enableXSSProtection: true,
  sanitizeUrls: true,
  maxQueryLength: 100,
} as const;

// ==================== 自定义 API 配置 ====================

export const CUSTOM_API_CONFIG = {
  separator: ',',
  maxSources: 5,
  testTimeout: 5000,
  namePrefix: 'Custom-',
  validateUrl: true,
  cacheResults: true,
  cacheExpiry: 5184000000,
  hiddenPropName: 'isHidden',
} as const;

export const HIDE_BUILTIN_HIDDEN_APIS = false;

// ==================== 正则表达式 ====================

export const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g;

// ==================== 播放页 URL ====================

export const CUSTOM_PLAYER_URL = 'player.html';

// ==================== 密码配置 ====================

export const PASSWORD_CONFIG = {
  localStorageKey: 'passwordVerified',
  verificationTTL: 30 * 24 * 60 * 60 * 1000,
} as const;

// ==================== 站点信息 ====================

export const SITE_CONFIG = {
  name: 'LeLeTV',
  url: 'https://leletv.776645.xyz',
  description: '自用观影平台',
  logo: 'image/logo.png',
  version: '1.0.3',
  author: 'Jiunian',
} as const;
