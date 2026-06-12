/**
 * TIMING — 时间常量配置
 *
 * 集中管理所有 setTimeout / setInterval 时间值，
 * 消除散落的魔数（magic numbers）。
 *
 * 使用方式：
 *   setTimeout(fn, TIMING.SEARCH_THROTTLE_RELEASE);
 *   setInterval(fn, TIMING.PROGRESS_SAVE_INTERVAL);
 */

var TIMING = {

    // ==================== 动画 ====================

    /** 标题书写动效快速播放间隔 (ms) */
    TITLE_ANIMATION_FAST: 50,

    /** 标题书写动效标准播放间隔 (ms) */
    TITLE_ANIMATION_NORMAL: 80,

    /** 卡片交错入场动画间隔 (ms) */
    CARD_ENTRANCE_STAGGER: 50,

    // ==================== 搜索 ====================

    /** 搜索就绪延迟（防止浏览器自动填充触发下拉）(ms) */
    SEARCH_READY_DELAY: 200,

    /** 搜索节流锁释放延迟 (ms) */
    SEARCH_THROTTLE_RELEASE: 500,

    /** TMDB 分类搜索防抖延迟 (ms) */
    TMDB_SEARCH_DEBOUNCE: 300,

    // ==================== API / 网络 ====================

    /** 单次 API 请求超时 (ms) */
    API_REQUEST_TIMEOUT: 10000,

    /** 单次搜索源超时 (ms) */
    API_SEARCH_TIMEOUT: 8000,

    /** 负载均衡统计数据保存延迟 (ms) */
    LOAD_BALANCER_SAVE_DELAY: 2000,

    // ==================== 播放器 ====================

    /** "下一集"按钮注入延迟 (ms) */
    NEXT_EPISODE_BTN_DELAY: 300,

    /** "下一集"按钮二次注入延迟 (ms) */
    NEXT_EPISODE_BTN_SECONDARY: 800,

    /** "下一集"按钮三次注入延迟 (ms) */
    NEXT_EPISODE_BTN_TERTIARY: 1500,

    /** 视频加载看门狗超时 (ms) */
    PLAYER_LOADING_WATCHDOG: 30000,

    /** 集数切换超时兜底 (ms) */
    EPISODE_SWITCH_TIMEOUT: 12000,

    /** 保存历史记录延迟 (ms) */
    SAVE_HISTORY_DELAY: 3000,

    /** 播放进度保存间隔 (ms) */
    PROGRESS_SAVE_INTERVAL: 30000,

    /** 进度保存节流间隔 (ms) */
    PROGRESS_SAVE_THROTTLE: 5000,

    /** 播放器控制栏自动隐藏延迟 (ms) */
    CONTROLS_HIDE_DELAY: 2000,

    /** 播放器控制栏初始隐藏延迟 (ms) */
    CONTROLS_INITIAL_HIDE_DELAY: 3000,

    /** 快捷键提示显示时间 (ms) */
    SHORTCUT_HINT_DURATION: 1500,

    // ==================== UI / 交互 ====================

    /** Toast 消息默认显示时长 (ms) */
    TOAST_DURATION: 3000,

    /** Toast 渐出动画时长 (ms) */
    TOAST_FADE_DURATION: 250,

    /** Loading 超时自动隐藏 (ms) */
    LOADING_TIMEOUT: 30000,

    /** 模态框动画延迟 (ms) */
    MODAL_ANIMATION_DELAY: 100,

    /** 聚焦延迟（等待 DOM 就绪）(ms) */
    FOCUS_DELAY: 100,

    /** 长按判定间隔 (ms) */
    LONG_PRESS_INTERVAL: 500,

    // ==================== 缓存 / 存储 ====================

    /** 搜索缓存 TTL (ms) */
    SEARCH_CACHE_TTL: 30 * 60 * 1000, // 30 分钟

    /** 缓存清理间隔 (ms) */
    CACHE_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 分钟

    // ==================== 版本 / 更新 ====================

    /** 版本检测超时 (ms) */
    VERSION_CHECK_TIMEOUT: 3000,

    /** 导入配置后刷新延迟 (ms) */
    CONFIG_IMPORT_RELOAD_DELAY: 3000,

    // ==================== 其他 ====================

    /** 页面离开时兜底跳转延迟 (ms) */
    FALLBACK_NAVIGATION_DELAY: 5000,

    /** 重试按钮防抖 (ms) */
    RETRY_DEBOUNCE: 300
};

// 注册到 LeLeTV
if (typeof window.LeLeTV !== 'undefined') {
    window.LeLeTV.TIMING = TIMING;
}
