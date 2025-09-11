/**
 * 用户行为跟踪器
 * 专门用于跟踪和分析用户在LeLeTV平台上的行为
 * @version 1.0.0
 */

class UserBehaviorTracker {
    constructor() {
        this.init();
    }

    /**
     * 初始化用户行为跟踪器
     */
    init() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
            });
        } else {
            this.setupEventListeners();
        }

        // 页面加载完成后初始化特定跟踪
        window.addEventListener('load', () => {
            this.trackPageLoad();
        });
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 跟踪搜索行为
        document.addEventListener('search', (event) => {
            this.trackSearch(event.detail.query);
        });

        // 跟踪视频播放
        document.addEventListener('videoPlay', (event) => {
            this.trackVideoPlay(event.detail);
        });

        // 跟踪详情查看
        document.addEventListener('viewDetails', (event) => {
            this.trackViewDetails(event.detail);
        });

        // 跟踪页面跳转
        document.addEventListener('pageNavigation', (event) => {
            this.trackPageNavigation(event.detail);
        });

        // 跟踪应用安装
        document.addEventListener('appInstalled', (event) => {
            this.trackAppInstallation();
        });

        // 跟踪点击事件
        document.addEventListener('click', (event) => {
            this.trackClick(event);
        });

        // 跟踪滚动行为
        this.setupScrollTracking();

        // 跟踪搜索输入
        this.setupSearchInputTracking();

        // 跟踪播放器行为
        this.setupPlayerBehaviorTracking();

        // 跟踪页面停留时间
        this.setupPageStayTracking();
    }

    /**
     * 跟踪页面加载
     */
    trackPageLoad() {
        const pageType = this.getPageType();
        window.performanceMonitor.trackUserBehavior('pageLoad', {
            pageType: pageType,
            url: window.location.href,
            timestamp: Date.now()
        });
    }

    /**
     * 跟踪搜索行为
     */
    trackSearch(query) {
        window.performanceMonitor.trackUserBehavior('search', {
            query: query,
            timestamp: Date.now()
        });
    }

    /**
     * 跟踪视频播放
     */
    trackVideoPlay(details) {
        window.performanceMonitor.trackUserBehavior('videoPlay', {
            url: details.url,
            name: details.name,
            source: details.source,
            episodeIndex: details.episodeIndex,
            vodId: details.vodId,
            timestamp: Date.now()
        });
    }

    /**
     * 跟踪详情查看
     */
    trackViewDetails(details) {
        window.performanceMonitor.trackUserBehavior('viewDetails', {
            id: details.id,
            name: details.name,
            source: details.source,
            timestamp: Date.now()
        });
    }

    /**
     * 跟踪页面跳转
     */
    trackPageNavigation(details) {
        window.performanceMonitor.trackUserBehavior('pageNavigation', {
            from: details.from,
            to: details.to,
            timestamp: Date.now()
        });
    }

    /**
     * 跟踪应用安装
     */
    trackAppInstallation() {
        window.performanceMonitor.trackUserBehavior('appInstalled', {
            timestamp: Date.now()
        });
    }

    /**
     * 跟踪点击事件
     */
    trackClick(event) {
        // 只跟踪特定元素的点击
        if (event.target.closest('button, a, .card-hover, .episode-btn, .search-button')) {
            window.performanceMonitor.trackUserBehavior('click', {
                target: event.target.tagName,
                className: event.target.className,
                id: event.target.id,
                textContent: event.target.textContent.trim().substring(0, 50), // 限制文本长度
                timestamp: Date.now()
            });
        }
    }

    /**
     * 设置滚动跟踪
     */
    setupScrollTracking() {
        let scrollTimer;
        document.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                const scrollPercentage = Math.round(
                    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
                );
                
                window.performanceMonitor.trackUserBehavior('scroll', {
                    scrollY: window.scrollY,
                    scrollX: window.scrollX,
                    pageHeight: document.body.scrollHeight,
                    viewportHeight: window.innerHeight,
                    scrollPercentage: scrollPercentage
                });
            }, 1000); // 防抖动，每秒最多记录一次
        });
    }

    /**
     * 设置搜索输入跟踪
     */
    setupSearchInputTracking() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let inputTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(inputTimer);
                inputTimer = setTimeout(() => {
                    window.performanceMonitor.trackUserBehavior('searchInput', {
                        inputLength: searchInput.value.length,
                        timestamp: Date.now()
                    });
                }, 2000); // 防抖动，输入停止2秒后记录
            });
        }
    }

    /**
     * 设置播放器行为跟踪
     */
    setupPlayerBehaviorTracking() {
        // 跟踪键盘事件
        document.addEventListener('keydown', (event) => {
            // 只在播放器页面跟踪键盘事件
            if (window.location.pathname.includes('player') || window.location.pathname.includes('watch')) {
                let action = null;
                switch (event.code) {
                    case 'Space':
                        action = 'togglePlay';
                        break;
                    case 'ArrowLeft':
                        action = 'seekBackward';
                        break;
                    case 'ArrowRight':
                        action = 'seekForward';
                        break;
                    case 'ArrowUp':
                        action = 'volumeUp';
                        break;
                    case 'ArrowDown':
                        action = 'volumeDown';
                        break;
                    case 'KeyF':
                        action = 'toggleFullscreen';
                        break;
                    case 'KeyM':
                        action = 'toggleMute';
                        break;
                }
                
                if (action) {
                    window.performanceMonitor.trackUserBehavior('playerAction', { 
                        action: action,
                        timestamp: Date.now()
                    });
                }
            }
        });
        
        // 跟踪播放器状态变化
        // 注意：这需要在播放器初始化后才能工作
        setTimeout(() => {
            if (window.art) {
                window.art.on('play', () => {
                    window.performanceMonitor.trackUserBehavior('playerState', { 
                        state: 'play',
                        timestamp: Date.now()
                    });
                });
                
                window.art.on('pause', () => {
                    window.performanceMonitor.trackUserBehavior('playerState', { 
                        state: 'pause',
                        timestamp: Date.now()
                    });
                });
                
                window.art.on('ended', () => {
                    window.performanceMonitor.trackUserBehavior('playerState', { 
                        state: 'ended',
                        timestamp: Date.now()
                    });
                });
                
                window.art.on('error', (error) => {
                    window.performanceMonitor.trackUserBehavior('playerError', { 
                        error: error.message,
                        code: error.code,
                        timestamp: Date.now()
                    });
                });
            }
        }, 1000);
    }

    /**
     * 设置页面停留时间跟踪
     */
    setupPageStayTracking() {
        const pageStartTime = Date.now();
        window.addEventListener('beforeunload', () => {
            window.performanceMonitor.trackUserBehavior('pageStay', {
                duration: Date.now() - pageStartTime,
                page: window.location.pathname,
                timestamp: Date.now()
            });
        });
    }

    /**
     * 获取页面类型
     */
    getPageType() {
        if (window.location.pathname.includes('player')) {
            return 'player';
        } else if (window.location.pathname.includes('watch')) {
            return 'watch';
        } else {
            return 'index';
        }
    }

    /**
     * 导出用户行为数据
     */
    exportUserData() {
        return window.performanceMonitor.exportAnalyticsData();
    }

    /**
     * 获取用户行为报告
     */
    getUserBehaviorReport() {
        return window.performanceMonitor.getUserBehaviorReport();
    }
}

// 创建全局实例
window.userBehaviorTracker = new UserBehaviorTracker();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserBehaviorTracker;
}