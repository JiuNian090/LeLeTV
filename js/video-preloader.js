/**
 * 视频预加载管理器
 * 实现视频源预加载和下一集预测性预加载
 * @version 1.0.0
 */

class VideoPreloader {
    constructor(options = {}) {
        this.options = {
            // 预加载并发数
            maxConcurrentPreloads: 3,
            // 预加载超时时间（毫秒）
            preloadTimeout: 30000,
            // 缓存预加载结果的时间（毫秒）
            cacheTTL: 5 * 60 * 1000, // 5分钟
            // 是否启用预加载
            enabled: true,
            ...options
        };

        // 当前活跃的预加载任务
        this.activePreloads = new Map();
        
        // 预加载队列
        this.preloadQueue = [];
        
        // 已预加载的视频缓存
        this.preloadedVideos = new Map();
        
        // 初始化
        this.init();
    }

    /**
     * 初始化预加载管理器
     */
    init() {
        // 检查浏览器是否支持必要的API
        if (!('fetch' in window) || !('AbortController' in window)) {
            console.warn('浏览器不支持预加载所需API');
            this.options.enabled = false;
        }
    }

    /**
     * 预加载单个视频源
     */
    async preloadVideoSource(sourceUrl, videoId = null) {
        if (!this.options.enabled) {
            return null;
        }

        // 检查是否已经在预加载队列中或正在预加载
        if (this.activePreloads.has(sourceUrl) || this.isPreloaded(sourceUrl)) {
            return this.getPreloadedVideo(sourceUrl);
        }

        // 检查并发限制
        if (this.activePreloads.size >= this.options.maxConcurrentPreloads) {
            // 添加到队列等待
            return new Promise((resolve, reject) => {
                this.preloadQueue.push({
                    url: sourceUrl,
                    videoId,
                    resolve,
                    reject
                });
            });
        }

        // 开始预加载
        return this.startPreload(sourceUrl, videoId);
    }

    /**
     * 开始预加载任务
     */
    async startPreload(sourceUrl, videoId = null) {
        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, this.options.preloadTimeout);

        // 标记为正在预加载
        this.activePreloads.set(sourceUrl, {
            videoId,
            startTime: Date.now(),
            timeoutId
        });

        try {
            // 发起HEAD请求检查视频源是否可用
            const response = await fetch(sourceUrl, {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-cache'
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // 预加载成功，缓存结果
                const preloadInfo = {
                    url: sourceUrl,
                    videoId,
                    timestamp: Date.now(),
                    headers: {
                        'content-length': response.headers.get('content-length'),
                        'content-type': response.headers.get('content-type')
                    }
                };

                this.preloadedVideos.set(sourceUrl, preloadInfo);
                
                // 从活跃预加载中移除
                this.activePreloads.delete(sourceUrl);

                // 处理队列中的下一个任务
                this.processQueue();

                return preloadInfo;
            } else {
                throw new Error(`预加载失败: ${response.status}`);
            }
        } catch (error) {
            clearTimeout(timeoutId);
            this.activePreloads.delete(sourceUrl);
            
            // 处理队列中的下一个任务
            this.processQueue();
            
            throw error;
        }
    }

    /**
     * 预加载下一集
     */
    preloadNextEpisode(currentIndex, episodes) {
        if (!this.options.enabled || !episodes || episodes.length === 0) {
            return;
        }

        // 计算下一集索引
        const nextIndex = currentIndex + 1;
        
        // 检查是否有下一集
        if (nextIndex < episodes.length) {
            const nextEpisodeUrl = episodes[nextIndex];
            
            // 预加载下一集
            this.preloadVideoSource(nextEpisodeUrl, `episode_${nextIndex}`)
                .then(() => {
                    console.log(`预加载下一集成功: ${nextIndex}`);
                })
                .catch((error) => {
                    console.warn(`预加载下一集失败: ${nextIndex}`, error);
                });
        }
    }

    /**
     * 预加载多个视频源
     */
    async preloadMultipleSources(sourceUrls) {
        if (!this.options.enabled || !sourceUrls || sourceUrls.length === 0) {
            return [];
        }

        // 限制并发数
        const limitedUrls = sourceUrls.slice(0, this.options.maxConcurrentPreloads * 2);
        
        // 并发预加载
        const preloadPromises = limitedUrls.map(url => 
            this.preloadVideoSource(url).catch(() => null)
        );
        
        const results = await Promise.all(preloadPromises);
        return results.filter(result => result !== null);
    }

    /**
     * 检查视频是否已预加载
     */
    isPreloaded(sourceUrl) {
        const preloadInfo = this.preloadedVideos.get(sourceUrl);
        if (!preloadInfo) {
            return false;
        }

        // 检查是否过期
        return (Date.now() - preloadInfo.timestamp) < this.options.cacheTTL;
    }

    /**
     * 获取预加载的视频信息
     */
    getPreloadedVideo(sourceUrl) {
        if (this.isPreloaded(sourceUrl)) {
            return this.preloadedVideos.get(sourceUrl);
        }
        return null;
    }

    /**
     * 清除过期的预加载缓存
     */
    cleanupExpired() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [url, info] of this.preloadedVideos.entries()) {
            if ((now - info.timestamp) >= this.options.cacheTTL) {
                expiredKeys.push(url);
            }
        }

        expiredKeys.forEach(url => {
            this.preloadedVideos.delete(url);
        });
    }

    /**
     * 清除所有预加载缓存
     */
    clearAll() {
        this.preloadedVideos.clear();
        this.activePreloads.forEach((preload, url) => {
            clearTimeout(preload.timeoutId);
        });
        this.activePreloads.clear();
        this.preloadQueue = [];
    }

    /**
     * 处理预加载队列
     */
    processQueue() {
        if (this.preloadQueue.length === 0 || 
            this.activePreloads.size >= this.options.maxConcurrentPreloads) {
            return;
        }

        // 从队列中取出下一个任务
        const nextTask = this.preloadQueue.shift();
        if (nextTask) {
            // 开始预加载
            this.startPreload(nextTask.url, nextTask.videoId)
                .then(nextTask.resolve)
                .catch(nextTask.reject);
        }
    }

    /**
     * 获取预加载统计信息
     */
    getStats() {
        return {
            activePreloads: this.activePreloads.size,
            queuedPreloads: this.preloadQueue.length,
            preloadedVideos: this.preloadedVideos.size,
            enabled: this.options.enabled
        };
    }

    /**
     * 设置预加载启用状态
     */
    setEnabled(enabled) {
        this.options.enabled = enabled;
        
        if (!enabled) {
            // 如果禁用，清除所有预加载任务
            this.clearAll();
        }
    }
}

// 创建全局实例
window.videoPreloader = new VideoPreloader();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoPreloader;
}