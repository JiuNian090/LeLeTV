/**
 * LeLeTV 缓存管理模块
 * 负责管理和清理本地存储，实现24小时自动清理功能
 * 保留用户设置和历史记录，只清理临时数据
 * @version 1.0.0
 */

class CacheManager {
    constructor() {
        // 从配置中获取缓存设置
        this.preserveKeys = window.CACHE_CONFIG?.preserveKeys || [];
        this.temporaryKeyPrefixes = window.CACHE_CONFIG?.temporaryKeyPrefixes || [];
        this.temporaryDataTTL = window.CACHE_CONFIG?.temporaryDataTTL || 24 * 60 * 60 * 1000; // 默认24小时
        this.cleanupInterval = window.CACHE_CONFIG?.cleanupInterval || 24 * 60 * 60 * 1000; // 默认24小时
        
        this.lastCleanupTimeKey = 'cacheLastCleanupTime';
        
        // 初始化时执行检查
        this.init();
    }
    
    /**
     * 初始化缓存管理器
     */
    init() {
        // 检查是否需要立即清理缓存
        this.checkAndCleanupCache();
        
        // 设置定期清理的定时器
        this.setupCleanupTimer();
        
        // 监听页面卸载事件，保存清理时间
        window.addEventListener('beforeunload', () => {
            this.saveLastCleanupTime();
        });
    }
    
    /**
     * 检查并执行缓存清理
     */
    checkAndCleanupCache() {
        const lastCleanupTime = this.getLastCleanupTime();
        const now = Date.now();
        
        // 如果距离上次清理已超过设定的间隔时间，执行清理
        if (now - lastCleanupTime >= this.cleanupInterval) {
            this.cleanupCache();
            this.saveLastCleanupTime();
        }
    }
    
    /**
     * 执行缓存清理操作
     */
    cleanupCache() {
        try {
            // 跟踪清理的项目数量
            let cleanedItems = 0;
            const now = Date.now();
            
            // 获取所有localStorage键
            const keys = Object.keys(localStorage);
            
            keys.forEach(key => {
                // 跳过需要保留的键
                if (this.preserveKeys.includes(key)) {
                    return;
                }
                
                // 检查是否是临时数据键
                const isTemporaryKey = this.temporaryKeyPrefixes.some(prefix => 
                    key.startsWith(prefix)
                );
                
                if (isTemporaryKey) {
                    // 尝试解析值以检查时间戳
                    try {
                        const item = localStorage.getItem(key);
                        if (item) {
                            // 对于videoProgress_*键，解析JSON查找timestamp
                            if (key.startsWith('videoProgress_')) {
                                try {
                                    const progressData = JSON.parse(item);
                                    if (progressData.timestamp && 
                                        now - progressData.timestamp >= this.temporaryDataTTL) {
                                        localStorage.removeItem(key);
                                        cleanedItems++;
                                    }
                                } catch (e) {
                                    // 如果解析失败，可能是旧格式数据，直接移除
                                    localStorage.removeItem(key);
                                    cleanedItems++;
                                }
                            } else {
                                // 对于其他临时数据，直接移除（因为无法确定创建时间）
                                localStorage.removeItem(key);
                                cleanedItems++;
                            }
                        }
                    } catch (e) {
                        console.error(`清理缓存项 ${key} 时出错:`, e);
                    }
                }
            });
            
            if (cleanedItems > 0) {
                console.log(`缓存清理完成，共清理 ${cleanedItems} 个临时数据项`);
                // 可选：显示清理成功提示
                this.showCleanupNotification(cleanedItems);
            }
        } catch (e) {
            console.error('缓存清理过程中发生错误:', e);
        }
    }
    
    /**
     * 设置定期清理的定时器
     */
    setupCleanupTimer() {
        // 使用setInterval定期检查缓存状态
        this.cleanupTimer = setInterval(() => {
            this.checkAndCleanupCache();
        }, this.cleanupInterval);
        
        // 确保定时器在页面关闭时被清除
        window.addEventListener('beforeunload', () => {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
        });
    }
    
    /**
     * 获取上次清理时间
     */
    getLastCleanupTime() {
        try {
            const timeStr = localStorage.getItem(this.lastCleanupTimeKey);
            return timeStr ? parseInt(timeStr, 10) : 0;
        } catch (e) {
            console.error('获取上次清理时间失败:', e);
            return 0;
        }
    }
    
    /**
     * 保存上次清理时间
     */
    saveLastCleanupTime() {
        try {
            localStorage.setItem(this.lastCleanupTimeKey, Date.now().toString());
        } catch (e) {
            console.error('保存清理时间失败:', e);
        }
    }
    
    /**
     * 显示缓存清理通知
     */
    showCleanupNotification(cleanedItems) {
        // 这里可以根据项目现有的通知系统实现
        // 如果没有现有的通知系统，可以简单地使用console.log或alert
        if (typeof showToast === 'function') {
            showToast(`缓存清理完成，释放了部分存储空间`, 'success');
        } else {
            console.log(`缓存清理完成，共清理 ${cleanedItems} 个临时数据项`);
        }
    }
    
    /**
     * 获取localStorage使用情况
     */
    getStorageUsage() {
        try {
            let totalSize = 0;
            const keys = Object.keys(localStorage);
            
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                totalSize += key.length + value.length;
            });
            
            return {
                used: totalSize,
                usedInKB: (totalSize / 1024).toFixed(2),
                keys: keys.length
            };
        } catch (e) {
            console.error('获取存储使用情况失败:', e);
            return { used: 0, usedInKB: '0.00', keys: 0 };
        }
    }
    
    /**
     * 手动清理缓存（供用户主动触发）
     */
    manualCleanup() {
        this.cleanupCache();
        this.saveLastCleanupTime();
    }
}

// 创建全局缓存管理器实例
window.cacheManager = new CacheManager();

// 暴露到全局供其他模块使用
export default CacheManager;