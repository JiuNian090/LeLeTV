/**
 * 豆瓣 provider — 代理客户端
 *
 * 浏览器不直接请求豆瓣：所有请求都走同一个 Worker 的 /douban/*（见 workers/douban.js）。
 * 没有配置 TMDB_WORKER_URL 时回落到 /api/douban（本地开发需要 server 侧转发）。
 */

import { TMDB_WORKER_URL } from '../../../core/config';

export interface DoubanRawListItem {
  id?: string | number;
  title?: string;
  rate?: string;
  cover?: string;
  url?: string;
  year?: string;
  directors?: string[];
  casts?: string[];
  [key: string]: unknown;
}

export interface DoubanSuggestItem {
  id?: string | number;
  title?: string;
  year?: string;
  type?: string;
  img?: string;
  url?: string;
  sub_title?: string;
  [key: string]: unknown;
}

export interface DoubanRawCredit {
  name?: string;
  character?: string;
  simple_character?: string;
  roles?: string[];
  category?: string;
  avatar?: { normal?: string; large?: string };
  [key: string]: unknown;
}

export interface DoubanRawDetail {
  id?: string | number;
  title?: string;
  original_title?: string;
  year?: string;
  intro?: string;
  cover_url?: string;
  pic?: { normal?: string; large?: string };
  rating?: { value?: number; count?: number };
  genres?: string[];
  countries?: string[];
  languages?: string[];
  durations?: string[];
  pubdate?: string[];
  directors?: Array<{ name?: string }>;
  actors?: Array<{ name?: string }>;
  aka?: string[];
  is_tv?: boolean;
  episodes_count?: number;
  [key: string]: unknown;
}

export interface DoubanTagsResponse {
  ok: boolean;
  tags: string[];
}

export interface DoubanListResponse {
  ok: boolean;
  mode: 'tag' | 'filter';
  data: DoubanRawListItem[];
  hasMore: boolean;
}

export interface DoubanSearchResponse {
  ok: boolean;
  data: DoubanSuggestItem[];
}

export interface DoubanDetailResponse {
  ok: boolean;
  detail: DoubanRawDetail;
  credits: { items?: DoubanRawCredit[] } | null;
}

export interface DoubanClientOptions {
  /** 单次请求超时（毫秒） */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/** Worker 的豆瓣代理前缀；生产用同一个 Worker 域名，本地用 /api/douban */
export function doubanProxyBase(): string {
  const worker = String(TMDB_WORKER_URL || '').replace(/\/+$/, '');
  return worker ? `${worker}/douban` : '/api/douban';
}

/** 把豆瓣图片换成代理地址；非豆瓣图片原样返回 */
export function proxyDoubanImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const host = new URL(url).hostname;
    if (host !== 'doubanio.com' && !host.endsWith('.doubanio.com')) return url;
  } catch {
    return url;
  }
  return `${doubanProxyBase()}/image?url=${encodeURIComponent(url)}`;
}

async function requestJson<T>(path: string, params: Record<string, string>, timeoutMs: number): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const url = `${doubanProxyBase()}${path}${query ? `?${query}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    const data = await response.json() as (T & { ok?: boolean; error?: string; message?: string });
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || `豆瓣代理返回 ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('豆瓣请求超时');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTags(type: 'movie' | 'tv', options: DoubanClientOptions = {}): Promise<string[]> {
  const data = await requestJson<DoubanTagsResponse>(
    '/tags',
    { type },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  return Array.isArray(data.tags) ? data.tags : [];
}

export async function fetchList(
  params: Record<string, string>,
  options: DoubanClientOptions = {}
): Promise<DoubanListResponse> {
  return requestJson<DoubanListResponse>('/list', params, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

export async function fetchSuggest(
  keyword: string,
  type: 'movie' | 'tv' | '',
  options: DoubanClientOptions = {}
): Promise<DoubanSuggestItem[]> {
  const data = await requestJson<DoubanSearchResponse>(
    '/search',
    { q: keyword, ...(type ? { type } : {}) },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  return Array.isArray(data.data) ? data.data : [];
}

export async function fetchDetail(
  id: string,
  type: 'movie' | 'tv',
  options: DoubanClientOptions = {}
): Promise<DoubanDetailResponse> {
  return requestJson<DoubanDetailResponse>(
    '/detail',
    { id, type, credits: '1' },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
}
