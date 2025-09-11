/**
 * 页面状态管理器
 * 实现页面状态缓存和恢复机制
 * @version 1.0.0
 */

class PageStateManager {
    constructor(options = {}) {
        this.options = {
            // 状态缓存的最大数量
            maxStates: 10,
            // 状态缓存的TTL（毫秒）
            stateTTL: 30 * 60 * 1000, // 30分钟
            // 是否启用状态缓存
            enabled: true,
            ...options
        };

        // 页面状态缓存
        this.pageStates = new Map();
        
        // 最近访问的页面顺序（用于LRU淘汰）
        this.pageAccessOrder = [];
        
        // 初始化
        this.init();
    }

    /**
     * 初始化页面状态管理器
     */
    init() {
        // 监听页面卸载事件，保存当前页面状态
        window.addEventListener('beforeunload', () => {
            this.saveCurrentPageState();
        });

        // 监听页面可见性变化，页面隐藏时保存状态
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveCurrentPageState();
            }
        });

        // 页面加载完成后尝试恢复状态
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.restorePageState();
            });
        } else {
            this.restorePageState();
        }
    }

    /**
     * 保存当前页面状态
     */
    saveCurrentPageState() {
        if (!this.options.enabled) {
            return;
        }

        try {
            const pageId = this.getCurrentPageId();
            const state = this.extractPageState();
            
            if (state) {
                this.savePageState(pageId, state);
            }
        } catch (error) {
            console.warn('保存页面状态失败:', error);
        }
    }

    /**
     * 提取当前页面状态
     */
    extractPageState() {
        const state = {
            timestamp: Date.now(),
            url: window.location.href,
            title: document.title,
            scrollPosition: {
                x: window.scrollX,
                y: window.scrollY
            }
        };

        // 根据不同页面类型提取特定状态
        if (window.location.pathname === '/' || window.location.pathname.includes('/index.html')) {
            // 首页状态
            state.searchQuery = document.getElementById('searchInput')?.value || '';
            state.searchResults = this.extractSearchResults();
            state.doubanContent = this.extractDoubanContent();
        } else if (window.location.pathname.includes('/player.html')) {
            // 播放器页面状态
            state.playerState = this.extractPlayerState();
        }

        return state;
    }

    /**
     * 提取搜索结果状态
     */
    extractSearchResults() {
        const resultsArea = document.getElementById('resultsArea');
        if (!resultsArea || resultsArea.classList.contains('hidden')) {
            return null;
        }

        return {
            html: resultsArea.innerHTML,
            count: document.getElementById('searchResultsCount')?.textContent || '0'
        };
    }

    /**
     * 提取豆瓣内容状态
     */
    extractDoubanContent() {
        const doubanArea = document.getElementById('doubanArea');
        if (!doubanArea || doubanArea.classList.contains('hidden')) {
            return null;
        }

        return {
            html: doubanArea.innerHTML
        };
    }

    /**
     * 提取播放器状态
     */
    extractPlayerState() {
        // 这里可以提取播放器相关状态
        // 由于播放器状态已经在localStorage中管理，这里可以简化
        return {
            videoTitle: window.currentVideoTitle,
            episodeIndex: window.currentEpisodeIndex,
            episodes: window.currentEpisodes,
            episodesReversed: window.episodesReversed
        };
    }

    /**
     * 获取当前页面ID
     */
    getCurrentPageId() {
        // 使用页面路径和查询参数作为页面ID
        return window.location.pathname + window.location.search;
    }

    /**
     * 保存页面状态
     */
    savePageState(pageId, state) {
        // 检查是否需要淘汰旧状态
        if (this.pageStates.size >= this.options.maxStates) {
            // 使用LRU算法淘汰最久未访问的状态
            const oldestPageId = this.pageAccessOrder.shift();
            if (oldestPageId) {
                this.pageStates.delete(oldestPageId);
            }
        }

        // 保存新状态
        this.pageStates.set(pageId, state);
        this.pageAccessOrder.push(pageId);
    }

    /**
     * 恢复页面状态
     */
    restorePageState() {
        if (!this.options.enabled) {
            return;
        }

        try {
            const pageId = this.getCurrentPageId();
            const state = this.pageStates.get(pageId);
            
            if (state && (Date.now() - state.timestamp) < this.options.stateTTL) {
                this.applyPageState(state);
                console.log('页面状态恢复成功:', pageId);
            }
        } catch (error) {
            console.warn('恢复页面状态失败:', error);
        }
    }

    /**
     * 应用页面状态
     */
    applyPageState(state) {
        // 恢复标题
        if (state.title) {
            document.title = state.title;
        }

        // 恢复滚动位置
        if (state.scrollPosition) {
            // 稍微延迟以确保页面内容已加载
            setTimeout(() => {
                window.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
            }, 100);
        }

        // 根据页面类型恢复特定状态
        if (window.location.pathname === '/' || window.location.pathname.includes('/index.html')) {
            this.restoreIndexPageState(state);
        } else if (window.location.pathname.includes('/player.html')) {
            this.restorePlayerPageState(state);
        }
    }

    /**
     * 恢复首页状态
     */
    restoreIndexPageState(state) {
        // 恢复搜索框内容
        if (state.searchQuery && document.getElementById('searchInput')) {
            document.getElementById('searchInput').value = state.searchQuery;
        }

        // 恢复搜索结果
        if (state.searchResults && document.getElementById('resultsArea')) {
            document.getElementById('resultsArea').innerHTML = state.searchResults.html;
            document.getElementById('resultsArea').classList.remove('hidden');
            document.getElementById('searchResultsCount').textContent = state.searchResults.count;
            
            // 重新绑定事件监听器
            if (window.lazyLoader) {
                setTimeout(() => {
                    window.lazyLoader.refresh();
                }, 100);
            }
        }

        // 恢复豆瓣内容
        if (state.doubanContent && document.getElementById('doubanArea')) {
            document.getElementById('doubanArea').innerHTML = state.doubanContent.html;
            document.getElementById('doubanArea').classList.remove('hidden');
        }
    }

    /**
     * 恢复播放器页面状态
     */
    restorePlayerPageState(state) {
        // 恢复播放器相关变量
        if (state.playerState) {
            window.currentVideoTitle = state.playerState.videoTitle || '';
            window.currentEpisodeIndex = state.playerState.episodeIndex || 0;
            window.currentEpisodes = state.playerState.episodes || [];
            window.episodesReversed = state.playerState.episodesReversed || false;
        }
    }

    /**
     * 清除过期的状态
     */
    cleanupExpiredStates() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [pageId, state] of this.pageStates.entries()) {
            if ((now - state.timestamp) >= this.options.stateTTL) {
                expiredKeys.push(pageId);
            }
        }

        expiredKeys.forEach(pageId => {
            this.pageStates.delete(pageId);
            const index = this.pageAccessOrder.indexOf(pageId);
            if (index > -1) {
                this.pageAccessOrder.splice(index, 1);
            }
        });
    }

    /**
     * 清除所有状态
     */
    clearAllStates() {
        this.pageStates.clear();
        this.pageAccessOrder = [];
    }

    /**
     * 获取状态统计信息
     */
    getStats() {
        return {
            cachedStates: this.pageStates.size,
            maxStates: this.options.maxStates,
            enabled: this.options.enabled
        };
    }

    /**
     * 设置启用状态
     */
    setEnabled(enabled) {
        this.options.enabled = enabled;
        
        if (!enabled) {
            this.clearAllStates();
        }
    }
}

// 创建全局实例
window.pageStateManager = new PageStateManager();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageStateManager;
}