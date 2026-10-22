/**
 * FailoverProvider — 主源优先、失败自动降级的元数据入口
 *
 * 选择规则每次请求时读取 settings，用户切换主源后立即生效。
 * 只有豆瓣挂了 TMDB 才接管；播放源链路完全不经过这里。
 */

import type {
  MediaDetail,
  MediaItem,
  MediaListParams,
  MediaListResult,
  MediaProvider,
  MediaSearchParams,
  MediaTag,
  SourceId,
} from './types';
import { CircuitBreaker } from './circuit-breaker';
import { alternateSource, loadMediaSettings } from './settings';

export type MediaProviderMap = Record<SourceId, MediaProvider>;
export type MediaBreakerMap = Partial<Record<SourceId, CircuitBreaker>>;

function normalizeTitle(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s　·•・:：,，.。!！?？'"“”‘’()（）【】\[\]《》<>\-—_~～]/g, '');
}

function pickBestMatch(results: MediaItem[], item: MediaItem): MediaItem | null {
  const want = normalizeTitle(item.title);
  if (!want) return null;

  const exact = results.filter(candidate => normalizeTitle(candidate.title) === want);
  if (exact.length) {
    const withYear = exact.find(candidate => !item.year || !candidate.year || candidate.year === item.year);
    return withYear || exact[0];
  }

  const prefixed = results.find(candidate => {
    const title = normalizeTitle(candidate.title);
    return title.startsWith(want) || want.startsWith(title);
  });
  return prefixed || null;
}

export class FailoverProvider implements MediaProvider {
  private readonly providers: MediaProviderMap;
  private readonly breakers: MediaBreakerMap;

  constructor(providers: MediaProviderMap, breakers: MediaBreakerMap = {}) {
    this.providers = providers;
    this.breakers = breakers;
  }

  get source(): SourceId {
    return loadMediaSettings().primarySource;
  }

  async getTags(type: 'movie' | 'tv'): Promise<MediaTag[]> {
    return this.run(provider => provider.getTags(type));
  }

  async getList(params: MediaListParams): Promise<MediaListResult> {
    return this.run(provider => provider.getList(params));
  }

  async search(params: MediaSearchParams): Promise<MediaItem[]> {
    return this.run(provider => provider.search(params));
  }

  async getDetail(item: MediaItem): Promise<MediaDetail> {
    const settings = loadMediaSettings();
    const provider = this.providers[item.source];
    if (!provider) throw new Error(`未知的元数据源: ${item.source}`);

    // 关闭自动降级：严格使用条目自己的来源，失败直接报错
    if (!settings.autoFailover) {
      return provider.getDetail(item);
    }

    const breaker = this.breakers[provider.source];
    if (breaker && (breaker.isOpen() || !breaker.canRequest())) {
      return this.fallbackDetail(item, provider.source, new Error('主源熔断中'));
    }

    try {
      const detail = await provider.getDetail(item);
      breaker?.onSuccess();
      return detail;
    } catch (error) {
      breaker?.onFailure();
      return this.fallbackDetail(item, provider.source, error);
    }
  }

  /** 执行主源；失败且允许降级时切到另一个源 */
  private async run<T>(call: (provider: MediaProvider) => Promise<T>): Promise<T> {
    const settings = loadMediaSettings();
    const primary = this.providers[settings.primarySource];
    const fallback = this.providers[alternateSource(settings.primarySource)];

    if (!settings.autoFailover) {
      return call(primary);
    }

    const breaker = this.breakers[primary.source];
    if (breaker && (breaker.isOpen() || !breaker.canRequest())) {
      return call(fallback);
    }

    try {
      const result = await call(primary);
      breaker?.onSuccess();
      return result;
    } catch (error) {
      breaker?.onFailure();
      return call(fallback);
    }
  }

  /** 详情降级：按标题/年份在另一个源里找同一条目，再取详情 */
  private async fallbackDetail(
    item: MediaItem,
    from: SourceId,
    originalError: unknown
  ): Promise<MediaDetail> {
    const alt = this.providers[alternateSource(from)];
    try {
      const candidates = await alt.search({ keyword: item.title, type: item.type, page: 1 });
      const match = pickBestMatch(candidates, item);
      if (!match) throw new Error('备用源没有找到匹配条目');
      return await alt.getDetail(match);
    } catch (error) {
      // 备用源也失败：把主源错误抛给调用方，避免用不相干条目凑数据
      throw originalError instanceof Error ? originalError : error;
    }
  }
}
