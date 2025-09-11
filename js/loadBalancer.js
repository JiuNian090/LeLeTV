/**
 * 负载均衡管理器
 * 智能分配API请求，避免单一源过载
 */

class LoadBalancer {
    constructor() {
        this.apiStats = new Map(); // API统计信息
        this.healthCheckInterval = null;
        this.requestQueue = new Map(); // 请求队列，按优先级分类
        this.activeRequests = new Map(); // 活跃请求计数
        this.performanceHistory = new Map(); // API性能历史记录
        
        // 使用全局配置，如果不存在则使用默认配置
        this.config = window.LOAD_BALANCER_CONFIG || {
            healthCheckInterval: 5 * 60 * 1000, // 5分钟健康检查
            responseTimeThreshold: 10000, // 响应时间阈值10秒
            failureThreshold: 0.3, // 失败率阈值30%
            minHealthyApis: 2, // 最少健康API数量
            requestTimeout: 15000, // 请求超时时间
            cooldownPeriod: 10 * 60 * 1000, // 冷却期10分钟
            maxConcurrentRequests: 3, // 单个API最大并发请求数
            retryAttempts: 3,
            retryDelay: 1000,
            blacklistThreshold: 5,
            priorityBoostFactor: 1.2,
            loadPenaltyFactor: 10,
            recentSuccessBonus: 1.2,
            performanceWindow: 50 // 性能历史记录窗口大小
        };
        
        // 初始化多级缓存
        this.cache = window.multiLevelCache || null;
        
        this.init();
    }

    /**
     * 初始化负载均衡器
     */
    init() {
        this.loadStats();
        this.initializeApiStats();
        this.startHealthCheck();
        
        // 监听页面卸载，保存统计数据
        window.addEventListener('beforeunload', () => {
            this.saveStats();
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
            isHealthy: true,
            responseTime: 0,
            successCount: 0,
            failureCount: 0,
            lastSuccessTime: 0,
            lastFailureTime: 0,
            lastHealthCheck: 0,
            averageResponseTime: 0,
            load: 0, // 当前负载
            priority: 1, // 优先级
            consecutiveFailures: 0,
            isBlacklisted: false,
            blacklistUntil: 0,
            // 新增性能指标
            totalResponseTime: 0,
            requestCount: 0,
            successRate: 1.0,
            reliabilityScore: 100 // 可靠性评分
        };
    }

    /**
     * 获取最佳API源（智能负载均衡）
     */
    getBestApi(preferredApis = null, requestType = 'default') {
        const availableApis = preferredApis || this.getSelectedApis();
        
        if (availableApis.length === 0) {
            throw new Error('没有可用的API源');
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
                return this.selectBestFromCandidates(recentSuccessApis, requestType);
            }
            
            // 最后的选择：随机选择一个
            return availableApis[Math.floor(Math.random() * availableApis.length)];
        }

        return this.selectBestFromCandidates(healthyApis, requestType);
    }

    /**
     * 从候选API中选择最佳的
     */
    selectBestFromCandidates(candidates, requestType = 'default') {
        // 计算每个API的权重分数
        const scoredApis = candidates.map(apiKey => {
            const stat = this.apiStats.get(apiKey);
            const score = this.calculateApiScore(stat, requestType);
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
     * 计算API评分（增强版）
     */
    calculateApiScore(stat, requestType = 'default') {
        let score = 100; // 基础分数

        // 响应时间评分 (响应时间越低分数越高)
        if (stat.averageResponseTime > 0) {
            const timeScore = Math.max(0, 100 - (stat.averageResponseTime / 100));
            score *= (timeScore / 100);
        }

        // 成功率评分
        if (stat.requestCount > 0) {
            score *= stat.successRate;
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

        // 可靠性评分加成
        score *= (stat.reliabilityScore / 100);

        // 根据请求类型调整评分
        switch (requestType) {
            case 'search':
                // 搜索请求更注重响应速度
                score *= (1 + (1000 / (stat.averageResponseTime + 1000)));
                break;
            case 'detail':
                // 详情请求更注重成功率
                score *= (0.5 + 0.5 * stat.successRate);
                break;
            default:
                // 默认平衡策略
                break;
        }

        return Math.max(score, 1); // 确保分数不为负
    }

    /**
     * 检查API是否健康
     */
    isApiHealthy(stat) {
        const now = Date.now();
        
        // 检查是否在黑名单中
        if (stat.isBlacklisted && now < stat.blacklistUntil) {
            return false;
        }

        // 检查连续失败次数
        if (stat.consecutiveFailures >= 3) {
            return false;
        }

        // 检查成功率
        if (stat.requestCount >= 10) {
            if (stat.successRate < (1 - this.config.failureThreshold)) {
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
     * 记录API请求结果（增强版）
     */
    recordApiResult(apiKey, success, responseTime = 0, error = null, requestType = 'default') {
        let stat = this.apiStats.get(apiKey);
        if (!stat) {
            stat = this.createApiStat(apiKey);
            this.apiStats.set(apiKey, stat);
        }

        const now = Date.now();

        // 更新请求计数
        stat.requestCount++;
        stat.totalResponseTime += responseTime;

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
        } else {
            stat.failureCount++;
            stat.lastFailureTime = now;
            stat.consecutiveFailures++;
            
            // 连续失败过多时加入黑名单
            if (stat.consecutiveFailures >= this.config.blacklistThreshold) {
                stat.isBlacklisted = true;
                stat.blacklistUntil = now + this.config.cooldownPeriod;
                console.warn(`API ${apiKey} 已被加入黑名单，冷却期: ${this.config.cooldownPeriod / 1000}秒`);
            }
        }

        // 更新成功率
        if (stat.requestCount > 0) {
            stat.successRate = stat.successCount / stat.requestCount;
        }

        // 更新可靠性评分
        this.updateReliabilityScore(apiKey, success, responseTime);

        // 减少当前负载
        this.decreaseApiLoad(apiKey);
        
        // 记录性能历史
        this.recordPerformanceHistory(apiKey, success, responseTime, requestType);
        
        this.saveStats();
    }

    /**
     * 更新API可靠性评分
     */
    updateReliabilityScore(apiKey, success, responseTime) {
        const stat = this.apiStats.get(apiKey);
        if (!stat) return;

        // 基于成功率和响应时间计算可靠性评分
        let reliability = 100;
        
        // 成功率影响 (0-40分)
        reliability *= stat.successRate * 0.4;
        
        // 响应时间影响 (0-40分)
        if (responseTime > 0) {
            const timeFactor = Math.max(0, 1 - (responseTime / this.config.responseTimeThreshold));
            reliability += timeFactor * 40;
        }
        
        // 连续失败惩罚 (最多扣20分)
        reliability -= Math.min(stat.consecutiveFailures * 5, 20);
        
        stat.reliabilityScore = Math.max(0, Math.min(100, reliability));
    }

    /**
     * 记录性能历史
     */
    recordPerformanceHistory(apiKey, success, responseTime, requestType) {
        if (!this.performanceHistory.has(apiKey)) {
            this.performanceHistory.set(apiKey, []);
        }
        
        const history = this.performanceHistory.get(apiKey);
        history.push({
            timestamp: Date.now(),
            success,
            responseTime,
            requestType
        });
        
        // 保持历史记录在窗口大小内
        if (history.length > this.config.performanceWindow) {
            history.shift();
        }
    }

    /**
     * 获取API性能统计
     */
    getApiPerformanceStats(apiKey) {
        const history = this.performanceHistory.get(apiKey) || [];
        if (history.length === 0) return null;
        
        const recentHistory = history.slice(-20); // 只考虑最近20次请求
        const successCount = recentHistory.filter(item => item.success).length;
        const avgResponseTime = recentHistory.reduce((sum, item) => sum + item.responseTime, 0) / recentHistory.length;
        
        return {
            successRate: successCount / recentHistory.length,
            averageResponseTime: avgResponseTime,
            totalRequests: recentHistory.length
        };
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
     * 将请求加入队列
     * @param {string} requestId - 请求ID
     * @param {Function} requestFn - 请求函数
     * @param {number} priority - 优先级 (1-10, 10为最高优先级)
     */
    queueRequest(requestId, requestFn, priority = 5) {
        // 确保优先级在有效范围内
        priority = Math.max(1, Math.min(10, Math.floor(priority)));
        
        // 初始化该优先级的队列
        if (!this.requestQueue.has(priority)) {
            this.requestQueue.set(priority, []);
        }
        
        // 将请求添加到对应优先级的队列
        this.requestQueue.get(priority).push({
            id: requestId,
            fn: requestFn,
            priority: priority,
            timestamp: Date.now()
        });
        
        console.log(`请求 ${requestId} 已加入优先级 ${priority} 队列`);
        
        // 尝试处理队列中的请求
        this.processQueue();
    }

    /**
     * 处理请求队列
     */
    processQueue() {
        // 按优先级从高到低处理队列
        const priorities = Array.from(this.requestQueue.keys()).sort((a, b) => b - a);
        
        for (const priority of priorities) {
            const queue = this.requestQueue.get(priority);
            if (queue && queue.length > 0) {
                // 处理该优先级队列中的请求
                while (queue.length > 0) {
                    const request = queue.shift();
                    if (request) {
                        console.log(`正在处理优先级 ${priority} 的请求 ${request.id}`);
                        // 执行请求
                        request.fn()
                            .then(result => {
                                console.log(`请求 ${request.id} 处理成功`);
                            })
                            .catch(error => {
                                console.error(`请求 ${request.id} 处理失败:`, error);
                            })
                            .finally(() => {
                                // 继续处理队列
                                this.processQueue();
                            });
                        // 一次只处理一个请求，等待其完成后再处理下一个
                        break;
                    }
                }
            }
        }
    }

    /**
     * 执行带负载均衡的搜索请求（增强版）
     */
    async executeSearchRequest(query, preferredApis = null) {
        const cacheKey = `search_${query}`;
        
        // 首先尝试从缓存获取
        if (this.cache) {
            try {
                const cachedResult = await this.cache.get(cacheKey, 'search');
                if (cachedResult) {
                    console.log(`从缓存获取搜索结果: ${query}`);
                    return cachedResult;
                }
            } catch (e) {
                console.warn('搜索缓存读取失败:', e);
            }
        }
        
        const selectedApis = preferredApis || this.getSelectedApis();
        let lastError = null;
        
        // 尝试多个API源
        for (let attempt = 0; attempt < Math.min(selectedApis.length, 3); attempt++) {
            try {
                const apiKey = this.getBestApi(selectedApis.filter(api => 
                    !this.isApiOverloaded(api) && 
                    selectedApis.includes(api)
                ), 'search');
                
                this.increaseApiLoad(apiKey);
                
                const startTime = Date.now();
                const result = await this.performSearch(apiKey, query);
                const responseTime = Date.now() - startTime;
                
                this.recordApiResult(apiKey, true, responseTime, null, 'search');
                
                // 缓存结果
                if (this.cache && result && result.length > 0) {
                    try {
                        await this.cache.set(cacheKey, result, 'search');
                    } catch (e) {
                        console.warn('搜索结果缓存失败:', e);
                    }
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                if (this.activeRequests.has(this.lastUsedApi)) {
                    this.recordApiResult(this.lastUsedApi, false, 0, error, 'search');
                }
                
                console.warn(`搜索请求失败 (尝试 ${attempt + 1}):`, error.message);
                
                // 如果不是最后一次尝试，等待一小段时间再重试
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        throw lastError || new Error('所有API源都不可用');
    }

    /**
     * 执行实际的搜索请求
     */
    async performSearch(apiKey, query) {
        this.lastUsedApi = apiKey;
        
        // 这里调用原有的搜索函数
        return await searchByAPIAndKeyWord(apiKey, query);
    }

    /**
     * 获取API详情（带缓存）
     */
    async getApiDetail(apiKey, vodId) {
        const cacheKey = `detail_${apiKey}_${vodId}`;
        
        // 首先尝试从缓存获取
        if (this.cache) {
            try {
                const cachedResult = await this.cache.get(cacheKey, 'detail');
                if (cachedResult) {
                    console.log(`从缓存获取详情: ${apiKey}_${vodId}`);
                    return cachedResult;
                }
            } catch (e) {
                console.warn('详情缓存读取失败:', e);
            }
        }
        
        try {
            const startTime = Date.now();
            const result = await this.performDetailRequest(apiKey, vodId);
            const responseTime = Date.now() - startTime;
            
            this.recordApiResult(apiKey, true, responseTime, null, 'detail');
            
            // 缓存结果
            if (this.cache && result) {
                try {
                    await this.cache.set(cacheKey, result, 'detail');
                } catch (e) {
                    console.warn('详情结果缓存失败:', e);
                }
            }
            
            return result;
        } catch (error) {
            this.recordApiResult(apiKey, false, 0, error, 'detail');
            throw error;
        }
    }
    
    /**
     * 执行详情请求
     */
    async performDetailRequest(apiKey, vodId) {
        // 构建API参数
        let apiParams = '';
        
        // 处理自定义API源
        if (apiKey.startsWith('custom_')) {
            const customIndex = apiKey.replace('custom_', '');
            const customApi = this.getCustomApiInfo(customIndex);
            if (!customApi) {
                throw new Error('自定义API配置无效');
            }
            // 传递 detail 字段
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            // 内置API
            apiParams = '&source=' + apiKey;
        }
        
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * 获取自定义API信息
     */
    getCustomApiInfo(customApiIndex) {
        try {
            const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
            const index = parseInt(customApiIndex);
            if (isNaN(index) || index < 0 || index >= customAPIs.length) {
                return null;
            }
            return customAPIs[index];
        } catch (e) {
            console.error('获取自定义API信息失败:', e);
            return null;
        }
    }

    /**
     * 开始健康检查
     */
    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        
        // 立即执行一次健康检查
        this.performHealthCheck();
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        const selectedApis = this.getSelectedApis();
        const healthCheckPromises = selectedApis.map(apiKey => 
            this.checkApiHealth(apiKey)
        );
        
        try {
            await Promise.allSettled(healthCheckPromises);
            console.log('健康检查完成');
        } catch (error) {
            console.error('健康检查失败:', error);
        }
    }

    /**
     * 检查单个API的健康状态
     */
    async checkApiHealth(apiKey) {
        try {
            const startTime = Date.now();
            
            // 使用简单的测试查询
            const result = await this.performSearch(apiKey, 'test');
            const responseTime = Date.now() - startTime;
            
            this.recordApiResult(apiKey, true, responseTime, null, 'health');
            
            const stat = this.apiStats.get(apiKey);
            if (stat) {
                stat.lastHealthCheck = Date.now();
                stat.isHealthy = true;
            }
            
        } catch (error) {
            this.recordApiResult(apiKey, false, 0, error, 'health');
            
            const stat = this.apiStats.get(apiKey);
            if (stat) {
                stat.lastHealthCheck = Date.now();
                stat.isHealthy = false;
            }
        }
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
     * 获取健康的API数量
     */
    getHealthyApiCount() {
        let count = 0;
        this.apiStats.forEach(stat => {
            if (this.isApiHealthy(stat)) count++;
        });
        return count;
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
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.saveStats();
    }
}

// 创建全局负载均衡器实例
window.loadBalancer = new LoadBalancer();