/**
 * 基准测试优化器
 * 用于持续监控和优化LeLeTV平台的性能基准
 * @version 1.0.0
 */

class BenchmarkOptimizer {
    constructor() {
        this.baselineMetrics = {};
        this.currentMetrics = {};
        this.optimizationHistory = [];
        this.init();
    }

    /**
     * 初始化基准测试优化器
     */
    init() {
        // 从本地存储加载基准数据
        this.loadBaselineMetrics();
        
        // 设置定期检查
        setInterval(() => {
            this.runPeriodicOptimizationCheck();
        }, 300000); // 每5分钟检查一次
    }

    /**
     * 运行基准测试
     */
    async runBenchmark() {
        console.log('开始运行基准测试...');
        
        // 运行性能测试套件
        const performanceTest = new PerformanceTest();
        await performanceTest.runPerformanceTestSuite();
        
        // 获取测试结果
        const testResults = performanceTest.exportTestResults();
        
        // 更新当前指标
        this.updateCurrentMetrics(testResults);
        
        // 与基准进行比较
        const comparison = this.compareWithBaseline();
        
        // 记录优化历史
        this.recordOptimizationHistory(comparison);
        
        console.log('基准测试完成');
        return comparison;
    }

    /**
     * 更新当前指标
     */
    updateCurrentMetrics(testResults) {
        this.currentMetrics = {
            timestamp: Date.now(),
            testResults: testResults
        };
    }

    /**
     * 与基准进行比较
     */
    compareWithBaseline() {
        if (!this.baselineMetrics.testResults) {
            return {
                status: 'no_baseline',
                message: '没有基准数据可供比较'
            };
        }
        
        // 比较关键指标
        const comparison = {
            status: 'compared',
            timestamp: Date.now(),
            metrics: {}
        };
        
        // 比较页面加载时间
        const currentPageLoad = this.getMetricValue(this.currentMetrics, 'pageLoadPerformance', 'navigationTiming', 'loadTime');
        const baselinePageLoad = this.getMetricValue(this.baselineMetrics, 'pageLoadPerformance', 'navigationTiming', 'loadTime');
        
        if (currentPageLoad !== null && baselinePageLoad !== null) {
            comparison.metrics.pageLoadTime = {
                current: currentPageLoad,
                baseline: baselinePageLoad,
                improvement: baselinePageLoad - currentPageLoad,
                percentage: ((baselinePageLoad - currentPageLoad) / baselinePageLoad * 100).toFixed(2)
            };
        }
        
        // 比较API响应时间
        const currentAPIResponse = this.getMetricValue(this.currentMetrics, 'apiResponseTimes', 'averageResponseTime');
        const baselineAPIResponse = this.getMetricValue(this.baselineMetrics, 'apiResponseTimes', 'averageResponseTime');
        
        if (currentAPIResponse !== null && baselineAPIResponse !== null) {
            comparison.metrics.apiResponseTime = {
                current: currentAPIResponse,
                baseline: baselineAPIResponse,
                improvement: baselineAPIResponse - currentAPIResponse,
                percentage: ((baselineAPIResponse - currentAPIResponse) / baselineAPIResponse * 100).toFixed(2)
            };
        }
        
        // 比较图片加载时间
        const currentImageLoad = this.getMetricValue(this.currentMetrics, 'imageLoadingPerformance', 'averageLoadTime');
        const baselineImageLoad = this.getMetricValue(this.baselineMetrics, 'imageLoadingPerformance', 'averageLoadTime');
        
        if (currentImageLoad !== null && baselineImageLoad !== null) {
            comparison.metrics.imageLoadTime = {
                current: currentImageLoad,
                baseline: baselineImageLoad,
                improvement: baselineImageLoad - currentImageLoad,
                percentage: ((baselineImageLoad - currentImageLoad) / baselineImageLoad * 100).toFixed(2)
            };
        }
        
        // 比较内存使用
        const currentMemoryScore = this.getMetricValue(this.currentMetrics, 'memoryUsage', 'memoryScore');
        const baselineMemoryScore = this.getMetricValue(this.baselineMetrics, 'memoryUsage', 'memoryScore');
        
        if (currentMemoryScore !== null && baselineMemoryScore !== null) {
            comparison.metrics.memoryUsage = {
                current: currentMemoryScore,
                baseline: baselineMemoryScore,
                improvement: currentMemoryScore - baselineMemoryScore,
                percentage: ((currentMemoryScore - baselineMemoryScore) / baselineMemoryScore * 100).toFixed(2)
            };
        }
        
        return comparison;
    }

    /**
     * 获取指标值
     */
    getMetricValue(metrics, testType, ...path) {
        if (!metrics.testResults) return null;
        
        // 查找对应的测试结果
        const testResult = metrics.testResults.find(result => result.test === testType);
        if (!testResult) return null;
        
        // 按路径获取值
        let value = testResult;
        for (const key of path) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return null;
            }
        }
        
        return value;
    }

    /**
     * 记录优化历史
     */
    recordOptimizationHistory(comparison) {
        this.optimizationHistory.push({
            timestamp: Date.now(),
            comparison: comparison
        });
        
        // 限制历史记录数量
        if (this.optimizationHistory.length > 100) {
            this.optimizationHistory.shift();
        }
        
        // 保存到本地存储
        this.saveOptimizationHistory();
    }

    /**
     * 设置新的基准
     */
    setNewBaseline() {
        this.baselineMetrics = JSON.parse(JSON.stringify(this.currentMetrics));
        this.saveBaselineMetrics();
        
        console.log('新的基准已设置');
    }

    /**
     * 保存基准指标
     */
    saveBaselineMetrics() {
        try {
            localStorage.setItem('benchmark_baseline', JSON.stringify(this.baselineMetrics));
        } catch (error) {
            console.warn('保存基准指标失败:', error);
        }
    }

    /**
     * 加载基准指标
     */
    loadBaselineMetrics() {
        try {
            const baselineData = localStorage.getItem('benchmark_baseline');
            if (baselineData) {
                this.baselineMetrics = JSON.parse(baselineData);
            }
        } catch (error) {
            console.warn('加载基准指标失败:', error);
        }
    }

    /**
     * 保存优化历史
     */
    saveOptimizationHistory() {
        try {
            localStorage.setItem('benchmark_history', JSON.stringify(this.optimizationHistory));
        } catch (error) {
            console.warn('保存优化历史失败:', error);
        }
    }

    /**
     * 加载优化历史
     */
    loadOptimizationHistory() {
        try {
            const historyData = localStorage.getItem('benchmark_history');
            if (historyData) {
                this.optimizationHistory = JSON.parse(historyData);
            }
        } catch (error) {
            console.warn('加载优化历史失败:', error);
        }
    }

    /**
     * 获取优化建议
     */
    getOptimizationSuggestions() {
        const suggestions = [];
        
        // 如果没有基准数据，建议设置基准
        if (!this.baselineMetrics.testResults) {
            suggestions.push({
                type: 'setup_baseline',
                priority: 'high',
                message: '建议运行基准测试并设置性能基准，以便后续比较和优化'
            });
            return suggestions;
        }
        
        // 分析当前性能数据并提供优化建议
        const comparison = this.compareWithBaseline();
        
        if (comparison.metrics.pageLoadTime) {
            const pageLoad = comparison.metrics.pageLoadTime;
            if (pageLoad.improvement < 0) {
                // 页面加载时间变慢了
                suggestions.push({
                    type: 'page_load',
                    priority: 'high',
                    message: `页面加载时间变慢了 ${Math.abs(pageLoad.improvement).toFixed(2)}ms (${Math.abs(pageLoad.percentage)}%)`,
                    recommendation: '检查是否有新增的阻塞资源或代码，优化关键渲染路径'
                });
            } else if (pageLoad.improvement > 0) {
                // 页面加载时间改善了
                suggestions.push({
                    type: 'page_load',
                    priority: 'low',
                    message: `页面加载时间改善了 ${pageLoad.improvement.toFixed(2)}ms (${pageLoad.percentage}%)`,
                    recommendation: '继续保持良好的优化实践'
                });
            }
        }
        
        if (comparison.metrics.apiResponseTime) {
            const apiResponse = comparison.metrics.apiResponseTime;
            if (apiResponse.improvement < 0) {
                // API响应时间变慢了
                suggestions.push({
                    type: 'api_response',
                    priority: 'medium',
                    message: `API平均响应时间变慢了 ${Math.abs(apiResponse.improvement).toFixed(2)}ms (${Math.abs(apiResponse.percentage)}%)`,
                    recommendation: '检查API源的性能，考虑优化负载均衡策略'
                });
            } else if (apiResponse.improvement > 0) {
                // API响应时间改善了
                suggestions.push({
                    type: 'api_response',
                    priority: 'low',
                    message: `API平均响应时间改善了 ${apiResponse.improvement.toFixed(2)}ms (${apiResponse.percentage}%)`,
                    recommendation: 'API性能优化效果良好'
                });
            }
        }
        
        if (comparison.metrics.imageLoadTime) {
            const imageLoad = comparison.metrics.imageLoadTime;
            if (imageLoad.improvement < 0) {
                // 图片加载时间变慢了
                suggestions.push({
                    type: 'image_load',
                    priority: 'medium',
                    message: `图片平均加载时间变慢了 ${Math.abs(imageLoad.improvement).toFixed(2)}ms (${Math.abs(imageLoad.percentage)}%)`,
                    recommendation: '检查图片懒加载配置，优化图片格式和大小'
                });
            } else if (imageLoad.improvement > 0) {
                // 图片加载时间改善了
                suggestions.push({
                    type: 'image_load',
                    priority: 'low',
                    message: `图片平均加载时间改善了 ${imageLoad.improvement.toFixed(2)}ms (${imageLoad.percentage}%)`,
                    recommendation: '图片加载优化效果良好'
                });
            }
        }
        
        if (comparison.metrics.memoryUsage) {
            const memoryUsage = comparison.metrics.memoryUsage;
            if (memoryUsage.improvement < 0) {
                // 内存使用变差了
                suggestions.push({
                    type: 'memory_usage',
                    priority: 'medium',
                    message: `内存使用评分下降了 ${Math.abs(memoryUsage.improvement).toFixed(2)}分 (${Math.abs(memoryUsage.percentage)}%)`,
                    recommendation: '检查是否有内存泄漏，优化数据结构和缓存策略'
                });
            } else if (memoryUsage.improvement > 0) {
                // 内存使用改善了
                suggestions.push({
                    type: 'memory_usage',
                    priority: 'low',
                    message: `内存使用评分提高了 ${memoryUsage.improvement.toFixed(2)}分 (${memoryUsage.percentage}%)`,
                    recommendation: '内存管理优化效果良好'
                });
            }
        }
        
        return suggestions;
    }

    /**
     * 运行定期优化检查
     */
    async runPeriodicOptimizationCheck() {
        console.log('运行定期优化检查...');
        
        try {
            // 运行基准测试
            await this.runBenchmark();
            
            // 获取优化建议
            const suggestions = this.getOptimizationSuggestions();
            
            // 如果有高优先级建议，记录到控制台
            const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');
            if (highPrioritySuggestions.length > 0) {
                console.warn('发现高优先级优化建议:', highPrioritySuggestions);
            }
            
            // 保存优化建议到本地存储
            try {
                localStorage.setItem('optimization_suggestions', JSON.stringify(suggestions));
            } catch (error) {
                console.warn('保存优化建议失败:', error);
            }
        } catch (error) {
            console.error('定期优化检查失败:', error);
        }
    }

    /**
     * 获取性能趋势
     */
    getPerformanceTrend() {
        if (this.optimizationHistory.length < 2) {
            return '数据不足，无法确定趋势';
        }
        
        // 获取最近两次的比较结果
        const recentComparisons = this.optimizationHistory.slice(-2);
        const previous = recentComparisons[0].comparison;
        const current = recentComparisons[1].comparison;
        
        // 分析趋势
        const trends = [];
        
        // 页面加载时间趋势
        if (previous.metrics.pageLoadTime && current.metrics.pageLoadTime) {
            const previousTime = previous.metrics.pageLoadTime.current;
            const currentTime = current.metrics.pageLoadTime.current;
            
            if (currentTime < previousTime) {
                trends.push('页面加载时间在改善');
            } else if (currentTime > previousTime) {
                trends.push('页面加载时间在恶化');
            } else {
                trends.push('页面加载时间保持稳定');
            }
        }
        
        // API响应时间趋势
        if (previous.metrics.apiResponseTime && current.metrics.apiResponseTime) {
            const previousTime = previous.metrics.apiResponseTime.current;
            const currentTime = current.metrics.apiResponseTime.current;
            
            if (currentTime < previousTime) {
                trends.push('API响应时间在改善');
            } else if (currentTime > previousTime) {
                trends.push('API响应时间在恶化');
            } else {
                trends.push('API响应时间保持稳定');
            }
        }
        
        return trends.length > 0 ? trends : '暂无趋势数据';
    }

    /**
     * 生成优化报告
     */
    generateOptimizationReport() {
        const suggestions = this.getOptimizationSuggestions();
        const trend = this.getPerformanceTrend();
        
        let report = '=== LeLeTV优化报告 ===\n\n';
        
        report += '优化建议:\n';
        if (suggestions.length > 0) {
            suggestions.forEach((suggestion, index) => {
                report += `${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.message}\n`;
                report += `   建议: ${suggestion.recommendation}\n\n`;
            });
        } else {
            report += '暂无优化建议\n\n';
        }
        
        report += '性能趋势:\n';
        if (Array.isArray(trend)) {
            trend.forEach(t => {
                report += `- ${t}\n`;
            });
        } else {
            report += trend + '\n';
        }
        
        return report;
    }

    /**
     * 导出基准数据
     */
    exportBaselineData() {
        return {
            baselineMetrics: this.baselineMetrics,
            optimizationHistory: this.optimizationHistory,
            timestamp: Date.now(),
            version: '1.0.0'
        };
    }

    /**
     * 导入基准数据
     */
    importBaselineData(data) {
        if (data.baselineMetrics) {
            this.baselineMetrics = data.baselineMetrics;
        }
        
        if (data.optimizationHistory) {
            this.optimizationHistory = data.optimizationHistory;
        }
    }
}

// 创建全局实例
window.benchmarkOptimizer = new BenchmarkOptimizer();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BenchmarkOptimizer;
}