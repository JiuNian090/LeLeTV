/**
 * 性能监控系统
 * 实现性能指标收集和用户行为分析
 * @version 1.0.0
 */

class PerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            // 是否启用性能监控
            enabled: true,
            // 性能数据采样率 (0-1)
            sampleRate: 1.0,
            // 最大存储的性能记录数
            maxRecords: 1000,
            // 是否启用用户行为分析
            enableUserAnalytics: true,
            // 用户行为数据采样率
            userAnalyticsSampleRate: 1.0,
            ...options
        };

        // 性能记录存储
        this.performanceRecords = [];
        
        // 用户行为记录存储
        this.userBehaviorRecords = [];
        
        // 初始化
        this.init();
    }

    /**
     * 初始化性能监控系统
     */
    init() {
        if (!this.options.enabled) {
            return;
        }

        // 检查浏览器是否支持性能API
        if (!('performance' in window)) {
            console.warn('浏览器不支持Performance API');
            this.options.enabled = false;
            return;
        }

        // 页面加载完成后收集初始性能数据
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.collectInitialPerformanceData();
            });
        } else {
            this.collectInitialPerformanceData();
        }

        // 页面完全加载后收集完整性能数据
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.collectFullPerformanceData();
            }, 1000); // 等待1秒确保所有资源加载完成
        });

        // 监听页面卸载，保存性能数据
        window.addEventListener('beforeunload', () => {
            this.savePerformanceData();
        });

        // 如果启用用户行为分析，设置相关监听器
        if (this.options.enableUserAnalytics) {
            this.setupUserBehaviorTracking();
        }
    }

    /**
     * 收集初始性能数据
     */
    collectInitialPerformanceData() {
        if (!this.shouldCollectData()) {
            return;
        }

        const record = {
            timestamp: Date.now(),
            type: 'initial',
            navigation: this.getNavigationTiming(),
            paint: this.getPaintTiming(),
            resources: this.getResourceTiming()
        };

        this.addPerformanceRecord(record);
    }

    /**
     * 收集完整性能数据
     */
    collectFullPerformanceData() {
        if (!this.shouldCollectData()) {
            return;
        }

        const record = {
            timestamp: Date.now(),
            type: 'full',
            navigation: this.getNavigationTiming(),
            paint: this.getPaintTiming(),
            resources: this.getResourceTiming(),
            memory: this.getMemoryInfo()
        };

        this.addPerformanceRecord(record);
    }

    /**
     * 获取导航计时信息
     */
    getNavigationTiming() {
        if (!('getEntriesByType' in performance)) {
            return null;
        }

        const navigationEntries = performance.getEntriesByType('navigation');
        if (navigationEntries.length === 0) {
            return null;
        }

        const nav = navigationEntries[0];
        return {
            // DNS查询时间
            dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
            // TCP连接时间
            tcpTime: nav.connectEnd - nav.connectStart,
            // 请求时间
            requestTime: nav.responseStart - nav.requestStart,
            // 响应时间
            responseTime: nav.responseEnd - nav.responseStart,
            // DOM解析时间
            domParseTime: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            // 页面加载总时间
            loadTime: nav.loadEventEnd - nav.loadEventStart,
            // 首字节时间
            ttfb: nav.responseStart - nav.requestStart
        };
    }

    /**
     * 获取绘制计时信息
     */
    getPaintTiming() {
        if (!('getEntriesByType' in performance)) {
            return null;
        }

        const paintEntries = performance.getEntriesByType('paint');
        if (paintEntries.length === 0) {
            return null;
        }

        const paint = {};
        paintEntries.forEach(entry => {
            paint[entry.name] = entry.startTime;
        });

        return paint;
    }

    /**
     * 获取资源计时信息
     */
    getResourceTiming() {
        if (!('getEntriesByType' in performance)) {
            return null;
        }

        const resourceEntries = performance.getEntriesByType('resource');
        if (resourceEntries.length === 0) {
            return null;
        }

        // 只收集关键资源的计时信息
        const criticalResources = resourceEntries
            .filter(entry => 
                entry.name.includes('.js') || 
                entry.name.includes('.css') || 
                entry.name.includes('.png') || 
                entry.name.includes('.jpg') || 
                entry.name.includes('.jpeg') ||
                entry.name.includes('.woff')
            )
            .slice(0, 50) // 限制数量
            .map(entry => ({
                name: entry.name,
                duration: entry.duration,
                transferSize: entry.transferSize,
                startTime: entry.startTime,
                endTime: entry.responseEnd
            }));

        return {
            count: resourceEntries.length,
            criticalResources
        };
    }

    /**
     * 获取内存信息
     */
    getMemoryInfo() {
        if (!('memory' in performance)) {
            return null;
        }

        return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
    }

    /**
     * 添加性能记录
     */
    addPerformanceRecord(record) {
        // 检查采样率
        if (!this.shouldCollectData()) {
            return;
        }

        // 限制存储数量
        if (this.performanceRecords.length >= this.options.maxRecords) {
            this.performanceRecords.shift();
        }

        this.performanceRecords.push(record);
    }

    /**
     * 检查是否应该收集数据（基于采样率）
     */
    shouldCollectData() {
        return this.options.enabled && Math.random() < this.options.sampleRate;
    }

    /**
     * 设置用户行为跟踪
     */
    setupUserBehaviorTracking() {
        if (!this.options.enableUserAnalytics || 
            Math.random() >= this.options.userAnalyticsSampleRate) {
            return;
        }

        // 跟踪搜索行为
        document.addEventListener('search', (event) => {
            this.trackUserBehavior('search', {
                query: event.detail.query,
                timestamp: Date.now()
            });
        });

        // 跟踪视频播放
        document.addEventListener('videoPlay', (event) => {
            this.trackUserBehavior('videoPlay', {
                videoId: event.detail.videoId,
                source: event.detail.source,
                timestamp: Date.now()
            });
        });

        // 跟踪页面跳转
        document.addEventListener('pageNavigation', (event) => {
            this.trackUserBehavior('pageNavigation', {
                from: event.detail.from,
                to: event.detail.to,
                timestamp: Date.now()
            });
        });

        // 跟踪点击事件
        document.addEventListener('click', (event) => {
            // 只跟踪特定元素的点击
            if (event.target.closest('button, a, .card-hover, .episode-btn')) {
                this.trackUserBehavior('click', {
                    target: event.target.tagName,
                    className: event.target.className,
                    id: event.target.id,
                    timestamp: Date.now()
                });
            }
        });
        
        // 跟踪视频播放进度
        setInterval(() => {
            if (window.art && window.art.video) {
                this.trackUserBehavior('videoProgress', {
                    currentTime: window.art.video.currentTime,
                    duration: window.art.video.duration,
                    progress: (window.art.video.currentTime / window.art.video.duration * 100).toFixed(2) + '%'
                });
            }
        }, 30000); // 每30秒记录一次
        
        // 跟踪页面停留时间
        let pageStartTime = Date.now();
        window.addEventListener('beforeunload', () => {
            this.trackUserBehavior('pageStay', {
                duration: Date.now() - pageStartTime,
                page: window.location.pathname
            });
        });
        
        // 新增：跟踪滚动行为
        let scrollTimer;
        document.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                this.trackUserBehavior('scroll', {
                    scrollY: window.scrollY,
                    scrollX: window.scrollX,
                    pageHeight: document.body.scrollHeight,
                    viewportHeight: window.innerHeight,
                    scrollPercentage: Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
                });
            }, 1000); // 防抖动，每秒最多记录一次
        });
        
        // 新增：跟踪搜索输入行为
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let inputTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(inputTimer);
                inputTimer = setTimeout(() => {
                    this.trackUserBehavior('searchInput', {
                        inputLength: searchInput.value.length,
                        timestamp: Date.now()
                    });
                }, 2000); // 防抖动，输入停止2秒后记录
            });
        }
        
        // 新增：跟踪播放器交互
        document.addEventListener('keydown', (event) => {
            // 只在播放器页面跟踪键盘事件
            if (window.location.pathname.includes('player') || window.location.pathname.includes('watch')) {
                switch (event.code) {
                    case 'Space':
                        this.trackUserBehavior('playerAction', { action: 'togglePlay' });
                        break;
                    case 'ArrowLeft':
                        this.trackUserBehavior('playerAction', { action: 'seekBackward' });
                        break;
                    case 'ArrowRight':
                        this.trackUserBehavior('playerAction', { action: 'seekForward' });
                        break;
                    case 'ArrowUp':
                        this.trackUserBehavior('playerAction', { action: 'volumeUp' });
                        break;
                    case 'ArrowDown':
                        this.trackUserBehavior('playerAction', { action: 'volumeDown' });
                        break;
                    case 'KeyF':
                        this.trackUserBehavior('playerAction', { action: 'toggleFullscreen' });
                        break;
                    case 'KeyM':
                        this.trackUserBehavior('playerAction', { action: 'toggleMute' });
                        break;
                }
            }
        });
        
        // 新增：跟踪播放器状态变化
        if (window.art) {
            window.art.on('play', () => {
                this.trackUserBehavior('playerState', { state: 'play' });
            });
            
            window.art.on('pause', () => {
                this.trackUserBehavior('playerState', { state: 'pause' });
            });
            
            window.art.on('ended', () => {
                this.trackUserBehavior('playerState', { state: 'ended' });
            });
            
            window.art.on('error', (error) => {
                this.trackUserBehavior('playerError', { 
                    error: error.message,
                    code: error.code
                });
            });
        }
    }

    /**
     * 跟踪用户行为
     */
    trackUserBehavior(action, data) {
        if (!this.options.enableUserAnalytics || 
            Math.random() >= this.options.userAnalyticsSampleRate) {
            return;
        }

        const record = {
            action,
            data,
            timestamp: Date.now(),
            sessionId: this.getSessionId()
        };

        // 限制存储数量
        if (this.userBehaviorRecords.length >= this.options.maxRecords) {
            this.userBehaviorRecords.shift();
        }

        this.userBehaviorRecords.push(record);
    }

    /**
     * 获取会话ID
     */
    getSessionId() {
        let sessionId = localStorage.getItem('performance_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('performance_session_id', sessionId);
        }
        return sessionId;
    }

    /**
     * 保存性能数据到本地存储
     */
    savePerformanceData() {
        try {
            const data = {
                performance: this.performanceRecords,
                behavior: this.userBehaviorRecords,
                timestamp: Date.now()
            };
            
            localStorage.setItem('performance_data', JSON.stringify(data));
        } catch (error) {
            console.warn('保存性能数据失败:', error);
        }
    }

    /**
     * 从本地存储加载性能数据
     */
    loadPerformanceData() {
        try {
            const dataStr = localStorage.getItem('performance_data');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                
                // 检查数据是否过期（保留7天）
                if (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    this.performanceRecords = data.performance || [];
                    this.userBehaviorRecords = data.behavior || [];
                } else {
                    // 清除过期数据
                    localStorage.removeItem('performance_data');
                }
            }
        } catch (error) {
            console.warn('加载性能数据失败:', error);
        }
    }

    /**
     * 清除所有性能数据
     */
    clearAllData() {
        this.performanceRecords = [];
        this.userBehaviorRecords = [];
        localStorage.removeItem('performance_data');
        localStorage.removeItem('performance_session_id');
    }

    /**
     * 获取性能统计信息
     */
    getStats() {
        return {
            performanceRecords: this.performanceRecords.length,
            behaviorRecords: this.userBehaviorRecords.length,
            enabled: this.options.enabled,
            sampleRate: this.options.sampleRate
        };
    }

    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        if (this.performanceRecords.length === 0) {
            return null;
        }

        // 获取最新的完整性能记录
        const fullRecords = this.performanceRecords.filter(r => r.type === 'full');
        if (fullRecords.length === 0) {
            return null;
        }

        const latestRecord = fullRecords[fullRecords.length - 1];
        
        return {
            pageLoadTime: latestRecord.navigation?.loadTime || 0,
            dnsTime: latestRecord.navigation?.dnsTime || 0,
            tcpTime: latestRecord.navigation?.tcpTime || 0,
            ttfb: latestRecord.navigation?.ttfb || 0,
            firstPaint: latestRecord.paint?.['first-paint'] || 0,
            firstContentfulPaint: latestRecord.paint?.['first-contentful-paint'] || 0,
            resourceCount: latestRecord.resources?.count || 0,
            memoryUsage: latestRecord.memory?.usedJSHeapSize || 0
        };
    }

    /**
     * 获取用户行为分析报告
     */
    getUserBehaviorReport() {
        if (this.userBehaviorRecords.length === 0) {
            return null;
        }

        // 分析用户行为数据
        const behaviorStats = {
            totalActions: this.userBehaviorRecords.length,
            actionTypes: {},
            mostClickedElements: {},
            searchQueries: [],
            videoPlays: 0,
            averagePageStay: 0,
            // 新增统计项
            scrollDepth: [],
            searchInputCount: 0,
            playerActions: {},
            playerStates: {},
            playerErrors: []
        };

        let totalStayTime = 0;
        let stayCount = 0;

        this.userBehaviorRecords.forEach(record => {
            // 统计行为类型
            if (!behaviorStats.actionTypes[record.action]) {
                behaviorStats.actionTypes[record.action] = 0;
            }
            behaviorStats.actionTypes[record.action]++;

            // 统计特定行为
            switch (record.action) {
                case 'search':
                    behaviorStats.searchQueries.push(record.data.query);
                    break;
                case 'videoPlay':
                    behaviorStats.videoPlays++;
                    break;
                case 'click':
                    const elementKey = `${record.data.target}.${record.data.className}`;
                    if (!behaviorStats.mostClickedElements[elementKey]) {
                        behaviorStats.mostClickedElements[elementKey] = 0;
                    }
                    behaviorStats.mostClickedElements[elementKey]++;
                    break;
                case 'pageStay':
                    totalStayTime += record.data.duration;
                    stayCount++;
                    break;
                // 新增行为统计
                case 'scroll':
                    behaviorStats.scrollDepth.push(record.data.scrollPercentage);
                    break;
                case 'searchInput':
                    behaviorStats.searchInputCount++;
                    break;
                case 'playerAction':
                    if (!behaviorStats.playerActions[record.data.action]) {
                        behaviorStats.playerActions[record.data.action] = 0;
                    }
                    behaviorStats.playerActions[record.data.action]++;
                    break;
                case 'playerState':
                    if (!behaviorStats.playerStates[record.data.state]) {
                        behaviorStats.playerStates[record.data.state] = 0;
                    }
                    behaviorStats.playerStates[record.data.state]++;
                    break;
                case 'playerError':
                    behaviorStats.playerErrors.push(record.data);
                    break;
            }
        });

        // 计算平均停留时间
        if (stayCount > 0) {
            behaviorStats.averagePageStay = totalStayTime / stayCount;
        }
        
        // 计算平均滚动深度
        if (behaviorStats.scrollDepth.length > 0) {
            const totalScroll = behaviorStats.scrollDepth.reduce((sum, depth) => sum + depth, 0);
            behaviorStats.averageScrollDepth = Math.round(totalScroll / behaviorStats.scrollDepth.length);
        }
        
        // 计算最常见的搜索词
        if (behaviorStats.searchQueries.length > 0) {
            const queryCount = {};
            behaviorStats.searchQueries.forEach(query => {
                queryCount[query] = (queryCount[query] || 0) + 1;
            });
            behaviorStats.mostCommonSearches = Object.entries(queryCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([query, count]) => ({ query, count }));
        }
        
        // 计算最常见的点击元素
        if (Object.keys(behaviorStats.mostClickedElements).length > 0) {
            behaviorStats.mostClickedElements = Object.entries(behaviorStats.mostClickedElements)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .reduce((obj, [key, value]) => {
                    obj[key] = value;
                    return obj;
                }, {});
        }

        return behaviorStats;
    }

    /**
     * 设置启用状态
     */
    setEnabled(enabled) {
        this.options.enabled = enabled;
        
        if (!enabled) {
            this.clearAllData();
        }
    }

    /**
     * 导出分析数据
     */
    exportAnalyticsData() {
        return {
            performance: this.performanceRecords,
            behavior: this.userBehaviorRecords,
            timestamp: Date.now(),
            version: '1.0.0'
        };
    }

    /**
     * 导入分析数据
     */
    importAnalyticsData(data) {
        if (data.performance) {
            this.performanceRecords = data.performance;
        }
        if (data.behavior) {
            this.userBehaviorRecords = data.behavior;
        }
    }
}

// 创建全局实例
window.performanceMonitor = new PerformanceMonitor();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}