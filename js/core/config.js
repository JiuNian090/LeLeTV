// 全局常量配置
const PROXY_URL = '/proxy/';    // 适用于 Cloudflare, Netlify (带重写), Vercel (带重写)
const SEARCH_HISTORY_KEY = 'videoSearchHistory';
const MAX_HISTORY_ITEMS = 5;

// ==================== 隐藏内容模式（双数据域隔离） ====================
// 开启隐藏内容模式后，下列键的读写会自动带 hidden:: 前缀，与正常域完全隔离，
// 两个域互不可见。其余键（设置项、播放器状态等）由两个域共用。
const HIDDEN_MODE_KEY = 'hiddenContentMode';
const HIDDEN_KEY_PREFIX = 'hidden::';
const SCOPED_STORAGE_KEYS = ['selectedAPIs', 'customAPIs', 'viewingHistory', 'videoSearchHistory'];

/** 当前是否处于隐藏内容模式 */
function isHiddenContentMode() {
    try {
        return localStorage.getItem(HIDDEN_MODE_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

/** 按当前数据域解析存储键名；非 scoped 键原样返回 */
function scopedKey(key) {
    if (SCOPED_STORAGE_KEYS.indexOf(key) === -1) return key;
    return isHiddenContentMode() ? HIDDEN_KEY_PREFIX + key : key;
}

// TMDB Worker URL
// 部署 Cloudflare Worker (workers/tmdb-worker.js) 后填入自定义域名
// 留空则使用本地 Node.js 代理 /api/tmdb
const TMDB_WORKER_URL = (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.TMDB_WORKER_URL) || '';

// SHA-256 兼容性检查（用于 invite-auth 管理员 token 计算）
window._sha256Available = typeof window.crypto?.subtle?.digest === 'function' || typeof window._jsSha256 === 'function';

// 网站信息配置
const SITE_CONFIG = {
    name: 'LeLeTV',
    url: 'https://leletv.776645.xyz',
    description: '自用观影平台',
    version: '1.0.3',
    author: 'Jiunian',
};

// API站点配置
const API_SITES = {
    bdzy: {
        api: 'https://api.apibdzy.com/api.php/provide/vod/',
        name: '百度资源', 
    },

    gszy: {
        api: 'https://api.guangsuapi.com/api.php/provide/vod',
        name: '光速资源', 
    },
    
    zy360: {
        api: 'https://360zy.com/api.php/provide/vod',
        name: '360资源',
    },

    bfzy: {
        api: 'https://bfzyapi.com/api.php/provide/vod',
        name: '暴风资源',
    },

    xlzy: {
        api: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/',
        name: '新浪资源'
    },

    zuid: {
        api: 'https://api.zuidapi.com/api.php/provide/vod',
        name: '最大资源'
    },
    
    hhzy: {
        api: 'https://hhzyapi.com/api.php/provide/vod',
        name: '豪华资源'
    },
    
    // 原 jpzy（荐片资源）的 api 与 hhzy 完全相同（重复配置），已替换为 ffzy（飞飞资源）。
    // from/ffm3u8/at/json/ 直接返回 .m3u8，与 lzzy/hnzy 同一模式，无需二次解析。
    ffzy: {
        api: 'https://api.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/',
        name: '非凡资源'
    },

    lzzy: {
        api: 'https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/at/json/',
        name: '量子资源'
    },

    jszy: {
        api: 'https://jszyapi.com/api.php/provide/vod',
        name: '极速资源'
    },
    hnzy: {
        api: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/',
        name: '红牛资源'
    },
    ckzy: {
        api: 'https://ckzy.me/api.php/provide/vod',
        name: 'ck资源',
        hidden: true
    },
     fhzy: {
        api: 'http://fhapi9.com/api.php/provide/vod',
        name: 'fh资源',
        hidden: true
    },
    ywzy: {
        api: 'https://155api.com/api.php/provide/vod',
        name: '155资源',
        hidden: true
    },
    mdzy: {
        api: 'https://91md.me/api.php/provide/vod',
        name: '麻豆资源',
        hidden: true
    },
    kgzy: {
        api: 'https://jkunzyapi.com/api.php/provide/vod',
        name: 'kg资源',
        hidden: true
    },
    nxzy: {
        api: 'https://naixxzy.com/api.php/provide/vod',
        name: '奶香资源',
        hidden: true
    },
    lbzy: {
        api: 'https://lbapi9.com/api.php/provide/vod',
        name: '乐播资源',
        hidden: true
    },
    xjzy: {
        api: 'https://www.xiangjiaozyw.com/api.php/provide/vod',
        name: '香蕉资源',
        hidden: true
    },
    hjzy: {
        api: 'https://api.apilyzy.com/api.php/provide/vod',
        name: '花椒资源',
        hidden: true
    },
    ttzy: {
        api: 'https://apittzy.com/api.php/provide/vod/',
        name: '探探资源',
        hidden: true
    },
    
}


// 定义合并方法
function extendAPISites(newSites) {
    Object.assign(API_SITES, newSites);
}

// 暴露到全局
window.API_SITES = API_SITES;
window.extendAPISites = extendAPISites;


// 添加聚合搜索的配置选项
const AGGREGATED_SEARCH_CONFIG = {
    enabled: true,             // 是否启用聚合搜索
    timeout: 8000,            // 单个源超时时间（毫秒）
    maxResults: 10000,          // 最大结果数量
    parallelRequests: true,   // 是否并行请求所有源
    showSourceBadges: true    // 是否显示来源徽章
};

// 源延迟分级阈值（搜索结果页的延迟标注 与 播放页换源测速 共用同一套配色规则）
const SOURCE_LATENCY_FAST_MS = 1000;   // < 1s  → 快（绿）
const SOURCE_LATENCY_SLOW_MS = 2000;   // ≥ 2s  → 慢（红）；两者之间为 中（黄）

// 搜索结果提前退出：到达 CUTOFF_MS 时若已有 >= MIN_SOURCES 个源返回，就不再等待剩余源
const SEARCH_EARLY_EXIT_CUTOFF_MS = 3000;
const SEARCH_EARLY_EXIT_MIN_SOURCES = 3;

// 抽象API请求配置
const API_CONFIG = {
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
const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g;

// 添加自定义播放器URL
const CUSTOM_PLAYER_URL = 'player.html'; // 使用相对路径引用本地player.html

// 增加视频播放相关配置
const PLAYER_CONFIG = {
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
const CACHE_CONFIG = {
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
const CUSTOM_API_CONFIG = {
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
const LOAD_BALANCER_CONFIG = {
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
function isHiddenThemeMode() {
    try { return document.documentElement.hasAttribute('data-hidden-mode'); } catch (e) { return false; }
}

/** 当前主题主色：优先取 CSS 变量的真实值，取不到时按模式回退到常量 */
function themeColor() {
    try {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        if (v) return v;
    } catch (e) { /* 忽略 */ }
    return isHiddenThemeMode() ? THEME_COLOR_HIDDEN : THEME_COLOR_NORMAL;
}

/** 当前主题主色的 RGB 分量（供 canvas 粒子/渐变使用） */
function themeRgb() {
    try {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim();
        var parts = v.split(',').map(function (n) { return parseInt(n, 10); });
        if (parts.length === 3 && parts[0] >= 0 && parts[1] >= 0 && parts[2] >= 0) return parts;
    } catch (e) { /* 忽略 */ }
    return (isHiddenThemeMode() ? THEME_RGB_HIDDEN : THEME_RGB_NORMAL).slice();
}
