/**
 * 负载均衡管理器
 * 智能分配 API 请求，避免单一源过载
 */

import { API_SITES } from './api-config';

// ==================== 类型定义 ====================

export interface ApiStat {
  apiKey: string;
  isCustom: boolean;
  responseTime: number;
  successCount: number;
  failureCount: number;
  lastSuccessTime: number;
  lastFailureTime: number;
  averageResponseTime: number;
  load: number;
  priority: number;
  consecutiveFailures: number;
  isBlacklisted: boolean;
  blacklistUntil: number;
}

export interface LoadBalancerConfig {
  responseTimeThreshold: number;
  failureThreshold: number;
  requestTimeout: number;
  cooldownPeriod: number;
  maxConcurrentRequests: number;
  retryAttempts: number;
  retryDelay: number;
  blacklistThreshold: number;
  priorityBoostFactor: number;
  loadPenaltyFactor: number;
  recentSuccessBonus: number;
}

const DEFAULT_CONFIG: LoadBalancerConfig = {
  responseTimeThreshold: 10000,
  failureThreshold: 0.3,
  requestTimeout: 15000,
  cooldownPeriod: 10 * 60 * 1000,
  maxConcurrentRequests: 3,
  retryAttempts: 3,
  retryDelay: 1000,
  blacklistThreshold: 5,
  priorityBoostFactor: 1.2,
  loadPenaltyFactor: 10,
  recentSuccessBonus: 1.2,
};

// ==================== 负载均衡器 ====================

export class LoadBalancer {
  private apiStats: Map<string, ApiStat> = new Map();
  private activeRequests: Map<string, number> = new Map();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private preferredApi: string | null = null;
  private preferredApiExpiry: number = 0;
  private config: LoadBalancerConfig;

  constructor(config?: Partial<LoadBalancerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.init();
  }

  private init(): void {
    this.loadStats();
    this.initializeApiStats();
    window.addEventListener('beforeunload', () => {
      this.flushSave();
    });
  }

  private initializeApiStats(): void {
    Object.keys(API_SITES).forEach((apiKey) => {
      if (!this.apiStats.has(apiKey)) {
        this.apiStats.set(apiKey, this.createApiStat(apiKey));
      }
    });

    try {
      const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
      (customAPIs as any[]).forEach((_: any, index: number) => {
        const customKey = `custom_${index}`;
        if (!this.apiStats.has(customKey)) {
          this.apiStats.set(customKey, this.createApiStat(customKey, true));
        }
      });
    } catch {
      // 静默处理
    }
  }

  private createApiStat(apiKey: string, isCustom = false): ApiStat {
    return {
      apiKey,
      isCustom,
      responseTime: 0,
      successCount: 0,
      failureCount: 0,
      lastSuccessTime: 0,
      lastFailureTime: 0,
      averageResponseTime: 0,
      load: 0,
      priority: 1,
      consecutiveFailures: 0,
      isBlacklisted: false,
      blacklistUntil: 0,
    };
  }

  /**
   * 获取最佳 API 源（智能负载均衡）
   */
  getBestApi(preferredApis: string[] | null = null): string {
    const availableApis = preferredApis ?? this.getSelectedApis();

    if (availableApis.length === 0) {
      throw new Error('没有可用的API源');
    }

    // 热缓存命中
    if (this.preferredApi && Date.now() < this.preferredApiExpiry) {
      if (!preferredApis || preferredApis.includes(this.preferredApi)) {
        const stat = this.apiStats.get(this.preferredApi);
        if (stat && this.isApiHealthy(stat) && !this.isApiOverloaded(this.preferredApi)) {
          return this.preferredApi;
        }
      }
      this.preferredApi = null;
    }

    const healthyApis = availableApis.filter((apiKey) => {
      const stat = this.apiStats.get(apiKey);
      return stat && this.isApiHealthy(stat);
    });

    if (healthyApis.length === 0) {
      const recentSuccessApis = availableApis.filter((apiKey) => {
        const stat = this.apiStats.get(apiKey);
        return stat && Date.now() - stat.lastSuccessTime < this.config.cooldownPeriod;
      });

      if (recentSuccessApis.length > 0) {
        return this.selectBestFromCandidates(recentSuccessApis);
      }

      return availableApis[Math.floor(Math.random() * availableApis.length)];
    }

    return this.selectBestFromCandidates(healthyApis);
  }

  private selectBestFromCandidates(candidates: string[]): string {
    const scoredApis = candidates.map((apiKey) => {
      const stat = this.apiStats.get(apiKey)!;
      const score = this.calculateApiScore(stat);
      return { apiKey, score, stat };
    });

    scoredApis.sort((a, b) => b.score - a.score);

    const totalScore = scoredApis.reduce((sum, api) => sum + api.score, 0);
    let random = Math.random() * totalScore;

    for (const api of scoredApis) {
      random -= api.score;
      if (random <= 0) {
        return api.apiKey;
      }
    }

    return scoredApis[0].apiKey;
  }

  private calculateApiScore(stat: ApiStat): number {
    let score = 100;

    if (stat.averageResponseTime > 0) {
      const timeScore = Math.max(0, 100 - stat.averageResponseTime / 100);
      score *= timeScore / 100;
    }

    const totalRequests = stat.successCount + stat.failureCount;
    if (totalRequests > 0) {
      const successRate = stat.successCount / totalRequests;
      score *= successRate;
    }

    const loadPenalty = Math.min(stat.load * this.config.loadPenaltyFactor, 50);
    score -= loadPenalty;

    score *= stat.priority * this.config.priorityBoostFactor;

    if (stat.consecutiveFailures > 0) {
      score *= Math.pow(0.8, stat.consecutiveFailures);
    }

    const timeSinceLastSuccess = Date.now() - stat.lastSuccessTime;
    if (timeSinceLastSuccess < 60000) {
      score *= this.config.recentSuccessBonus;
    }

    return Math.max(score, 1);
  }

  private isApiHealthy(stat: ApiStat): boolean {
    const now = Date.now();

    if (stat.isBlacklisted && now < stat.blacklistUntil) {
      return false;
    }

    if (stat.consecutiveFailures >= 2 && now - stat.lastFailureTime < 60000) {
      return false;
    }

    if (stat.consecutiveFailures >= 3) {
      return false;
    }

    const totalRequests = stat.successCount + stat.failureCount;
    if (totalRequests >= 10) {
      const successRate = stat.successCount / totalRequests;
      if (successRate < 1 - this.config.failureThreshold) {
        return false;
      }
    }

    if (stat.averageResponseTime > this.config.responseTimeThreshold) {
      return false;
    }

    return true;
  }

  /**
   * 记录 API 请求结果
   */
  recordApiResult(apiKey: string, success: boolean, responseTime = 0, _error?: Error | null): void {
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

      if (responseTime > 0) {
        if (stat.averageResponseTime === 0) {
          stat.averageResponseTime = responseTime;
        } else {
          stat.averageResponseTime = stat.averageResponseTime * 0.7 + responseTime * 0.3;
        }
      }

      if (responseTime > 0 && responseTime < 3000) {
        this.preferredApi = apiKey;
        this.preferredApiExpiry = now + 60000;
      }
    } else {
      stat.failureCount++;
      stat.lastFailureTime = now;
      stat.consecutiveFailures++;

      if (this.preferredApi === apiKey) {
        this.preferredApi = null;
        this.preferredApiExpiry = 0;
      }

      if (stat.consecutiveFailures >= this.config.blacklistThreshold) {
        stat.isBlacklisted = true;
        stat.blacklistUntil = now + this.config.cooldownPeriod;
        console.warn(
          `API ${apiKey} 已被加入黑名单，冷却期: ${this.config.cooldownPeriod / 1000}秒`
        );
      }
    }

    this.decreaseApiLoad(apiKey);
    this.scheduleSave();
  }

  /**
   * 增加 API 负载
   */
  increaseApiLoad(apiKey: string): void {
    const stat = this.apiStats.get(apiKey);
    if (stat) {
      stat.load++;
    }
    const currentCount = this.activeRequests.get(apiKey) || 0;
    this.activeRequests.set(apiKey, currentCount + 1);
  }

  /**
   * 减少 API 负载
   */
  decreaseApiLoad(apiKey: string): void {
    const stat = this.apiStats.get(apiKey);
    if (stat && stat.load > 0) {
      stat.load--;
    }
    const currentCount = this.activeRequests.get(apiKey) || 0;
    if (currentCount > 0) {
      this.activeRequests.set(apiKey, currentCount - 1);
    }
  }

  /**
   * 检查 API 是否超载
   */
  isApiOverloaded(apiKey: string): boolean {
    const activeCount = this.activeRequests.get(apiKey) || 0;
    return activeCount >= this.config.maxConcurrentRequests;
  }

  /**
   * 获取选中的 API 列表
   */
  getSelectedApis(): string[] {
    try {
      const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
      return selectedAPIs.length > 0 ? selectedAPIs : Object.keys(API_SITES).slice(0, 5);
    } catch {
      return Object.keys(API_SITES).slice(0, 5);
    }
  }

  /**
   * 获取 API 统计信息快照
   */
  getApiStats(): Record<string, ApiStat> {
    const stats: Record<string, ApiStat> = {};
    this.apiStats.forEach((stat, apiKey) => {
      stats[apiKey] = { ...stat };
    });
    return stats;
  }

  /**
   * 重置 API 统计
   */
  resetApiStats(apiKey?: string): void {
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
   * 防抖保存
   */
  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveStats(), 2000);
  }

  /**
   * 立即保存
   */
  private flushSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveStats();
  }

  private saveStats(): void {
    try {
      const statsData: Record<string, ApiStat> = {};
      this.apiStats.forEach((stat, apiKey) => {
        statsData[apiKey] = stat;
      });
      localStorage.setItem('loadBalancerStats', JSON.stringify(statsData));
    } catch (error) {
      console.error('保存负载均衡统计数据失败:', error);
    }
  }

  private loadStats(): void {
    try {
      const savedStats = localStorage.getItem('loadBalancerStats');
      if (savedStats) {
        const statsData = JSON.parse(savedStats) as Record<string, ApiStat>;
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
  destroy(): void {
    this.flushSave();
  }
}
