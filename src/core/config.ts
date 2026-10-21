// 阶段 5B-1：共享配置与数据域函数已迁至 src/core/state.ts。
// 这里保留 import + re-export，旧调用方的裸名 / window 访问继续可用。
import { API_SITES, extendAPISites, HIDDEN_MODE_KEY, isHiddenContentMode, scopedKey } from './state';
import type { ApiSite } from './state';

export { API_SITES, extendAPISites, HIDDEN_MODE_KEY, isHiddenContentMode, scopedKey };
export type { ApiSite };

type LeLeWindow = Window & {
    API_SITES?: Record<string, ApiSite>;
    extendAPISites?: (sites: Record<string, ApiSite>) => void;
    _sha256Available?: boolean;
    __ENV__?: { TMDB_WORKER_URL?: string };
};

// 全局常量配置
export const PROXY_URL = '/proxy/';    // 适用于 Cloudflare, Netlify (带重写), Vercel (带重写)
export const SEARCH_HISTORY_KEY = 'videoSearchHistory';
export const MAX_HISTORY_ITEMS = 5;

// 隐藏内容模式相关常量 / isHiddenContentMode / scopedKey 已迁至 src/core/state.ts

// TMDB Worker URL
// 部署 Cloudflare Worker (workers/tmdb-worker.js) 后填入自定义域名
// 留空则使用本地 Node.js 代理 /api/tmdb
export const TMDB_WORKER_URL = (window as LeLeWindow).__ENV__?.TMDB_WORKER_URL || '';

// SHA-256 兼容性检查（用于 invite-auth 管理员 token 计算）
(window as LeLeWindow)._sha256Available = typeof window.crypto?.subtle?.digest === 'function' || typeof (window as Window & { _jsSha256?: unknown })._jsSha256 === 'function';

// 网站信息配置
const SITE_CONFIG = {
    name: 'LeLeTV',
    url: 'https://leletv.776645.xyz',
    description: '自用观影平台',
    version: '1.0.3',
    author: 'Jiunian',
};

// API 站点配置 / extendAPISites 已迁至 src/core/state.ts（上方 import + re-export）

// 暴露到全局
(window as LeLeWindow).API_SITES = API_SITES;
(window as LeLeWindow).extendAPISites = extendAPISites;


// 添加聚合搜索的配置选项
export const AGGREGATED_SEARCH_CONFIG = {
    enabled: true,             // 是否启用聚合搜索
    timeout: 8000,            // 单个源超时时间（毫秒）
    maxResults: 10000,          // 最大结果数量
    parallelRequests: true,   // 是否并行请求所有源
    showSourceBadges: true    // 是否显示来源徽章
};

// 源延迟分级阈值（搜索结果页的延迟标注 与 播放页换源测速 共用同一套配色规则）
export const SOURCE_LATENCY_FAST_MS = 1000;   // < 1s  → 快（绿）
export const SOURCE_LATENCY_SLOW_MS = 2000;   // ≥ 2s  → 慢（红）；两者之间为 中（黄）

// 搜索结果提前退出：到达 CUTOFF_MS 时若已有 >= MIN_SOURCES 个源返回，就不再等待剩余源
export const SEARCH_EARLY_EXIT_CUTOFF_MS = 3000;
export const SEARCH_EARLY_EXIT_MIN_SOURCES = 3;

// 抽象API请求配置
export const API_CONFIG = {
    search: {
        // 只拼接参数部分，不再包含 /api.php/provide/vod/
        path: '?ac=videolist&wd=',
        pagePath: '?ac=videolist&wd={query}&pg={page}',
        maxPages: 3, // 最大获取页数（降低并发）
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    },
    detail: {
        // 只拼接参数部分
        path: '?ac=videolist&ids=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    }
};

// 优化后的正则表达式模式
export const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g;

// 添加自定义播放器URL
const CUSTOM_PLAYER_URL = 'src/pages/player/index.html'; // 使用相对路径引用本地src/pages/player/index.html

// 增加视频播放相关配置
export const PLAYER_CONFIG = {
    autoplay: true,
    allowFullscreen: true,
    width: '100%',
    height: '600',
    timeout: 15000,  // 播放器加载超时时间
    filterAds: true,  // 是否启用广告过滤
    autoPlayNext: true,  // 默认启用自动连播功能
    adFilteringEnabled: true, // 默认开启分片广告过滤
    adFilteringStorage: 'adFilteringEnabled' // 存储广告过滤设置的键名
};

// 增加错误信息本地化
const ERROR_MESSAGES = {
    NETWORK_ERROR: '网络连接错误，请检查网络设置',
    TIMEOUT_ERROR: '请求超时，服务器响应时间过长',
    API_ERROR: 'API接口返回错误，请尝试更换数据源',
    PLAYER_ERROR: '播放器加载失败，请尝试其他视频源',
    UNKNOWN_ERROR: '发生未知错误，请刷新页面重试'
};

// 添加进一步安全设置
const SECURITY_CONFIG = {
    enableXSSProtection: true,  // 是否启用XSS保护
    sanitizeUrls: true,         // 是否清理URL
    maxQueryLength: 100,        // 最大搜索长度
    // allowedApiDomains 不再需要，因为所有请求都通过内部代理
};

// 缓存管理配置
export const CACHE_CONFIG = {
    // 缓存清理间隔（毫秒）- 24小时
    cleanupInterval: 24 * 60 * 60 * 1000,
    // 允许保留的用户设置和历史记录键名
    preserveKeys: [
        'selectedAPIs',          // 用户选择的API列表
        'customAPIs',            // 自定义API列表
        'hiddenContentMode',     // 隐藏内容模式开关（决定当前数据域）
        'hidden::selectedAPIs',  // 隐藏域：用户选择的API列表
        'hidden::customAPIs',    // 隐藏域：自定义API列表
        'hidden::viewingHistory',// 隐藏域：观看历史记录
        'hidden::videoSearchHistory', // 隐藏域：搜索历史记录
        'adFilteringEnabled',    // 广告过滤开关
        'hasInitializedDefaults',// 是否已初始化默认值
        'viewingHistory',        // 观看历史记录
        'videoSearchHistory',    // 搜索历史记录
        'passwordVerified',      // 密码验证状态
        'leletv_theme_normal',   // 主题色（正常模式）
        'leletv_theme_hidden',   // 主题色（私密模式）
        'leletv_motion',         // 动态效果偏好（跟随系统 / 开启 / 关闭）
        'leletv_layout',         // 首页与导航布局偏好（正常模式）
        'leletv_layout_hidden',  // 首页与导航布局偏好（私密模式；默认关聚合动效与内容板块）
        'leletv_lights'          // 播放页关灯
    ],
    // 带时间戳的临时数据键名前缀
    temporaryKeyPrefixes: [
        'videoProgress_',        // 视频播放进度
        'lastPageUrl',           // 最后访问的页面URL
        'currentPlayingId',      // 当前播放的视频ID
        'currentPlayingSource',  // 当前播放的视频源
        'currentVideoTitle',     // 当前视频标题
        'currentEpisodes',       // 当前视频所有集数
        'currentEpisodeIndex',   // 当前播放的集数索引
        'currentSourceCode',     // 当前视频源代码
        'lastPlayTime',          // 最后播放时间
        'loadBalancerStats'      // 负载均衡统计数据
    ],
    // 临时数据的过期时间（毫秒）- 24小时
    temporaryDataTTL: 24 * 60 * 60 * 1000
};

// 添加多个自定义API源的配置
export const CUSTOM_API_CONFIG = {
    separator: ',',           // 分隔符
    maxSources: 5,            // 最大允许的自定义源数量
    testTimeout: 5000,        // 测试超时时间(毫秒)
    namePrefix: 'Custom-',    // 自定义源名称前缀
    validateUrl: true,        // 验证URL格式
    cacheResults: true,       // 缓存测试结果
    cacheExpiry: 5184000000,  // 缓存过期时间(2个月)
    hiddenPropName: 'isHidden' // 用于标记隐藏内容的属性名
};

// 不显示内置隐藏采集站API
const HIDE_BUILTIN_HIDDEN_APIS = false;

// 负载均衡器配置
export const LOAD_BALANCER_CONFIG = {
    enabled: true,                    // 是否启用负载均衡
    responseTimeThreshold: 10000,     // 响应时间阈值（10秒）
    failureThreshold: 0.3,           // 失败率阈值（30%）
    requestTimeout: 15000,           // 请求超时时间（15秒）
    cooldownPeriod: 10 * 60 * 1000,  // 冷却期（10分钟）
    maxConcurrentRequests: 3,        // 单个API最大并发请求数
    retryAttempts: 3,               // 重试次数
    retryDelay: 1000,               // 重试延迟（1秒）
    enableFailover: true,           // 启用故障转移
    statsSaveInterval: 30000,       // 统计数据保存间隔（30秒）
    blacklistThreshold: 5,          // 连续失败次数达到此值时加入黑名单
    priorityBoostFactor: 1.2,       // 优先级提升因子
    loadPenaltyFactor: 10,          // 负载惩罚因子
    recentSuccessBonus: 1.2         // 最近成功加成
};

// ===== 主题色：正常模式霓虹粉，私密模式鸿蒙便签黄 =====
// 色值与 css/variables.css 的 html[data-hidden-mode] 覆盖块保持一致（改色值时两处同步）。
// 供 CSS 变量无能为力的场景使用：canvas 绘制、第三方组件（ArtPlayer）主题、行内样式等
const THEME_COLOR_NORMAL = '#ec4899';
const THEME_COLOR_HIDDEN = '#B87333';
const THEME_RGB_NORMAL = [236, 72, 153];
const THEME_RGB_HIDDEN = [184, 115, 51];

/** 是否处于私密（隐藏内容）模式 —— 该属性由页面的 head 内联脚本在首帧前设置 */
function isHiddenThemeMode(): boolean {
    try { return document.documentElement.hasAttribute('data-hidden-mode'); } catch (e) { return false; }
}

/** 当前主题主色：优先取 CSS 变量的真实值，取不到时按模式回退到常量 */
export function themeColor(): string {
    try {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        if (v) return v;
    } catch (e) { /* 忽略 */ }
    return isHiddenThemeMode() ? THEME_COLOR_HIDDEN : THEME_COLOR_NORMAL;
}

/** 当前主题主色的 RGB 分量（供 canvas 粒子/渐变使用） */
function themeRgb(): number[] {
    try {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim();
        var parts = v.split(',').map(function (n) { return parseInt(n, 10); });
        if (parts.length === 3 && parts[0] >= 0 && parts[1] >= 0 && parts[2] >= 0) return parts;
    } catch (e) { /* 忽略 */ }
    return (isHiddenThemeMode() ? THEME_RGB_HIDDEN : THEME_RGB_NORMAL).slice();
}

// 阶段 5A-3 过渡期兼容桥：core bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  PROXY_URL,
  SEARCH_HISTORY_KEY,
  MAX_HISTORY_ITEMS,
  HIDDEN_MODE_KEY,
  isHiddenContentMode,
  scopedKey,
  TMDB_WORKER_URL,
  API_SITES,
  extendAPISites,
  AGGREGATED_SEARCH_CONFIG,
  SOURCE_LATENCY_FAST_MS,
  SOURCE_LATENCY_SLOW_MS,
  SEARCH_EARLY_EXIT_CUTOFF_MS,
  SEARCH_EARLY_EXIT_MIN_SOURCES,
  API_CONFIG,
  M3U8_PATTERN,
  PLAYER_CONFIG,
  CACHE_CONFIG,
  CUSTOM_API_CONFIG,
  LOAD_BALANCER_CONFIG,
  themeColor
});

// 阶段 5B-1 过渡期类型桥：config.ts 已成为 ESM 模块，未改造的全局脚本
// 仍以裸名访问这些符号（运行时由上方 window 兼容桥提供）。5B-3 改为 import 后删除。
declare global {
  const PROXY_URL: string;
  const SEARCH_HISTORY_KEY: string;
  const MAX_HISTORY_ITEMS: number;
  const TMDB_WORKER_URL: string;
  const AGGREGATED_SEARCH_CONFIG: {
    enabled: boolean;
    timeout: number;
    maxResults: number;
    parallelRequests: boolean;
    showSourceBadges: boolean;
  };
  const SOURCE_LATENCY_FAST_MS: number;
  const SOURCE_LATENCY_SLOW_MS: number;
  const SEARCH_EARLY_EXIT_CUTOFF_MS: number;
  const SEARCH_EARLY_EXIT_MIN_SOURCES: number;
  const API_CONFIG: {
    search: { path: string; pagePath: string; maxPages: number; headers: Record<string, string> };
    detail: { path: string; headers: Record<string, string> };
  };
  const M3U8_PATTERN: RegExp;
  const PLAYER_CONFIG: {
    autoplay: boolean;
    allowFullscreen: boolean;
    width: string;
    height: string;
    timeout: number;
    filterAds: boolean;
    autoPlayNext: boolean;
    adFilteringEnabled: boolean;
    adFilteringStorage: string;
  };
  const CACHE_CONFIG: {
    cleanupInterval: number;
    preserveKeys: string[];
    temporaryKeyPrefixes: string[];
    temporaryDataTTL: number;
  };
  const CUSTOM_API_CONFIG: {
    separator: string;
    maxSources: number;
    testTimeout: number;
    namePrefix: string;
    validateUrl: boolean;
    cacheResults: boolean;
    cacheExpiry: number;
    hiddenPropName: string;
  };
  const LOAD_BALANCER_CONFIG: {
    enabled: boolean;
    responseTimeThreshold: number;
    failureThreshold: number;
    requestTimeout: number;
    cooldownPeriod: number;
    maxConcurrentRequests: number;
    retryAttempts: number;
    retryDelay: number;
    enableFailover: boolean;
    statsSaveInterval: number;
    blacklistThreshold: number;
    priorityBoostFactor: number;
    loadPenaltyFactor: number;
    recentSuccessBonus: number;
  };
  function themeColor(): string;
}
