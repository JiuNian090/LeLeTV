/**
 * DoubanProvider — 豆瓣元数据 provider
 *
 * 列表/搜索/详情都走 Worker 的 /douban/*，不直接请求豆瓣。
 * 豆瓣无法稳定支持的维度（综艺筛选、年代标签）主动抛错，由 FailoverProvider 降级 TMDB。
 */

import type {
  MediaDetail,
  MediaItem,
  MediaListParams,
  MediaListResult,
  MediaProvider,
  MediaSearchParams,
  MediaTag,
  MediaType,
} from '../types';
import { fetchDetail, fetchList, fetchSuggest, fetchTags } from './client';
import {
  categoryTag,
  mapDetail,
  mapListCategory,
  mapListResponse,
  mapSuggestItem,
} from './map';

/** 分类页传的是 TMDB 国家码；豆瓣 new_search_subjects 需要中文地区标签 */
const REGION_TAGS: Record<string, string> = {
  CN: '中国大陆',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  GB: '英国',
  FR: '法国',
  DE: '德国',
  HK: '中国香港',
  TW: '中国台湾',
  IN: '印度',
  TH: '泰国',
  ES: '西班牙',
  IT: '意大利',
  CA: '加拿大',
  AU: '澳大利亚',
  RU: '俄罗斯',
};

function resolveRegionTag(region: string | undefined): string | undefined {
  if (!region) return undefined;
  const value = region.trim();
  if (!value) return undefined;
  if (/^[A-Za-z]{2}$/.test(value)) return REGION_TAGS[value.toUpperCase()] || value;
  return value;
}

export class DoubanProvider implements MediaProvider {
  readonly source = 'douban' as const;

  async getTags(type: MediaType): Promise<MediaTag[]> {
    const tags = await fetchTags(type);
    return tags.map(name => ({ id: name, name }));
  }

  async getList(params: MediaListParams): Promise<MediaListResult> {
    const type = mapListCategory(params.type);
    // 豆瓣「综艺」标签会混入剧集；年代标签（1980s 等）实测返回空。
    // 主动抛错，让 FailoverProvider 切到 TMDB；关闭自动降级时由页面显示明确错误。
    if (params.type === 'variety') {
      throw new Error('豆瓣综艺分类不可靠，请使用 TMDB');
    }
    if (params.year && /^(1980s|1970s|1960s)$/.test(params.year)) {
      throw new Error('豆瓣不支持年代筛选，请使用 TMDB');
    }
    if (params.language) {
      throw new Error('豆瓣不支持语言筛选，请使用 TMDB');
    }
    if (params.tvStatus) {
      throw new Error('豆瓣不支持剧集状态筛选，请使用 TMDB');
    }

    // MediaListParams.page 从 1 开始；豆瓣 start 从 0 开始
    const page = Math.max(0, Math.floor((params.page || 1) - 1));
    const pageSize = Math.min(50, Math.max(1, params.pageSize || 20));
    const hasFilter = Boolean(params.genre || params.year || params.region || params.minRating);

    // 单标签浏览（热门/最新/美剧/韩剧……）走 search_subjects；带筛选条件走 new_search_subjects
    if (params.tag && !hasFilter) {
      const response = await fetchList({
        mode: 'tag',
        type,
        tag: params.tag,
        page: String(page),
        pageSize: String(pageSize),
      });
      return mapListResponse(response, type, params.type);
    }

    const tags = [
      categoryTag(params.type),
      params.genre,
      params.year,
      resolveRegionTag(params.region),
    ].filter((v): v is string => Boolean(v)).join(',');

    const sort = params.sort === 'rating'
      ? 'S'
      : (params.sort === 'popular' || params.sort === 'recent' ? 'T' : 'U');
    const minRating = typeof params.minRating === 'number'
      ? Math.max(0, Math.min(10, params.minRating))
      : 0;

    const response = await fetchList({
      mode: 'filter',
      type,
      tags,
      sort,
      range: `${minRating},10`,
      start: String(page * 20),
    });
    return mapListResponse(response, type, params.type);
  }

  async search(params: MediaSearchParams): Promise<MediaItem[]> {
    const keyword = String(params.keyword || '').trim();
    if (!keyword) return [];
    const items = await fetchSuggest(keyword, params.type);
    return items
      .map(raw => mapSuggestItem(raw, params.type))
      .filter(item => item.title && item.sourceId);
  }

  async getDetail(item: MediaItem): Promise<MediaDetail> {
    if (item.source !== 'douban') {
      throw new Error('该条目不是豆瓣来源');
    }
    if (!item.sourceId) {
      throw new Error('缺少豆瓣条目 ID');
    }

    const data = await fetchDetail(item.sourceId, item.type);
    const credits = data.credits && Array.isArray(data.credits.items)
      ? data.credits.items
      : undefined;
    return mapDetail(data.detail, credits, item);
  }
}
