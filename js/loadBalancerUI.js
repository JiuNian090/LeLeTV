/**
 * 负载均衡状态显示组件
 */

class LoadBalancerUI {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.createStatusPanel();
        this.setupEventListeners();
    }

    /**
     * 创建状态面板
     */
    createStatusPanel() {
        // 创建触发按钮
        const triggerButton = document.createElement('button');
        triggerButton.id = 'loadBalancerTrigger';
        triggerButton.className = 'fixed top-4 right-20 z-[60] bg-[#222] hover:bg-[#333] border border-[#333] hover:border-white rounded-lg px-3 py-1.5 transition-colors';
        triggerButton.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2M3 17V9a2 2 0 012-2h14a2 2 0 012 2v8M7 17v-2M12 17v-4M17 17v-6"/>
            </svg>
        `;
        triggerButton.setAttribute('aria-label', '查看负载均衡状态');
        triggerButton.title = '查看负载均衡状态';
        
        // 创建状态面板
        const statusPanel = document.createElement('div');
        statusPanel.id = 'loadBalancerPanel';
        statusPanel.className = 'fixed top-16 right-4 z-[60] bg-[#111] border border-[#333] rounded-lg shadow-xl max-w-md w-80 hidden transform transition-all duration-300 max-h-[80vh] overflow-hidden';
        statusPanel.innerHTML = `
            <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-white">负载均衡状态</h3>
                    <button id="closeLoadBalancerPanel" class="text-gray-400 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <!-- 总体统计 -->
                    <div class="bg-[#1a1a1a] p-3 rounded-lg">
                        <h4 class="text-sm font-semibold text-gray-300 mb-2">总体状态</h4>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div class="text-center">
                                <div class="text-green-400 font-bold" id="healthyApiCount">-</div>
                                <div class="text-gray-500">健康API</div>
                            </div>
                            <div class="text-center">
                                <div class="text-yellow-400 font-bold" id="totalApiCount">-</div>
                                <div class="text-gray-500">总API数</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- API列表 -->
                    <div class="bg-[#1a1a1a] p-3 rounded-lg">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="text-sm font-semibold text-gray-300">API源状态</h4>
                            <button id="resetStatsBtn" class="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                重置统计
                            </button>
                        </div>
                        <div id="apiStatusList" class="space-y-2 max-h-60 overflow-y-auto">
                            <!-- API状态列表将在这里动态生成 -->
                        </div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div class="flex space-x-2">
                        <button id="healthCheckBtn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-xs transition-colors">
                            立即健康检查
                        </button>
                        <button id="exportStatsBtn" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-xs transition-colors">
                            导出统计
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(triggerButton);
        document.body.appendChild(statusPanel);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 触发按钮点击事件
        document.getElementById('loadBalancerTrigger').addEventListener('click', () => {
            this.togglePanel();
        });

        // 关闭面板按钮
        document.getElementById('closeLoadBalancerPanel').addEventListener('click', () => {
            this.hidePanel();
        });

        // 重置统计按钮
        document.getElementById('resetStatsBtn').addEventListener('click', () => {
            this.resetStats();
        });

        // 健康检查按钮
        document.getElementById('healthCheckBtn').addEventListener('click', () => {
            this.performHealthCheck();
        });

        // 导出统计按钮
        document.getElementById('exportStatsBtn').addEventListener('click', () => {
            this.exportStats();
        });

        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('loadBalancerPanel');
            const trigger = document.getElementById('loadBalancerTrigger');
            
            if (this.isVisible && !panel.contains(e.target) && !trigger.contains(e.target)) {
                this.hidePanel();
            }
        });
    }

    /**
     * 切换面板显示状态
     */
    togglePanel() {
        if (this.isVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }

    /**
     * 显示面板
     */
    showPanel() {
        const panel = document.getElementById('loadBalancerPanel');
        panel.classList.remove('hidden');
        this.isVisible = true;
        
        // 开始更新统计数据
        this.updateStats();
        this.updateInterval = setInterval(() => {
            this.updateStats();
        }, 3000); // 每3秒更新一次
    }

    /**
     * 隐藏面板
     */
    hidePanel() {
        const panel = document.getElementById('loadBalancerPanel');
        panel.classList.add('hidden');
        this.isVisible = false;
        
        // 停止更新统计数据
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * 更新统计数据显示
     */
    updateStats() {
        if (!window.loadBalancer) {
            document.getElementById('healthyApiCount').textContent = '不可用';
            document.getElementById('totalApiCount').textContent = '不可用';
            document.getElementById('apiStatusList').innerHTML = '<div class="text-center text-gray-500 py-4">负载均衡器不可用</div>';
            return;
        }

        const stats = window.loadBalancer.getApiStats();
        const healthyCount = window.loadBalancer.getHealthyApiCount();
        const totalCount = Object.keys(stats).length;

        // 更新总体统计
        document.getElementById('healthyApiCount').textContent = healthyCount;
        document.getElementById('totalApiCount').textContent = totalCount;

        // 更新API状态列表
        this.renderApiStatusList(stats);
    }

    /**
     * 渲染API状态列表
     */
    renderApiStatusList(stats) {
        const container = document.getElementById('apiStatusList');
        
        if (Object.keys(stats).length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">暂无API统计数据</div>';
            return;
        }

        const apiItems = Object.entries(stats).map(([apiKey, stat]) => {
            const isHealthy = window.loadBalancer.isApiHealthy(stat);
            const successRate = stat.successCount + stat.failureCount > 0 
                ? ((stat.successCount / (stat.successCount + stat.failureCount)) * 100).toFixed(1)
                : '0.0';
            
            const apiName = this.getApiDisplayName(apiKey);
            const statusIcon = isHealthy ? '🟢' : '🔴';
            const statusText = isHealthy ? '健康' : '异常';
            
            return `
                <div class="bg-[#222] p-2 rounded border border-[#333]">
                    <div class="flex justify-between items-start mb-1">
                        <div class="flex items-center space-x-2">
                            <span class="text-xs">${statusIcon}</span>
                            <span class="text-sm font-medium text-white truncate max-w-24" title="${apiName}">${apiName}</span>
                        </div>
                        <span class="text-xs ${isHealthy ? 'text-green-400' : 'text-red-400'}">${statusText}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-xs text-gray-400">
                        <div class="text-center">
                            <div class="text-white font-medium">${successRate}%</div>
                            <div>成功率</div>
                        </div>
                        <div class="text-center">
                            <div class="text-white font-medium">${stat.averageResponseTime ? Math.round(stat.averageResponseTime) : 0}ms</div>
                            <div>响应时间</div>
                        </div>
                        <div class="text-center">
                            <div class="text-white font-medium">${stat.load || 0}</div>
                            <div>当前负载</div>
                        </div>
                    </div>
                    ${stat.consecutiveFailures > 0 ? `
                        <div class="mt-1 text-xs text-red-400">
                            连续失败: ${stat.consecutiveFailures}次
                        </div>
                    ` : ''}
                    ${stat.isBlacklisted ? `
                        <div class="mt-1 text-xs text-yellow-400">
                            已列入黑名单
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = apiItems;
    }

    /**
     * 获取API显示名称
     */
    getApiDisplayName(apiKey) {
        if (apiKey.startsWith('custom_')) {
            const customIndex = apiKey.replace('custom_', '');
            const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
            return customAPIs[customIndex]?.name || `自定义${parseInt(customIndex) + 1}`;
        }
        
        return API_SITES[apiKey]?.name || apiKey;
    }

    /**
     * 重置统计数据
     */
    resetStats() {
        if (!window.loadBalancer) {
            this.showToast('负载均衡器不可用', 'error');
            return;
        }

        if (confirm('确定要重置所有API的统计数据吗？')) {
            window.loadBalancer.resetApiStats();
            this.updateStats();
            this.showToast('统计数据已重置', 'success');
        }
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        if (!window.loadBalancer) {
            this.showToast('负载均衡器不可用', 'error');
            return;
        }

        const button = document.getElementById('healthCheckBtn');
        const originalText = button.textContent;
        
        button.textContent = '检查中...';
        button.disabled = true;

        try {
            await window.loadBalancer.performHealthCheck();
            this.updateStats();
            this.showToast('健康检查完成', 'success');
        } catch (error) {
            console.error('健康检查失败:', error);
            this.showToast('健康检查失败', 'error');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    /**
     * 导出统计数据
     */
    exportStats() {
        if (!window.loadBalancer) {
            this.showToast('负载均衡器不可用', 'error');
            return;
        }

        const stats = window.loadBalancer.getApiStats();
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            stats: stats
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loadbalancer-stats-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('统计数据已导出', 'success');
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        // 如果有全局的showToast函数，使用它
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            // 简单的fallback提示
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        const elements = ['loadBalancerTrigger', 'loadBalancerPanel'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });

        this.isVisible = false;
    }
}

// 等待页面加载完成后初始化负载均衡UI
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他组件已加载
    setTimeout(() => {
        if (window.loadBalancer) {
            window.loadBalancerUI = new LoadBalancerUI();
        }
    }, 1000);
});