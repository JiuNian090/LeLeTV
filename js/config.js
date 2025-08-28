// 全局常量配置
const PROXY_URL = '/proxy/';    // 适用于 Cloudflare, Netlify (带重写), Vercel (带重写)
// const HOPLAYER_URL = 'https://hoplayer.com/index.html';
const SEARCH_HISTORY_KEY = 'videoSearchHistory';
const MAX_HISTORY_ITEMS = 5;

// 密码保护配置
// 注意：PASSWORD 环境变量是必需的，所有部署都必须设置密码以确保安全
const PASSWORD_CONFIG = {
    localStorageKey: 'passwordVerified',  // 存储验证状态的键名
    verificationTTL: 7 * 24 * 60 * 60 * 1000  // 验证有效期（7天）
};

// 网站信息配置
const SITE_CONFIG = {
    name: 'LeLeTV',
    url: 'https://leletv.776645.xyz',
    description: '自用观影平台',
    logo: 'image/logo.png',
    version: '1.0.3',
    author: 'Jiunian',
};

// API站点配置
const API_SITES = {
    dyttzy: {
        api: 'http://caiji.dyttzyapi.com/api.php/provide/vod',
        name: '电影天堂',
        detail: 'http://caiji.dyttzyapi.com', 
    },
    bdzy: {
        api: 'https://api.apibdzy.com/api.php/provide/vod/',
        name: '百度资源', 
    },

    moduzy: {
        api: 'https://caiji.moduapi.cc/api.php/provide/vod',
        name: '魔都资源', 
    },
    
    zy360: {
        api: 'https://360zy.com/api.php/provide/vod',
        name: '360资源',
    },

    bfzy: {
        api: 'https://bfzyapi.com/api.php/provide/vod',
        name: '暴风资源',
    },
    tyyszy: {
        api: 'https://tyyszy.com/api.php/provide/vod',
        name: '天涯资源',
    },
    
    wolong: {
        api: 'https://wolongzyw.com/api.php/provide/vod',
        name: '卧龙资源',
    }, 

    jisu: {
        api: 'https://jszyapi.com/api.php/provide/vod',
        name: '极速资源',
        detail: 'https://jszyapi.com', 
    },
    dbzy: {
        api: 'https://dbzy.tv/api.php/provide/vod',
        name: '豆瓣资源',
    },
    mozhua: {
        api: 'https://mozhuazy.com/api.php/provide/vod',
        name: '魔爪资源',
    },
    
    zuid: {
        api: 'https://api.zuidapi.com/api.php/provide/vod',
        name: '最大资源'
    },
    
    wujin: {
        api: 'https://api.wujinapi.me/api.php/provide/vod',
        name: '无尽资源'
    },
    
    mtzy: {
        api: 'https://caiji.maotaizy.cc/api.php/provide/vod/at/josn',
        name: '茅台资源'
    },

    ikun: {
        api: 'https://ikunzyapi.com/api.php/provide/vod',
        name: 'iKun资源'
    },
    hnzy: {
        api: 'https://hongniuzy2.com/api.php/provide/vod',
        name: '红牛资源'
    },
    ckzy: {
        api: 'https://ckzy.me/api.php/provide/vod',
        name: 'ck资源',
        adult: true
    },
     fhzy: {
        api: 'http://fhapi9.com/api.php/provide/vod',
        name: 'fh资源',
        adult: true
    },
    ywzy: {
        api: 'https://155api.com/api.php/provide/vod',
        name: '155资源',
        adult: true
    },
    mdzy: {
        api: 'https://91md.me/api.php/provide/vod',
        name: 'md资源',
        adult: true
    },
    kgzy: {
        api: 'https://jkunzyapi.com/api.php/provide/vod',
        name: 'kg资源',
        adult: true
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

// 抽象API请求配置
const API_CONFIG = {
    search: {
        // 只拼接参数部分，不再包含 /api.php/provide/vod/
        path: '?ac=videolist&wd=',
        pagePath: '?ac=videolist&wd={query}&pg={page}',
        maxPages: 50, // 最大获取页数
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
        'yellowFilterEnabled',   // 黄色内容过滤开关
        'adFilteringEnabled',    // 广告过滤开关
        'doubanEnabled',         // 豆瓣功能开关
        'hasInitializedDefaults',// 是否已初始化默认值
        'viewingHistory',        // 观看历史记录
        'videoSearchHistory',    // 搜索历史记录
        'passwordVerified'       // 密码验证状态
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
    adultPropName: 'isAdult' // 用于标记成人内容的属性名
};

// 隐藏内置黄色采集站API的变量
const HIDE_BUILTIN_ADULT_APIS = false;

// 负载均衡器配置
const LOAD_BALANCER_CONFIG = {
    enabled: true,                    // 是否启用负载均衡
    healthCheckInterval: 5 * 60 * 1000, // 健康检查间隔（5分钟）
    responseTimeThreshold: 10000,     // 响应时间阈值（10秒）
    failureThreshold: 0.3,           // 失败率阈值（30%）
    minHealthyApis: 2,               // 最少健康API数量
    requestTimeout: 15000,           // 请求超时时间（15秒）
    cooldownPeriod: 10 * 60 * 1000,  // 冷却期（10分钟）
    maxConcurrentRequests: 3,        // 单个API最大并发请求数
    retryAttempts: 3,               // 重试次数
    retryDelay: 1000,               // 重试延迟（1秒）
    enableFailover: true,           // 启用故障转移
    enableHealthCheck: true,        // 启用自动健康检查
    statsSaveInterval: 30000,       // 统计数据保存间隔（30秒）
    blacklistThreshold: 5,          // 连续失败次数达到此值时加入黑名单
    priorityBoostFactor: 1.2,       // 优先级提升因子
    loadPenaltyFactor: 10,          // 负载惩罚因子
    recentSuccessBonus: 1.2         // 最近成功加成
};
