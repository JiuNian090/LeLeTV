/**
 * 元数据统一层入口
 *
 * 页面只应调用 getMediaProvider()，禁止直接 fetch 豆瓣/TMDB。
 */

import type { MediaProvider } from './types';
import { DoubanProvider } from './douban';
import { TmdbProvider } from './tmdb';
import { CircuitBreaker } from './circuit-breaker';
import { FailoverProvider } from './provider';
import type { MediaBreakerMap } from './provider';

let instance: FailoverProvider | null = null;

/** 创建一份新的 provider（测试或切换设置后重置用） */
export function createMediaProvider(breakers: MediaBreakerMap = {}): FailoverProvider {
  return new FailoverProvider(
    {
      douban: new DoubanProvider(),
      tmdb: new TmdbProvider(),
    },
    breakers
  );
}

/** 全局单例：应用内所有分类/搜索/详情都走这里 */
export function getMediaProvider(): MediaProvider {
  if (!instance) {
    instance = createMediaProvider({
      douban: new CircuitBreaker('douban'),
    });
  }
  return instance;
}

/** 清空单例（主源切换或测试隔离时调用） */
export function resetMediaProvider(): void {
  instance = null;
}

/** 切换主源/降级开关后调用：重建 provider，并清掉豆瓣熔断状态 */
export function resetMediaFailover(): void {
  resetMediaProvider();
  try {
    new CircuitBreaker('douban').reset();
  } catch {
    /* 存储不可用时忽略 */
  }
}

export type {
  MediaDetail,
  MediaItem,
  MediaListParams,
  MediaListResult,
  MediaProvider,
  MediaSearchParams,
  MediaTag,
  MediaType,
  MediaCategory,
  MediaCredit,
  MediaSort,
  SourceId,
} from './types';
export { loadMediaSettings, saveMediaSettings, resetMediaSettings, MEDIA_SETTINGS_KEY } from './settings';
export { CircuitBreaker } from './circuit-breaker';
export { DoubanProvider } from './douban';
export { TmdbProvider } from './tmdb';
export { FailoverProvider } from './provider';
