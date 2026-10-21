/**
 * LeLeTV 缓存管理模块
 * 负责管理和清理本地存储，实现 24 小时自动清理功能
 * 保留用户设置和历史记录，只清理临时数据
 * @version 1.0.0
 */

interface CacheConfig {
    preserveKeys?: string[];
    temporaryKeyPrefixes?: string[];
    temporaryDataTTL?: number;
    cleanupInterval?: number;
}

interface StorageUsage {
    used: number;
    usedInKB: string;
    keys: number;
}

declare function showToast(message: string, type?: string): void;

/**
 * 解析 videoProgress_* 的 JSON：
 * - ok=false 表示解析失败（原逻辑直接删除）
 * - ok=true, timestamp=null 表示解析成功但没有 timestamp（原逻辑保留）
 */
function parseProgressTimestamp(raw: string): { ok: true; timestamp: number | null } | { ok: false } {
    try {
        const data: unknown = JSON.parse(raw);
        if (typeof data !== 'object' || data === null || !('timestamp' in data)) {
            return { ok: true, timestamp: null };
        }
        const timestamp = (data as { timestamp?: unknown }).timestamp;
        return { ok: true, timestamp: typeof timestamp === 'number' ? timestamp : null };
    } catch {
        return { ok: false };
    }
}

class CacheManager {
    preserveKeys: string[];
    temporaryKeyPrefixes: string[];
    temporaryDataTTL: number;
    cleanupInterval: number;
    lastCleanupTimeKey: string;
    cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // 从配置中获取缓存设置
        const config = (window as Window & { CACHE_CONFIG?: CacheConfig }).CACHE_CONFIG;
        this.preserveKeys = config?.preserveKeys || [];
        this.temporaryKeyPrefixes = config?.temporaryKeyPrefixes || [];
        this.temporaryDataTTL = config?.temporaryDataTTL || 24 * 60 * 60 * 1000; // 默认24小时
        this.cleanupInterval = config?.cleanupInterval || 24 * 60 * 60 * 1000; // 默认24小时

        this.lastCleanupTimeKey = 'cacheLastCleanupTime';

        // 初始化时执行检查
        this.init();
    }

    /**
     * 初始化缓存管理器
     */
    init(): void {
        // 检查是否需要立即清理缓存
        this.checkAndCleanupCache();

        // 设置定期清理的定时器
        this.setupCleanupTimer();

        // 监听页面卸载/冻结，保存清理时间（用 pagehide 而非 beforeunload，以支持 bfcache 快照恢复）
        window.addEventListener('pagehide', () => {
            this.saveLastCleanupTime();
        });
    }

    /**
     * 检查并执行缓存清理
     */
    checkAndCleanupCache(): void {
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
    cleanupCache(): void {
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
                                const parsed = parseProgressTimestamp(item);
                                if (!parsed.ok) {
                                    // 如果解析失败，可能是旧格式数据，直接移除
                                    localStorage.removeItem(key);
                                    cleanedItems++;
                                } else if (parsed.timestamp !== null &&
                                    now - parsed.timestamp >= this.temporaryDataTTL) {
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
    setupCleanupTimer(): void {
        // 使用setInterval定期检查缓存状态
        this.cleanupTimer = setInterval(() => {
            this.checkAndCleanupCache();
        }, this.cleanupInterval);

        // 确保定时器在页面卸载/冻结时被清除（用 pagehide 而非 beforeunload，以支持 bfcache 快照恢复）
        window.addEventListener('pagehide', () => {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
        });
    }

    /**
     * 获取上次清理时间
     */
    getLastCleanupTime(): number {
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
    saveLastCleanupTime(): void {
        try {
            localStorage.setItem(this.lastCleanupTimeKey, Date.now().toString());
        } catch (e) {
            console.error('保存清理时间失败:', e);
        }
    }

    /**
     * 显示缓存清理通知
     */
    showCleanupNotification(cleanedItems: number): void {
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
    getStorageUsage(): StorageUsage {
        try {
            let totalSize = 0;
            const keys = Object.keys(localStorage);

            keys.forEach(key => {
                const value = localStorage.getItem(key);
                totalSize += key.length + (value ? value.length : 0);
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
    manualCleanup(): void {
        this.cleanupCache();
        this.saveLastCleanupTime();
    }
}

// 创建全局缓存管理器实例
const cacheManager = new CacheManager();
(window as Window & {
    cacheManager?: CacheManager;
    CacheManager?: typeof CacheManager;
}).cacheManager = cacheManager;
(window as Window & { CacheManager?: typeof CacheManager }).CacheManager = CacheManager;
