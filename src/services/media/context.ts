/**
 * 最近一次从分类页选中的元数据条目
 *
 * 分类页卡片点击后会按片名去采集站搜索（播放链路不变）；
 * 这里把豆瓣/TMDB 的 sourceId 暂存到 sessionStorage，播放页详情补全时优先用它，
 * 避免再用片名重新匹配到另一部同名作品。
 */

import type { MediaCategory, MediaType, SourceId } from './types';

export interface LastPickedMedia {
  source: SourceId;
  sourceId: string;
  type: MediaType;
  category?: MediaCategory;
  title: string;
  year?: string;
  timestamp: number;
}

export type LastPickedMediaInput = Omit<LastPickedMedia, 'timestamp'>;

const STORAGE_KEY = 'leletv:media:last-picked';

function isSourceId(value: unknown): value is SourceId {
  return value === 'douban' || value === 'tmdb';
}

function isMediaType(value: unknown): value is MediaType {
  return value === 'movie' || value === 'tv';
}

export function saveLastPickedMedia(input: LastPickedMediaInput): void {
  if (!isSourceId(input.source) || !isMediaType(input.type)) return;
  const title = String(input.title || '').trim();
  const sourceId = String(input.sourceId || '').trim();
  if (!title || !sourceId) return;

  const payload: LastPickedMedia = {
    source: input.source,
    sourceId,
    type: input.type,
    ...(input.category ? { category: input.category } : {}),
    title,
    ...(input.year ? { year: String(input.year) } : {}),
    timestamp: Date.now(),
  };

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage 不可用（隐私模式/配额满）不影响主流程
  }
}

export function loadLastPickedMedia(): LastPickedMedia | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastPickedMedia> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isSourceId(parsed.source) || !isMediaType(parsed.type)) return null;
    if (!parsed.sourceId || !parsed.title) return null;
    return {
      source: parsed.source,
      sourceId: String(parsed.sourceId),
      type: parsed.type,
      ...(parsed.category ? { category: parsed.category } : {}),
      title: String(parsed.title),
      ...(parsed.year ? { year: String(parsed.year) } : {}),
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : 0,
    };
  } catch {
    return null;
  }
}

export function clearLastPickedMedia(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}
