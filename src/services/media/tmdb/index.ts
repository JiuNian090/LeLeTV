/**
 * TmdbProvider — TMDB 元数据 provider
 *
 * 包装现有 tmdbFetch，保持 TMDB 原有请求行为不变；只把参数/字段换成 MediaProvider 的统一模型。
 */

import { GENRE_MAP } from '../../../core/genres';
import type {
  MediaDetail,
  MediaItem,
  MediaListParams,
  MediaListResult,
  MediaProvider,
  MediaSearchParams,
  MediaTag,
  MediaSort,
  MediaType,
} from '../types';
import { tmdbRequest } from './client';
import type { TmdbDetailRaw, TmdbListResponse } from './client';
import { mapTmdbDetail, mapTmdbItem } from './map';

const REGION_CODES: Record<string, string> = {
  '中国大陆': 'CN',
  '中国': 'CN',
  '美国': 'US',
  '日本': 'JP',
  '韩国': 'KR',
  '英国': 'GB',
  '法国': 'FR',
  '德国': 'DE',
  '香港': 'HK',
  '台湾': 'TW',
  '印度': 'IN',
  '泰国': 'TH',
  '西班牙': 'ES',
  '意大利': 'IT',
  '加拿大': 'CA',
  '澳大利亚': 'AU',
  '俄罗斯': 'RU',
};

function resolveGenreId(genre: string | undefined, type: MediaType): string | undefined {
  if (!genre) return undefined;
  if (/^\d+$/.test(genre)) return genre;
  const list = GENRE_MAP[type] || [];
  const hit = list.find(item => item.name === genre);
  return hit ? String(hit.id) : undefined;
}

function resolveRegion(region: string | undefined): string | undefined {
  if (!region) return undefined;
  const value = region.trim();
  if (!value) return undefined;
  if (/^[A-Za-z]{2}(\|[A-Za-z]{2})*$/.test(value)) return value.toUpperCase();
  return REGION_CODES[value] || value;
}

function mapSort(sort: MediaSort | undefined, type: MediaType): string {
  switch (sort) {
    case 'popular':
      return 'popularity.desc';
    case 'rating':
      return 'vote_average.desc';
    case 'recent':
      return type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
    default:
      return type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  }
}

function applyYear(query: Record<string, string>, year: string, type: MediaType): void {
  if (!year) return;
  const isMovie = type === 'movie';
  if (year === '1980s' || year === '1970s' || year === '1960s') {
    const start = year === '1980s' ? 1980 : (year === '1970s' ? 1970 : 1900);
    const end = year === '1980s' ? 1989 : (year === '1970s' ? 1979 : 1969);
    query[isMovie ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${start}-01-01`;
    query[isMovie ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${end}-12-31`;
    return;
  }
  if (isMovie) {
    query.year = year;
  } else {
    query.first_air_date_year = year;
  }
}

export class TmdbProvider implements MediaProvider {
  readonly source = 'tmdb' as const;

  async getTags(type: MediaType): Promise<MediaTag[]> {
    return (GENRE_MAP[type] || []).map(item => ({ id: String(item.id), name: item.name }));
  }

  async getList(params: MediaListParams): Promise<MediaListResult> {
    const type: MediaType = params.type === 'movie' ? 'movie' : 'tv';
    const page = Math.max(1, Math.floor(params.page || 1));
    const endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';

    const query: Record<string, string> = {
      language: 'zh-CN',
      page: String(page),
      sort_by: mapSort(params.sort, type),
      'vote_count.gte': '10',
    };

    const genreId = resolveGenreId(params.genre, type);
    if (genreId) query.with_genres = genreId;

    if (params.year) applyYear(query, params.year, type);

    const region = resolveRegion(params.region);
    if (region) {
      if (type === 'movie') query.region = region;
      else query.with_origin_country = region;
    }

    if (typeof params.minRating === 'number' && params.minRating > 0) {
      query['vote_average.gte'] = String(params.minRating);
    }

    if (params.language) {
      query.with_original_language = params.language;
    }

    if (type === 'tv' && params.tvStatus) {
      query.with_status = params.tvStatus;
    }

    // 与本站分类页的动漫/综艺专属条件保持一致
    if (params.type === 'anime') {
      query.with_genres = '16';
      query.with_original_language = 'ja';
    } else if (params.type === 'variety') {
      query.with_genres = '10764';
      query.with_origin_country = 'CN|KR|TW|HK';
    }

    const data = await tmdbRequest<TmdbListResponse>(endpoint, query);
    const items = (Array.isArray(data.results) ? data.results : [])
      .map(raw => mapTmdbItem(raw, params.type))
      .filter(item => item.sourceId && item.title);

    return {
      items,
      hasMore: page < (typeof data.total_pages === 'number' ? data.total_pages : 0),
    };
  }

  async search(params: MediaSearchParams): Promise<MediaItem[]> {
    const keyword = String(params.keyword || '').trim();
    if (!keyword) return [];

    const type: MediaType = params.type === 'movie' ? 'movie' : 'tv';
    const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
    const data = await tmdbRequest<TmdbListResponse>(endpoint, {
      query: keyword,
      language: 'zh-CN',
      page: String(Math.max(1, Math.floor(params.page || 1))),
      include_adult: 'false',
    });

    return (Array.isArray(data.results) ? data.results : [])
      .map(raw => mapTmdbItem(raw, type))
      .filter(item => item.sourceId && item.title);
  }

  async getDetail(item: MediaItem): Promise<MediaDetail> {
    if (item.source !== 'tmdb') {
      throw new Error('该条目不是 TMDB 来源');
    }
    if (!item.sourceId) {
      throw new Error('缺少 TMDB 条目 ID');
    }

    const endpoint = `${item.type}/${item.sourceId}`;
    const data = await tmdbRequest<TmdbDetailRaw>(endpoint, {
      language: 'zh-CN',
      append_to_response: 'credits',
    });
    return mapTmdbDetail(data, item);
  }
}
