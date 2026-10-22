/**
 * 豆瓣字段 → MediaItem / MediaDetail
 *
 * 只做字段归一化，不发请求。缺失字段保持 undefined（不用空字符串占位）。
 */

import type {
  MediaCategory,
  MediaCredit,
  MediaDetail,
  MediaItem,
  MediaType,
} from '../types';
import type {
  DoubanListResponse,
  DoubanRawCredit,
  DoubanRawDetail,
  DoubanRawListItem,
  DoubanSuggestItem,
} from './client';
import { proxyDoubanImage } from './client';

export const DOUBAN_SOURCE = 'douban' as const;

function parseRating(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 从豆瓣详情/列表的 url 字段提取 subject id */
export function extractDoubanId(item: { id?: string | number; url?: string }): string {
  if (item.id !== undefined && item.id !== null && String(item.id).trim()) {
    return String(item.id).trim();
  }
  const match = /\/subject\/(\d+)/.exec(String(item.url || ''));
  return match ? match[1] : '';
}

export function mapListCategory(type: MediaCategory): MediaType {
  return type === 'movie' ? 'movie' : 'tv';
}

/** 分类入口 → 豆瓣顶级标签 */
export function categoryTag(type: MediaCategory): string {
  switch (type) {
    case 'movie': return '电影';
    case 'anime': return '动漫';
    case 'variety': return '综艺';
    default: return '电视剧';
  }
}

export function mapListItem(
  raw: DoubanRawListItem,
  type: MediaType,
  category: MediaCategory
): MediaItem {
  const sourceId = extractDoubanId(raw);
  return {
    source: DOUBAN_SOURCE,
    sourceId,
    type,
    category,
    title: String(raw.title || '').trim(),
    year: raw.year ? String(raw.year) : undefined,
    poster: proxyDoubanImage(raw.cover),
    rating: parseRating(raw.rate),
    overview: undefined,
  };
}

/** search_subjects / subject_suggest 的条目（字段比详情少） */
export function mapSuggestItem(raw: DoubanSuggestItem, type: MediaType): MediaItem {
  const sourceId = extractDoubanId(raw);
  const poster = raw.img || (typeof raw.cover === 'string' ? raw.cover : undefined);
  return {
    source: DOUBAN_SOURCE,
    sourceId,
    type,
    category: type,
    title: String(raw.title || '').trim(),
    originalTitle: raw.sub_title ? String(raw.sub_title) : undefined,
    year: raw.year ? String(raw.year) : undefined,
    poster: proxyDoubanImage(poster),
  };
}

function mapCredit(raw: DoubanRawCredit): MediaCredit | null {
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const role = String(raw.simple_character || raw.character || '').trim();
  return {
    name,
    role: role || undefined,
    avatar: proxyDoubanImage(raw.avatar && (raw.avatar.large || raw.avatar.normal)),
  };
}

function namesFromCredits(credits: DoubanRawCredit[] | undefined, category: string): string[] {
  if (!Array.isArray(credits)) return [];
  const names: string[] = [];
  credits.forEach(raw => {
    const name = String(raw.name || '').trim();
    if (!name) return;
    if (category && raw.category !== category) return;
    if (!names.includes(name)) names.push(name);
  });
  return names;
}

export function mapDetail(
  raw: DoubanRawDetail,
  credits: DoubanRawCredit[] | undefined,
  item: MediaItem
): MediaDetail {
  const actorNames = Array.isArray(raw.actors)
    ? raw.actors.map(a => String(a.name || '').trim()).filter(Boolean)
    : [];
  const directorNames = Array.isArray(raw.directors)
    ? raw.directors.map(d => String(d.name || '').trim()).filter(Boolean)
    : [];

  const creditItems = Array.isArray(credits)
    ? credits.map(mapCredit).filter((c): c is MediaCredit => c !== null)
    : [];

  const casts = actorNames.length
    ? Array.from(new Set(actorNames))
    : namesFromCredits(credits, '演员');
  const directors = directorNames.length
    ? Array.from(new Set(directorNames))
    : namesFromCredits(credits, '导演');

  const poster = proxyDoubanImage(raw.cover_url || (raw.pic && (raw.pic.large || raw.pic.normal)) || item.poster);
  const backdrop = proxyDoubanImage(raw.pic && raw.pic.large) || undefined;

  return {
    ...item,
    sourceId: extractDoubanId(raw) || item.sourceId,
    title: String(raw.title || item.title).trim(),
    originalTitle: raw.original_title ? String(raw.original_title) : item.originalTitle,
    year: raw.year ? String(raw.year) : item.year,
    poster,
    backdrop,
    rating: parseRating(raw.rating && raw.rating.value) ?? item.rating,
    summary: String(raw.intro || '').trim(),
    genres: Array.isArray(raw.genres) ? raw.genres.map(String) : [],
    directors,
    casts,
    credits: creditItems.length ? creditItems : undefined,
    countries: Array.isArray(raw.countries) ? raw.countries.map(String) : undefined,
    languages: Array.isArray(raw.languages) ? raw.languages.map(String) : undefined,
    runtime: Array.isArray(raw.durations) && raw.durations.length ? raw.durations.join(' / ') : undefined,
    releaseDates: Array.isArray(raw.pubdate) ? raw.pubdate.map(String) : undefined,
  };
}

/** 列表接口返回 → MediaItem[]（保留 hasMore） */
export function mapListResponse(
  response: DoubanListResponse,
  type: MediaType,
  category: MediaCategory
): { items: MediaItem[]; hasMore: boolean } {
  const items = (Array.isArray(response.data) ? response.data : [])
    .map(raw => mapListItem(raw, type, category))
    .filter(item => item.title && item.sourceId);
  return { items, hasMore: !!response.hasMore };
}
