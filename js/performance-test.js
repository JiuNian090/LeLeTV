/**
 * 性能测试和验证工具
 * 用于评估LeLeTV平台的性能优化效果
 * @version 1.0.0
 */

class PerformanceTest {
    constructor() {
        this.testResults = [];
        this.init();
    }

    /**
     * 初始化性能测试工具
     */
    init() {
        // 检查浏览器是否支持性能API
        if (!('performance' in window)) {
            console.warn('浏览器不支持Performance API');
            return;
        }
    }

    /**
     * 运行完整的性能测试套件
     */
    async runPerformanceTestSuite() {
        console.log('开始运行性能测试套件...');
        
        // 1. 页面加载性能测试
        await this.testPageLoadPerformance();
        
        // 2. API响应时间测试
        await this.testAPIResponseTimes();
        
        // 3. 图片加载性能测试
        await this.testImageLoadingPerformance();
        
        // 4. 视频播放启动时间测试
        await this.testVideoPlaybackStartup();
        
        // 5. 内存使用测试
        this.testMemoryUsage();
        
        // 6. 用户交互响应测试
        await this.testUserInteractionResponse();
        
        console.log('性能测试套件运行完成');
        return this.testResults;
    }

    /**
     * 测试页面加载性能
     */
    async testPageLoadPerformance() {
        console.log('测试页面加载性能...');
        
        // 等待页面完全加载
        await this.waitForPageLoad();
        
        // 获取导航计时信息
        const navigationTiming = this.getNavigationTiming();
        
        // 获取绘制计时信息
        const paintTiming = this.getPaintTiming();
        
        // 记录测试结果
        const result = {
            test: 'pageLoadPerformance',
            timestamp: Date.now(),
            navigationTiming,
            paintTiming,
            overallScore: this.calculatePageLoadScore(navigationTiming, paintTiming)
        };
        
        this.testResults.push(result);
        console.log('页面加载性能测试完成:', result);
    }

    /**
     * 等待页面完全加载
     */
    waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
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
     * 计算页面加载评分
     */
    calculatePageLoadScore(navigationTiming, paintTiming) {
        if (!navigationTiming || !paintTiming) {
            return 0;
        }

        // 基于关键指标计算评分 (满分100分)
        let score = 100;
        
        // TTFB评分 (目标: < 200ms)
        if (navigationTiming.ttfb > 200) {
            score -= Math.min(30, (navigationTiming.ttfb - 200) / 10);
        }
        
        // 页面加载时间评分 (目标: < 2000ms)
        if (navigationTiming.loadTime > 2000) {
            score -= Math.min(30, (navigationTiming.loadTime - 2000) / 50);
        }
        
        // 首次绘制时间评分 (目标: < 1000ms)
        if (paintTiming['first-paint'] > 1000) {
            score -= Math.min(20, (paintTiming['first-paint'] - 1000) / 20);
        }
        
        // 首次内容绘制时间评分 (目标: < 1500ms)
        if (paintTiming['first-contentful-paint'] > 1500) {
            score -= Math.min(20, (paintTiming['first-contentful-paint'] - 1500) / 30);
        }
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * 测试API响应时间
     */
    async testAPIResponseTimes() {
        console.log('测试API响应时间...');
        
        // 获取选中的API列表
        const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
        const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        
        if (selectedAPIs.length === 0) {
            console.log('没有选中的API，跳过API响应时间测试');
            return;
        }
        
        // 测试每个API的响应时间
        const apiTestResults = [];
        for (const apiKey of selectedAPIs) {
            try {
                const responseTime = await this.testSingleAPIResponseTime(apiKey);
                apiTestResults.push({
                    api: apiKey,
                    responseTime: responseTime,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.warn(`测试API ${apiKey} 时出错:`, error);
                apiTestResults.push({
                    api: apiKey,
                    responseTime: -1,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
        
        // 记录测试结果
        const result = {
            test: 'apiResponseTimes',
            timestamp: Date.now(),
            apiResults: apiTestResults,
            averageResponseTime: this.calculateAverageResponseTime(apiTestResults)
        };
        
        this.testResults.push(result);
        console.log('API响应时间测试完成:', result);
    }

    /**
     * 测试单个API的响应时间
     */
    async testSingleAPIResponseTime(apiKey) {
        // 构建测试URL
        let testUrl;
        if (apiKey.startsWith('custom_')) {
            const customIndex = apiKey.replace('custom_', '');
            const customApi = this.getCustomApiInfo(customIndex);
            if (!customApi) {
                throw new Error('自定义API配置无效');
            }
            testUrl = customApi.url;
        } else {
            // 使用API_SITES中的测试端点
            if (API_SITES[apiKey] && API_SITES[apiKey].test) {
                testUrl = API_SITES[apiKey].test;
            } else {
                // 如果没有专门的测试端点，使用主页
                testUrl = API_SITES[apiKey].api;
            }
        }
        
        if (!testUrl) {
            throw new Error('无法确定API测试URL');
        }
        
        // 发送测试请求
        const startTime = performance.now();
        const response = await fetch(testUrl, {
            method: 'HEAD', // 使用HEAD请求减少数据传输
            cache: 'no-cache'
        });
        const endTime = performance.now();
        
        if (!response.ok) {
            throw new Error(`API响应失败: ${response.status}`);
        }
        
        return endTime - startTime;
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
     * 计算平均响应时间
     */
    calculateAverageResponseTime(apiResults) {
        const validResults = apiResults.filter(result => result.responseTime > 0);
        if (validResults.length === 0) {
            return -1;
        }
        
        const totalResponseTime = validResults.reduce((sum, result) => sum + result.responseTime, 0);
        return totalResponseTime / validResults.length;
    }

    /**
     * 测试图片加载性能
     */
    async testImageLoadingPerformance() {
        console.log('测试图片加载性能...');
        
        // 查找页面中的图片元素
        const images = document.querySelectorAll('img[data-lazy-src], img[data-src], img[src]');
        if (images.length === 0) {
            console.log('页面中没有图片，跳过图片加载性能测试');
            return;
        }
        
        // 测试前10张图片的加载时间
        const testImages = Array.from(images).slice(0, 10);
        const imageLoadResults = [];
        
        for (const img of testImages) {
            try {
                const loadTime = await this.testSingleImageLoadTime(img);
                imageLoadResults.push({
                    src: img.src || img.dataset.lazySrc || img.dataset.src,
                    loadTime: loadTime,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.warn(`测试图片加载时间时出错:`, error);
                imageLoadResults.push({
                    src: img.src || img.dataset.lazySrc || img.dataset.src,
                    loadTime: -1,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
        
        // 记录测试结果
        const result = {
            test: 'imageLoadingPerformance',
            timestamp: Date.now(),
            imageResults: imageLoadResults,
            averageLoadTime: this.calculateAverageImageLoadTime(imageLoadResults)
        };
        
        this.testResults.push(result);
        console.log('图片加载性能测试完成:', result);
    }

    /**
     * 测试单张图片的加载时间
     */
    testSingleImageLoadTime(img) {
        return new Promise((resolve, reject) => {
            // 如果图片已经加载完成，直接返回
            if (img.complete) {
                resolve(0);
                return;
            }
            
            const startTime = performance.now();
            
            // 监听图片加载完成事件
            img.addEventListener('load', () => {
                const endTime = performance.now();
                resolve(endTime - startTime);
            });
            
            // 监听图片加载错误事件
            img.addEventListener('error', (error) => {
                reject(new Error(`图片加载失败: ${error.message}`));
            });
            
            // 设置超时
            setTimeout(() => {
                reject(new Error('图片加载超时'));
            }, 10000); // 10秒超时
        });
    }

    /**
     * 计算平均图片加载时间
     */
    calculateAverageImageLoadTime(imageResults) {
        const validResults = imageResults.filter(result => result.loadTime > 0);
        if (validResults.length === 0) {
            return -1;
        }
        
        const totalLoadTime = validResults.reduce((sum, result) => sum + result.loadTime, 0);
        return totalLoadTime / validResults.length;
    }

    /**
     * 测试视频播放启动时间
     */
    async testVideoPlaybackStartup() {
        console.log('测试视频播放启动时间...');
        
        // 这个测试需要在播放器页面进行
        if (!window.location.pathname.includes('player') && !window.location.pathname.includes('watch')) {
            console.log('不在播放器页面，跳过视频播放启动时间测试');
            return;
        }
        
        // 等待播放器初始化
        await this.waitForPlayerInitialization();
        
        // 记录测试结果
        const result = {
            test: 'videoPlaybackStartup',
            timestamp: Date.now(),
            playerInitialized: !!window.art,
            // 在实际播放时测量启动时间
            startupTime: null
        };
        
        // 如果播放器已初始化，尝试测量启动时间
        if (window.art && window.art.video) {
            // 监听播放事件来测量启动时间
            const startTime = performance.now();
            const playHandler = () => {
                const endTime = performance.now();
                result.startupTime = endTime - startTime;
                window.art.off('play', playHandler);
            };
            
            window.art.on('play', playHandler);
        }
        
        this.testResults.push(result);
        console.log('视频播放启动时间测试完成:', result);
    }

    /**
     * 等待播放器初始化
     */
    waitForPlayerInitialization() {
        return new Promise((resolve) => {
            if (window.art) {
                resolve();
            } else {
                // 等待1秒后检查
                setTimeout(() => {
                    resolve();
                }, 1000);
            }
        });
    }

    /**
     * 测试内存使用
     */
    testMemoryUsage() {
        console.log('测试内存使用...');
        
        // 获取内存信息
        const memoryInfo = this.getMemoryInfo();
        
        // 记录测试结果
        const result = {
            test: 'memoryUsage',
            timestamp: Date.now(),
            memoryInfo: memoryInfo,
            memoryScore: this.calculateMemoryScore(memoryInfo)
        };
        
        this.testResults.push(result);
        console.log('内存使用测试完成:', result);
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
     * 计算内存评分
     */
    calculateMemoryScore(memoryInfo) {
        if (!memoryInfo) {
            return 0;
        }
        
        // 基于内存使用率计算评分 (满分100分)
        const memoryUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        let score = 100;
        
        // 内存使用率评分 (目标: < 70%)
        if (memoryUsageRatio > 0.7) {
            score -= Math.min(100, (memoryUsageRatio - 0.7) * 100);
        }
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * 测试用户交互响应
     */
    async testUserInteractionResponse() {
        console.log('测试用户交互响应...');
        
        // 模拟用户点击事件并测量响应时间
        const clickResponseTime = await this.testClickResponseTime();
        
        // 记录测试结果
        const result = {
            test: 'userInteractionResponse',
            timestamp: Date.now(),
            clickResponseTime: clickResponseTime,
            interactionScore: this.calculateInteractionScore(clickResponseTime)
        };
        
        this.testResults.push(result);
        console.log('用户交互响应测试完成:', result);
    }

    /**
     * 测试点击响应时间
     */
    async testClickResponseTime() {
        // 查找一个可点击的按钮元素
        const button = document.querySelector('button');
        if (!button) {
            console.log('页面中没有按钮，跳过点击响应时间测试');
            return -1;
        }
        
        return new Promise((resolve) => {
            const startTime = performance.now();
            
            // 监听按钮点击后的变化
            const clickHandler = () => {
                const endTime = performance.now();
                button.removeEventListener('click', clickHandler);
                resolve(endTime - startTime);
            };
            
            button.addEventListener('click', clickHandler);
            
            // 模拟点击
            button.click();
            
            // 设置超时
            setTimeout(() => {
                button.removeEventListener('click', clickHandler);
                resolve(-1); // 超时
            }, 5000); // 5秒超时
        });
    }

    /**
     * 计算交互评分
     */
    calculateInteractionScore(clickResponseTime) {
        if (clickResponseTime < 0) {
            return 0;
        }
        
        // 基于点击响应时间计算评分 (满分100分)
        let score = 100;
        
        // 点击响应时间评分 (目标: < 100ms)
        if (clickResponseTime > 100) {
            score -= Math.min(100, (clickResponseTime - 100) / 2);
        }
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * 生成性能测试报告
     */
    generatePerformanceReport() {
        if (this.testResults.length === 0) {
            return '没有性能测试数据';
        }
        
        // 按测试类型分组结果
        const groupedResults = {};
        this.testResults.forEach(result => {
            if (!groupedResults[result.test]) {
                groupedResults[result.test] = [];
            }
            groupedResults[result.test].push(result);
        });
        
        // 生成报告
        let report = '=== LeLeTV性能测试报告 ===\n\n';
        
        for (const [testType, results] of Object.entries(groupedResults)) {
            report += `${this.getTestTypeName(testType)}:\n`;
            
            // 取最新的测试结果
            const latestResult = results[results.length - 1];
            
            switch (testType) {
                case 'pageLoadPerformance':
                    report += `  页面加载时间: ${latestResult.navigationTiming?.loadTime?.toFixed(2) || 'N/A'} ms\n`;
                    report += `  首次绘制时间: ${latestResult.paintTiming?.['first-paint']?.toFixed(2) || 'N/A'} ms\n`;
                    report += `  首次内容绘制时间: ${latestResult.paintTiming?.['first-contentful-paint']?.toFixed(2) || 'N/A'} ms\n`;
                    report += `  综合评分: ${latestResult.overallScore.toFixed(2)}/100\n`;
                    break;
                    
                case 'apiResponseTimes':
                    report += `  平均响应时间: ${latestResult.averageResponseTime.toFixed(2) || 'N/A'} ms\n`;
                    report += `  测试API数量: ${latestResult.apiResults.length}\n`;
                    break;
                    
                case 'imageLoadingPerformance':
                    report += `  平均图片加载时间: ${latestResult.averageLoadTime.toFixed(2) || 'N/A'} ms\n`;
                    report += `  测试图片数量: ${latestResult.imageResults.length}\n`;
                    break;
                    
                case 'videoPlaybackStartup':
                    report += `  播放器初始化: ${latestResult.playerInitialized ? '成功' : '失败'}\n`;
                    if (latestResult.startupTime) {
                        report += `  播放启动时间: ${latestResult.startupTime.toFixed(2)} ms\n`;
                    }
                    break;
                    
                case 'memoryUsage':
                    if (latestResult.memoryInfo) {
                        report += `  已使用内存: ${(latestResult.memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
                        report += `  内存限制: ${(latestResult.memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\n`;
                        report += `  内存评分: ${latestResult.memoryScore.toFixed(2)}/100\n`;
                    } else {
                        report += `  无法获取内存信息\n`;
                    }
                    break;
                    
                case 'userInteractionResponse':
                    report += `  点击响应时间: ${latestResult.clickResponseTime.toFixed(2) || 'N/A'} ms\n`;
                    report += `  交互评分: ${latestResult.interactionScore.toFixed(2)}/100\n`;
                    break;
            }
            
            report += '\n';
        }
        
        // 添加总体评估
        report += '=== 总体评估 ===\n';
        report += this.getOverallAssessment(groupedResults);
        
        return report;
    }

    /**
     * 获取测试类型名称
     */
    getTestTypeName(testType) {
        const typeNames = {
            'pageLoadPerformance': '页面加载性能',
            'apiResponseTimes': 'API响应时间',
            'imageLoadingPerformance': '图片加载性能',
            'videoPlaybackStartup': '视频播放启动',
            'memoryUsage': '内存使用',
            'userInteractionResponse': '用户交互响应'
        };
        
        return typeNames[testType] || testType;
    }

    /**
     * 获取总体评估
     */
    getOverallAssessment(groupedResults) {
        let assessment = '';
        
        // 页面加载性能评估
        if (groupedResults['pageLoadPerformance']) {
            const pageLoadResult = groupedResults['pageLoadPerformance'][groupedResults['pageLoadPerformance'].length - 1];
            if (pageLoadResult.overallScore >= 80) {
                assessment += '✅ 页面加载性能优秀\n';
            } else if (pageLoadResult.overallScore >= 60) {
                assessment += '⚠️ 页面加载性能良好，但仍有优化空间\n';
            } else {
                assessment += '❌ 页面加载性能较差，需要优化\n';
            }
        }
        
        // API响应时间评估
        if (groupedResults['apiResponseTimes']) {
            const apiResult = groupedResults['apiResponseTimes'][groupedResults['apiResponseTimes'].length - 1];
            if (apiResult.averageResponseTime > 0 && apiResult.averageResponseTime < 500) {
                assessment += '✅ API响应时间优秀\n';
            } else if (apiResult.averageResponseTime > 0 && apiResult.averageResponseTime < 1000) {
                assessment += '⚠️ API响应时间良好，但仍有优化空间\n';
            } else if (apiResult.averageResponseTime > 0) {
                assessment += '❌ API响应时间较差，需要优化\n';
            }
        }
        
        // 内存使用评估
        if (groupedResults['memoryUsage']) {
            const memoryResult = groupedResults['memoryUsage'][groupedResults['memoryUsage'].length - 1];
            if (memoryResult.memoryScore >= 80) {
                assessment += '✅ 内存使用情况良好\n';
            } else if (memoryResult.memoryScore >= 60) {
                assessment += '⚠️ 内存使用情况一般，建议优化\n';
            } else {
                assessment += '❌ 内存使用过多，需要优化\n';
            }
        }
        
        return assessment || '暂无评估数据';
    }

    /**
     * 导出测试结果
     */
    exportTestResults() {
        return {
            testResults: this.testResults,
            timestamp: Date.now(),
            version: '1.0.0'
        };
    }

    /**
     * 导入测试结果
     */
    importTestResults(data) {
        if (data.testResults) {
            this.testResults = data.testResults;
        }
    }
}

// 创建全局实例
window.performanceTest = new PerformanceTest();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceTest;
}