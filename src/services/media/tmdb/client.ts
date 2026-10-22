/**
 * TMDB provider — 请求封装
 *
 * 复用现有 services/tmdb.ts 的 tmdbFetch（Worker 或本地 /api/tmdb），
 * 不改变现有 TMDB 行为；这里只声明 provider 需要的最小返回结构。
 */

import { TMDB_WORKER_URL } from '../../../core/config';

export interface TmdbRawItem {
  id?: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
}

export interface TmdbListResponse {
  page?: number;
  total_pages?: number;
  results?: TmdbRawItem[];
}

export interface TmdbDetailRaw extends TmdbRawItem {
  genres?: Array<{ id?: number; name?: string }>;
  production_countries?: Array<{ iso_3166_1?: string; name?: string }>;
  spoken_languages?: Array<{ name?: string }>;
  runtime?: number;
  episode_run_time?: number[];
  credits?: {
    cast?: Array<{ name?: string; character?: string; profile_path?: string }>;
    crew?: Array<{ name?: string; job?: string }>;
  };
}

/** 与 services/tmdb.ts 的 getTmdbBaseUrl 同一规则：Worker 优先，本地回落到 /api/tmdb */
function tmdbBaseUrl(): string {
  const worker = String(TMDB_WORKER_URL || '').replace(/\/+$/, '');
  return worker || '/api/tmdb';
}

/**
 * 统一请求入口。
 * 这里不 import services/tmdb.ts 的 tmdbFetch，避免 tmdb.ts → services/media → tmdb.ts 的循环依赖；
 * URL、参数与错误行为保持与 tmdbFetch 一致。
 */
export async function tmdbRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ ...params, endpoint }).toString();
  const response = await fetch(`${tmdbBaseUrl()}?${query}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`TMDB 请求失败: ${response.status}`);
  }
  return await response.json() as T;
}
