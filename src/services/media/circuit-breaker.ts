/**
 * 元数据源熔断器
 *
 * 状态机（与 docs/DOUBAN_PRIMARY_SOURCE_PLAN.md 第 4.1 节一致）：
 *   closed   正常请求；连续失败达到阈值 → open
 *   open     冷却期内直接走降级；到期后允许一次探测 → half-open
 *   half-open 探测成功 → closed；失败 → open，冷却期翻倍（上限 10 分钟）
 *
 * 状态持久化在 localStorage，刷新页面后仍生效。每个源一个 key。
 */

import type { SourceId } from './types';

export type BreakerState = 'closed' | 'open' | 'half-open';

interface PersistedBreaker {
  state: BreakerState;
  failures: number;
  nextRetryAt: number;
  cooldownMs: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  initialCooldownMs?: number;
  maxCooldownMs?: number;
  storageKey?: string;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'storageKey'>> = {
  failureThreshold: 3,
  initialCooldownMs: 60_000,
  maxCooldownMs: 600_000,
};

export function breakerStorageKey(source: SourceId): string {
  return `leletv:breaker:${source}`;
}

function isBreakerState(value: unknown): value is BreakerState {
  return value === 'closed' || value === 'open' || value === 'half-open';
}

export class CircuitBreaker {
  readonly source: SourceId;
  private readonly storageKey: string;
  private readonly failureThreshold: number;
  private readonly initialCooldownMs: number;
  private readonly maxCooldownMs: number;

  private state: BreakerState = 'closed';
  private failures = 0;
  private nextRetryAt = 0;
  private cooldownMs: number;
  /** 内存态：half-open 只放一个探测请求，避免并发请求同时打上游 */
  private probeInFlight = false;

  constructor(source: SourceId, options: CircuitBreakerOptions = {}) {
    this.source = source;
    this.storageKey = options.storageKey || breakerStorageKey(source);
    this.failureThreshold = options.failureThreshold ?? DEFAULT_OPTIONS.failureThreshold;
    this.initialCooldownMs = options.initialCooldownMs ?? DEFAULT_OPTIONS.initialCooldownMs;
    this.maxCooldownMs = options.maxCooldownMs ?? DEFAULT_OPTIONS.maxCooldownMs;
    this.cooldownMs = this.initialCooldownMs;
    this.load();
  }

  /** 当前是否处于冷却期（open 且未到重试时间）。half-open 不算 open，允许探测。 */
  isOpen(): boolean {
    this.load();
    return this.state === 'open' && Date.now() < this.nextRetryAt;
  }

  /**
   * 是否允许发请求。
   * - closed：总是允许；
   * - open 且冷却已到：转 half-open，放行这一次探测；
   * - open 且仍在冷却：拒绝；
   * - half-open：已有探测在途则拒绝，否则放行。
   */
  canRequest(): boolean {
    this.load();
    const now = Date.now();

    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      if (now < this.nextRetryAt) return false;
      this.state = 'half-open';
      this.probeInFlight = true;
      this.persist();
      return true;
    }

    if (this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }

  /** 请求成功：关闭熔断，重置失败计数与冷却期 */
  onSuccess(): void {
    this.state = 'closed';
    this.failures = 0;
    this.nextRetryAt = 0;
    this.cooldownMs = this.initialCooldownMs;
    this.probeInFlight = false;
    this.persist();
  }

  /** 请求失败：累计失败；达到阈值或 half-open 探测失败时打开熔断 */
  onFailure(): void {
    this.load();
    this.failures += 1;

    const shouldOpen = this.state === 'half-open' || this.failures >= this.failureThreshold;
    if (!shouldOpen) {
      this.persist();
      return;
    }

    // half-open 探测失败：冷却期翻倍；closed 首次打开用初始冷却期
    this.cooldownMs = this.state === 'half-open'
      ? Math.min(this.cooldownMs * 2, this.maxCooldownMs)
      : Math.min(this.cooldownMs, this.maxCooldownMs);

    this.state = 'open';
    this.nextRetryAt = Date.now() + this.cooldownMs;
    this.probeInFlight = false;
    this.persist();
  }

  /** 手动重置（切换主源时调用） */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.nextRetryAt = 0;
    this.cooldownMs = this.initialCooldownMs;
    this.probeInFlight = false;
    this.persist();
  }

  /** 只读快照，便于设置页/调试展示 */
  snapshot(): PersistedBreaker {
    this.load();
    return {
      state: this.state,
      failures: this.failures,
      nextRetryAt: this.nextRetryAt,
      cooldownMs: this.cooldownMs,
    };
  }

  private load(): void {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedBreaker> | null;
      if (!parsed || typeof parsed !== 'object') return;

      if (isBreakerState(parsed.state)) this.state = parsed.state;
      if (typeof parsed.failures === 'number' && Number.isFinite(parsed.failures)) {
        this.failures = Math.max(0, parsed.failures);
      }
      if (typeof parsed.nextRetryAt === 'number' && Number.isFinite(parsed.nextRetryAt)) {
        this.nextRetryAt = Math.max(0, parsed.nextRetryAt);
      }
      if (typeof parsed.cooldownMs === 'number' && Number.isFinite(parsed.cooldownMs)) {
        this.cooldownMs = Math.min(Math.max(parsed.cooldownMs, this.initialCooldownMs), this.maxCooldownMs);
      }

      // 冷却期已过：把持久化的 open 视作可探测，避免刷新后一直卡在 open
      if (this.state === 'open' && Date.now() >= this.nextRetryAt) {
        this.state = 'half-open';
        this.probeInFlight = false;
      }
    } catch {
      // localStorage 不可用或数据损坏：按默认 closed 处理
    }
  }

  private persist(): void {
    try {
      const value: PersistedBreaker = {
        state: this.state,
        failures: this.failures,
        nextRetryAt: this.nextRetryAt,
        cooldownMs: this.cooldownMs,
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(value));
    } catch {
      // 存储失败不影响内存态熔断
    }
  }
}
