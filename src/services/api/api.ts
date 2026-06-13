/**
 * API 请求处理模块
 *
 * 提供搜索、详情获取等 API 请求处理函数。
 * 不再覆写 window.fetch，通过显式 apiFetch() 调用。
 */

import {
  API_CONFIG,
  API_SITES,
  PROXY_URL,
  AGGREGATED_SEARCH_CONFIG,
  ERROR_MESSAGES,
  M3U8_PATTERN,
} from './api-config';
import { addAuthToProxyUrl } from '../auth/proxy-auth';
import { TIMING } from '../../core/timing';

// ==================== 类型定义 ====================

export interface ApiSearchParams {
  wd?: string;
  source?: string;
  customApi?: string;
  customDetail?: string;
}

export interface ApiDetailParams {
  id?: string;
  source?: string;
  customApi?: string;
  customDetail?: string;
  useDetail?: string;
}

export interface ApiResult {
  code: number;
  msg?: string;
  list?: any[];
  episodes?: string[];
  detailUrl?: string;
  videoInfo?: Record<string, unknown>;
}

// ==================== 工具函数 ====================

/**
 * 通过代理获取 API 数据
 */
export async function apiFetch(
  url: string,
  headers: Record<string, string>,
  timeout: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const combinedSignal = signal
    ? combineAbortSignals(signal, controller.signal)
    : controller.signal;

  try {
    const proxiedUrl = await addAuthToProxyUrl(PROXY_URL + encodeURIComponent(url));

    const response = await fetch(proxiedUrl, {
      headers,
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 合并两个 AbortSignal
 */
function combineAbortSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  s1.addEventListener('abort', onAbort);
  s2.addEventListener('abort', onAbort);

  if (s1.aborted || s2.aborted) {
    controller.abort();
  }

  return controller.signal;
}

// ==================== 搜索处理 ====================

/**
 * 处理 API 搜索请求
 */
export async function handleApiSearch(params: ApiSearchParams): Promise<string> {
  const { wd: searchQuery, source = 'heimuer', customApi = '', customDetail: _customDetail } = params;

  if (!searchQuery) {
    throw new Error('缺少搜索参数');
  }

  if (source === 'custom' && !customApi) {
    throw new Error('使用自定义API时必须提供API地址');
  }

  if (!API_SITES[source] && source !== 'custom') {
    throw new Error('无效的API来源');
  }

  const apiUrl = customApi
    ? `${customApi}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`
    : `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;

  const response = await apiFetch(apiUrl, { ...API_CONFIG.search.headers }, TIMING.API_REQUEST_TIMEOUT);

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.list)) {
    throw new Error('API返回的数据格式无效');
  }

  data.list.forEach((item: any) => {
    item.source_name = source === 'custom' ? '自定义源' : API_SITES[source].name;
    item.source_code = source;
    if (source === 'custom') {
      item.api_url = customApi;
    }
  });

  return JSON.stringify({
    code: 200,
    list: data.list || [],
  });
}

// ==================== 详情处理 ====================

/**
 * 处理 API 详情请求
 */
export async function handleApiDetail(params: ApiDetailParams): Promise<string> {
  const { id, source: sourceCode = 'heimuer', customApi = '', customDetail = '' } = params;

  if (!id) {
    throw new Error('缺少视频ID参数');
  }

  if (!/^[\w-]+$/.test(id)) {
    throw new Error('无效的视频ID格式');
  }

  if (sourceCode === 'custom' && !customApi) {
    throw new Error('使用自定义API时必须提供API地址');
  }

  if (!API_SITES[sourceCode] && sourceCode !== 'custom') {
    throw new Error('无效的API来源');
  }

  // 特殊源详情处理
  if (sourceCode !== 'custom' && API_SITES[sourceCode].detail) {
    return await handleSpecialSourceDetail(id, sourceCode);
  }

  // 自定义 API 特殊处理
  if (sourceCode === 'custom' && customDetail) {
    return await handleCustomApiSpecialDetail(id, customDetail);
  }
  if (sourceCode === 'custom' && params.useDetail === 'true') {
    return await handleCustomApiSpecialDetail(id, customApi);
  }

  const detailUrl = customApi
    ? `${customApi}${API_CONFIG.detail.path}${id}`
    : `${API_SITES[sourceCode].api}${API_CONFIG.detail.path}${id}`;

  const response = await apiFetch(detailUrl, { ...API_CONFIG.detail.headers }, TIMING.API_REQUEST_TIMEOUT);

  if (!response.ok) {
    throw new Error(`详情请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
    throw new Error('获取到的详情内容无效');
  }

  const videoDetail = data.list[0];
  let episodes: string[] = [];

  if (videoDetail.vod_play_url) {
    const playSources = videoDetail.vod_play_url.split('$$$');
    if (playSources.length > 0) {
      const mainSource = playSources[0];
      const episodeList = mainSource.split('#');
      episodes = episodeList
        .map((ep: string) => {
          const parts = ep.split('$');
          return parts.length > 1 ? parts[1] : '';
        })
        .filter((url: string) => url && (url.startsWith('http://') || url.startsWith('https://')));
    }
  }

  if (episodes.length === 0 && videoDetail.vod_content) {
    const matches: string[] = videoDetail.vod_content.match(M3U8_PATTERN) || [];
    episodes = matches.map((link: string) => link.replace(/^\$/, ''));
  }

  return JSON.stringify({
    code: 200,
    episodes,
    detailUrl,
    videoInfo: {
      title: videoDetail.vod_name,
      cover: videoDetail.vod_pic,
      desc: videoDetail.vod_content,
      type: videoDetail.type_name,
      year: videoDetail.vod_year,
      area: videoDetail.vod_area,
      director: videoDetail.vod_director,
      actor: videoDetail.vod_actor,
      remarks: videoDetail.vod_remarks,
      source_name: sourceCode === 'custom' ? '自定义源' : API_SITES[sourceCode].name,
      source_code: sourceCode,
    },
  });
}

// ==================== 特殊源详情处理 ====================

async function handleCustomApiSpecialDetail(id: string, customApi: string): Promise<string> {
  const detailUrl = `${customApi}/index.php/vod/detail/id/${id}.html`;

  const response = await apiFetch(
    detailUrl,
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    TIMING.API_REQUEST_TIMEOUT
  );

  if (!response.ok) {
    throw new Error(`自定义API详情页请求失败: ${response.status}`);
  }

  const html = await response.text();

  const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
  let matches: string[] = html.match(generalPattern) || [];
  matches = matches.map((link: string) => {
    link = link.substring(1);
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);
  const descText = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

  return JSON.stringify({
    code: 200,
    episodes: matches,
    detailUrl,
    videoInfo: {
      title: titleText,
      desc: descText,
      source_name: '自定义源',
      source_code: 'custom',
    },
  });
}

async function handleSpecialSourceDetail(id: string, sourceCode: string): Promise<string> {
  const detailUrl = `${API_SITES[sourceCode].detail}/index.php/vod/detail/id/${id}.html`;

  const response = await apiFetch(
    detailUrl,
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    TIMING.API_REQUEST_TIMEOUT
  );

  if (!response.ok) {
    throw new Error(`详情页请求失败: ${response.status}`);
  }

  const html = await response.text();
  let matches: string[] = [];

  if (sourceCode === 'ffzy') {
    const ffzyPattern = /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
    matches = (html.match(ffzyPattern) || []) as string[];
  }

  if (matches.length === 0) {
    const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    matches = (html.match(generalPattern) || []) as string[];
  }

  matches = [...new Set(matches)];
  matches = matches.map((link: string) => {
    link = link.substring(1);
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);
  const descText = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

  return JSON.stringify({
    code: 200,
    episodes: matches,
    detailUrl,
    videoInfo: {
      title: titleText,
      desc: descText,
      source_name: API_SITES[sourceCode].name,
      source_code: sourceCode,
    },
  });
}

// ==================== 统一的 API 入口 ====================

/**
 * 处理 API 请求的统一入口（用于 Pages Functions）
 * 替代原有的 URL 路由 + handleApiRequest
 */
export async function handleApiRequest(url: URL): Promise<string> {
  try {
    const searchParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      searchParams[key] = value;
    });

    if (url.pathname === '/api/search') {
      return await handleApiSearch(searchParams);
    }

    if (url.pathname === '/api/detail') {
      return await handleApiDetail(searchParams);
    }

    throw new Error('未知的API路径');
  } catch (error) {
    console.error('API处理错误:', error);
    return JSON.stringify({
      code: 400,
      msg: (error as Error).message || '请求处理失败',
      list: [],
      episodes: [],
    });
  }
}

// ==================== 聚合搜索 ====================

interface AggregatedSearchResult {
  source: string;
  sourceName: string;
  results: any[];
  responseTime: number;
}

/**
 * 执行聚合搜索（跨所有选中的 API 源）
 */
export async function handleAggregatedSearch(searchQuery: string): Promise<AggregatedSearchResult[]> {
  const selectedAPIs: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
    } catch {
      return [];
    }
  })();

  const sourceApis = selectedAPIs.filter((key: string) => key !== 'aggregated' && key !== 'custom');

  const results = await Promise.allSettled(
    sourceApis.map(async (source: string) => {
      const startTime = Date.now();
      const apiUrl = `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;

      try {
        const response = await apiFetch(
          apiUrl,
          { ...API_CONFIG.search.headers },
          AGGREGATED_SEARCH_CONFIG.timeout || 8000
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const list = data?.list || [];

        return {
          source,
          sourceName: API_SITES[source].name,
          results: list.map((item: any) => ({
            ...item,
            source_name: API_SITES[source].name,
            source_code: source,
          })),
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        console.warn(`聚合搜索 - ${API_SITES[source].name} 失败:`, error);
        return null;
      }
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<AggregatedSearchResult | null> => r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((r): r is AggregatedSearchResult => r !== null);
}
