/**
 * 负载均衡管理器
 * 智能分配API请求，避免单一源过载
 */

class LoadBalancer {
    constructor() {
        this.apiStats = new Map(); // API统计信息
        this.activeRequests = new Map(); // 活跃请求计数
        this.saveTimeout = null; // 防抖保存定时器
        this.preferredApi = null; // 当前首选API（热缓存）
        this.preferredApiExpiry = 0; // 首选API过期时间
        
        // 使用全局配置，如果不存在则使用默认配置
        this.config = window.LOAD_BALANCER_CONFIG || {
            responseTimeThreshold: 10000, // 响应时间阈值10秒
            failureThreshold: 0.3, // 失败率阈值30%
            requestTimeout: 15000, // 请求超时时间
            cooldownPeriod: 10 * 60 * 1000, // 冷却期10分钟
            maxConcurrentRequests: 3, // 单个API最大并发请求数
            retryAttempts: 3,
            retryDelay: 1000,
            blacklistThreshold: 5,
            priorityBoostFactor: 1.2,
            loadPenaltyFactor: 10,
            recentSuccessBonus: 1.2
        };
        
        this.init();
    }

    /**
     * 初始化负载均衡器
     */
    init() {
        this.loadStats();
        this.initializeApiStats();
        
        // 监听页面卸载，立即保存
        window.addEventListener('beforeunload', () => {
            this.flushSave();
        });
    }

    /**
     * 初始化API统计信息
     */
    initializeApiStats() {
        // 初始化内置API源
        Object.keys(API_SITES).forEach(apiKey => {
            if (!this.apiStats.has(apiKey)) {
                this.apiStats.set(apiKey, this.createApiStat(apiKey));
            }
        });

        // 初始化自定义API源
        const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        customAPIs.forEach((_, index) => {
            const customKey = `custom_${index}`;
            if (!this.apiStats.has(customKey)) {
                this.apiStats.set(customKey, this.createApiStat(customKey, true));
            }
        });
    }

    /**
     * 创建API统计对象
     */
    createApiStat(apiKey, isCustom = false) {
        return {
            apiKey,
            isCustom,
            responseTime: 0,
            successCount: 0,
            failureCount: 0,
            lastSuccessTime: 0,
            lastFailureTime: 0,
            averageResponseTime: 0,
            load: 0, // 当前负载
            priority: 1, // 优先级
            consecutiveFailures: 0,
            isBlacklisted: false,
            blacklistUntil: 0
        };
    }

    /**
     * 获取最佳API源（智能负载均衡）
     * 优先使用热缓存API，避免每次都重新算分
     */
    getBestApi(preferredApis = null) {
        const availableApis = preferredApis || this.getSelectedApis();
        
        if (availableApis.length === 0) {
            throw new Error('没有可用的API源');
        }

        // 热缓存命中：首选API可用、健康、未超载，直接返回
        if (this.preferredApi && Date.now() < this.preferredApiExpiry) {
            if (!preferredApis || preferredApis.includes(this.preferredApi)) {
                const stat = this.apiStats.get(this.preferredApi);
                if (stat && this.isApiHealthy(stat) && !this.isApiOverloaded(this.preferredApi)) {
                    return this.preferredApi;
                }
            }
            // 热缓存失效，清除
            this.preferredApi = null;
        }

        // 过滤健康的API
        const healthyApis = availableApis.filter(apiKey => {
            const stat = this.apiStats.get(apiKey);
            return stat && this.isApiHealthy(stat);
        });

        if (healthyApis.length === 0) {
            // 如果没有健康的API，尝试使用最近成功的API
            const recentSuccessApis = availableApis.filter(apiKey => {
                const stat = this.apiStats.get(apiKey);
                return stat && (Date.now() - stat.lastSuccessTime) < this.config.cooldownPeriod;
            });
            
            if (recentSuccessApis.length > 0) {
                return this.selectBestFromCandidates(recentSuccessApis);
            }
            
            // 最后的选择：随机选择一个
            return availableApis[Math.floor(Math.random() * availableApis.length)];
        }

        return this.selectBestFromCandidates(healthyApis);
    }

    /**
     * 从候选API中选择最佳的
     */
    selectBestFromCandidates(candidates) {
        // 计算每个API的权重分数
        const scoredApis = candidates.map(apiKey => {
            const stat = this.apiStats.get(apiKey);
            const score = this.calculateApiScore(stat);
            return { apiKey, score, stat };
        });

        // 按分数排序
        scoredApis.sort((a, b) => b.score - a.score);

        // 使用加权随机选择，优先选择高分API
        const totalScore = scoredApis.reduce((sum, api) => sum + api.score, 0);
        let random = Math.random() * totalScore;

        for (const api of scoredApis) {
            random -= api.score;
            if (random <= 0) {
                return api.apiKey;
            }
        }

        return scoredApis[0].apiKey; // 默认返回最高分的API
    }

    /**
     * 计算API评分
     */
    calculateApiScore(stat) {
        let score = 100; // 基础分数

        // 响应时间评分 (响应时间越低分数越高)
        if (stat.averageResponseTime > 0) {
            const timeScore = Math.max(0, 100 - (stat.averageResponseTime / 100));
            score *= (timeScore / 100);
        }

        // 成功率评分
        const totalRequests = stat.successCount + stat.failureCount;
        if (totalRequests > 0) {
            const successRate = stat.successCount / totalRequests;
            score *= successRate;
        }

        // 负载评分 (负载越低分数越高)
        const loadPenalty = Math.min(stat.load * this.config.loadPenaltyFactor, 50);
        score -= loadPenalty;

        // 优先级加成
        score *= stat.priority * this.config.priorityBoostFactor;

        // 连续失败惩罚
        if (stat.consecutiveFailures > 0) {
            score *= Math.pow(0.8, stat.consecutiveFailures);
        }

        // 最近成功时间加成
        const timeSinceLastSuccess = Date.now() - stat.lastSuccessTime;
        if (timeSinceLastSuccess < 60000) { // 1分钟内成功过
            score *= this.config.recentSuccessBonus;
        }

        return Math.max(score, 1); // 确保分数不为负
    }

    /**
     * 检查API是否健康
     * 基于实际搜索结果评估，不再发送额外探测请求
     */
    isApiHealthy(stat) {
        const now = Date.now();
        
        // 检查是否在黑名单中
        if (stat.isBlacklisted && now < stat.blacklistUntil) {
            return false;
        }

        // 快速失败检测：连续2次失败且在60秒内，立刻标记为不健康
        if (stat.consecutiveFailures >= 2 && (now - stat.lastFailureTime) < 60000) {
            return false;
        }

        // 常规连续失败检查
        if (stat.consecutiveFailures >= 3) {
            return false;
        }

        // 检查成功率
        const totalRequests = stat.successCount + stat.failureCount;
        if (totalRequests >= 10) {
            const successRate = stat.successCount / totalRequests;
            if (successRate < (1 - this.config.failureThreshold)) {
                return false;
            }
        }

        // 检查响应时间
        if (stat.averageResponseTime > this.config.responseTimeThreshold) {
            return false;
        }

        return true;
    }

    /**
     * 记录API请求结果
     * 成功时更新热缓存，失败时立即清除
     */
    recordApiResult(apiKey, success, responseTime = 0, error = null) {
        let stat = this.apiStats.get(apiKey);
        if (!stat) {
            stat = this.createApiStat(apiKey);
            this.apiStats.set(apiKey, stat);
        }

        const now = Date.now();

        if (success) {
            stat.successCount++;
            stat.lastSuccessTime = now;
            stat.consecutiveFailures = 0;
            stat.isBlacklisted = false;
            
            // 更新平均响应时间
            if (responseTime > 0) {
                if (stat.averageResponseTime === 0) {
                    stat.averageResponseTime = responseTime;
                } else {
                    stat.averageResponseTime = (stat.averageResponseTime * 0.7) + (responseTime * 0.3);
                }
            }

            // 响应时间好（<3秒）时设为热缓存，下次直接选它
            if (responseTime > 0 && responseTime < 3000) {
                this.preferredApi = apiKey;
                this.preferredApiExpiry = now + 60000; // 缓存1分钟
            }
        } else {
            stat.failureCount++;
            stat.lastFailureTime = now;
            stat.consecutiveFailures++;
            
            // 当前首选的API失败了，立即清除热缓存
            if (this.preferredApi === apiKey) {
                this.preferredApi = null;
                this.preferredApiExpiry = 0;
            }
            
            // 连续失败过多时加入黑名单
            if (stat.consecutiveFailures >= this.config.blacklistThreshold) {
                stat.isBlacklisted = true;
                stat.blacklistUntil = now + this.config.cooldownPeriod;
                console.warn(`API ${apiKey} 已被加入黑名单，冷却期: ${this.config.cooldownPeriod / 1000}秒`);
            }
        }

        // 减少当前负载
        this.decreaseApiLoad(apiKey);
        
        // 防抖保存（2秒内多次变更合并为一次写入）
        this.scheduleSave();
    }

    /**
     * 增加API负载
     */
    increaseApiLoad(apiKey) {
        const stat = this.apiStats.get(apiKey);
        if (stat) {
            stat.load++;
        }
        
        // 更新活跃请求计数
        const currentCount = this.activeRequests.get(apiKey) || 0;
        this.activeRequests.set(apiKey, currentCount + 1);
    }

    /**
     * 减少API负载
     */
    decreaseApiLoad(apiKey) {
        const stat = this.apiStats.get(apiKey);
        if (stat && stat.load > 0) {
            stat.load--;
        }
        
        // 更新活跃请求计数
        const currentCount = this.activeRequests.get(apiKey) || 0;
        if (currentCount > 0) {
            this.activeRequests.set(apiKey, currentCount - 1);
        }
    }

    /**
     * 检查API是否超载
     */
    isApiOverloaded(apiKey) {
        const activeCount = this.activeRequests.get(apiKey) || 0;
        return activeCount >= this.config.maxConcurrentRequests;
    }

    /**
     * 获取选中的API列表
     */
    getSelectedApis() {
        const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
        return selectedAPIs.length > 0 ? selectedAPIs : Object.keys(API_SITES).slice(0, 5);
    }

    /**
     * 获取API统计信息
     */
    getApiStats() {
        const stats = {};
        this.apiStats.forEach((stat, apiKey) => {
            stats[apiKey] = { ...stat };
        });
        return stats;
    }

    /**
     * 重置API统计
     */
    resetApiStats(apiKey = null) {
        if (apiKey) {
            const stat = this.apiStats.get(apiKey);
            if (stat) {
                Object.assign(stat, this.createApiStat(apiKey, stat.isCustom));
            }
        } else {
            this.apiStats.clear();
            this.initializeApiStats();
        }
        this.preferredApi = null;
        this.preferredApiExpiry = 0;
        this.flushSave();
    }

    /**
     * 防抖保存：多次变更合并为一次写入
     */
    scheduleSave() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveStats(), 2000);
    }

    /**
     * 立即保存（用于页面卸载时）
     */
    flushSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.saveStats();
    }

    /**
     * 保存统计数据到本地存储
     */
    saveStats() {
        try {
            const statsData = {};
            this.apiStats.forEach((stat, apiKey) => {
                statsData[apiKey] = stat;
            });
            localStorage.setItem('loadBalancerStats', JSON.stringify(statsData));
        } catch (error) {
            console.error('保存负载均衡统计数据失败:', error);
        }
    }

    /**
     * 从本地存储加载统计数据
     */
    loadStats() {
        try {
            const savedStats = localStorage.getItem('loadBalancerStats');
            if (savedStats) {
                const statsData = JSON.parse(savedStats);
                Object.entries(statsData).forEach(([apiKey, stat]) => {
                    this.apiStats.set(apiKey, stat);
                });
            }
        } catch (error) {
            console.error('加载负载均衡统计数据失败:', error);
        }
    }

    /**
     * 销毁负载均衡器
     */
    destroy() {
        this.flushSave();
    }
}

// 创建全局负载均衡器实例
window.loadBalancer = new LoadBalancer();
