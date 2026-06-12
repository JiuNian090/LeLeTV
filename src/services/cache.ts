/**
 * LeLeTV 缓存管理模块
 * 负责管理和清理本地存储，实现24小时自动清理功能
 * 保留用户设置和历史记录，只清理临时数据
 */

// ==================== 默认配置 ====================

const DEFAULT_CACHE_CONFIG = {
  cleanupInterval: 24 * 60 * 60 * 1000,
  preserveKeys: [
    'selectedAPIs',
    'customAPIs',
    'hiddenFilterEnabled',
    'adFilteringEnabled',
    'hasInitializedDefaults',
    'viewingHistory',
    'videoSearchHistory',
    'passwordVerified',
  ],
  temporaryKeyPrefixes: [
    'videoProgress_',
    'lastPageUrl',
    'currentPlayingId',
    'currentPlayingSource',
    'currentVideoTitle',
    'currentEpisodes',
    'currentEpisodeIndex',
    'currentSourceCode',
    'lastPlayTime',
    'loadBalancerStats',
  ],
  temporaryDataTTL: 24 * 60 * 60 * 1000,
};

interface CacheConfig {
  cleanupInterval: number;
  preserveKeys: string[];
  temporaryKeyPrefixes: string[];
  temporaryDataTTL: number;
}

interface StorageUsage {
  used: number;
  usedInKB: string;
  keys: number;
}

export class CacheManager {
  private preserveKeys: string[];
  private temporaryKeyPrefixes: string[];
  private temporaryDataTTL: number;
  private cleanupInterval: number;
  private lastCleanupTimeKey = 'cacheLastCleanupTime';
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<CacheConfig>) {
    const merged: CacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.preserveKeys = merged.preserveKeys;
    this.temporaryKeyPrefixes = merged.temporaryKeyPrefixes;
    this.temporaryDataTTL = merged.temporaryDataTTL;
    this.cleanupInterval = merged.cleanupInterval;

    this.init();
  }

  /**
   * 初始化缓存管理器
   */
  private init(): void {
    this.checkAndCleanupCache();
    this.setupCleanupTimer();

    window.addEventListener('beforeunload', () => {
      this.saveLastCleanupTime();
    });
  }

  /**
   * 检查并执行缓存清理
   */
  private checkAndCleanupCache(): void {
    const lastCleanupTime = this.getLastCleanupTime();
    const now = Date.now();

    if (now - lastCleanupTime >= this.cleanupInterval) {
      this.cleanupCache();
      this.saveLastCleanupTime();
    }
  }

  /**
   * 执行缓存清理操作
   */
  private cleanupCache(): void {
    try {
      let cleanedItems = 0;
      const now = Date.now();
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        if (this.preserveKeys.includes(key)) continue;

        const isTemporaryKey = this.temporaryKeyPrefixes.some((prefix) =>
          key.startsWith(prefix)
        );

        if (!isTemporaryKey) continue;

        try {
          const item = localStorage.getItem(key);
          if (!item) continue;

          if (key.startsWith('videoProgress_')) {
            try {
              const progressData = JSON.parse(item);
              if (
                progressData.timestamp &&
                now - progressData.timestamp >= this.temporaryDataTTL
              ) {
                localStorage.removeItem(key);
                cleanedItems++;
              }
            } catch {
              // 解析失败，旧格式数据，直接移除
              localStorage.removeItem(key);
              cleanedItems++;
            }
          } else {
            localStorage.removeItem(key);
            cleanedItems++;
          }
        } catch (e) {
          console.error(`清理缓存项 ${key} 时出错:`, e);
        }
      }

      if (cleanedItems > 0) {
        console.log(`缓存清理完成，共清理 ${cleanedItems} 个临时数据项`);
        this.showCleanupNotification(cleanedItems);
      }
    } catch (e) {
      console.error('缓存清理过程中发生错误:', e);
    }
  }

  /**
   * 设置定期清理的定时器
   */
  private setupCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.checkAndCleanupCache();
    }, this.cleanupInterval);

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
  private getLastCleanupTime(): number {
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
  private saveLastCleanupTime(): void {
    try {
      localStorage.setItem(this.lastCleanupTimeKey, Date.now().toString());
    } catch (e) {
      console.error('保存清理时间失败:', e);
    }
  }

  /**
   * 显示缓存清理通知
   */
  private showCleanupNotification(cleanedItems: number): void {
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('缓存清理完成，释放了部分存储空间', 'success');
    } else {
      console.log(`缓存清理完成，共清理 ${cleanedItems} 个临时数据项`);
    }
  }

  /**
   * 获取 localStorage 使用情况
   */
  getStorageUsage(): StorageUsage {
    try {
      let totalSize = 0;
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) totalSize += key.length + value.length;
      }

      return {
        used: totalSize,
        usedInKB: (totalSize / 1024).toFixed(2),
        keys: keys.length,
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
