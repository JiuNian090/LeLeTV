/**
 * 搜索模块
 * 按 API 源搜索视频，支持缓存和分页
 */

import { API_CONFIG, API_SITES, AGGREGATED_SEARCH_CONFIG, PROXY_URL } from './api-config';
import { LoadBalancer } from './load-balancer';
import { addAuthToProxyUrl } from '../auth/proxy-auth';

// ==================== 搜索缓存 ====================

interface CacheEntry {
  results: unknown[];
  timestamp: number;
}

const _searchCache = new Map<string, CacheEntry>();
const SEARCH_CACHE_TTL = 30 * 60 * 1000;

function _getCacheKey(apiId: string, query: string): string {
  return `${apiId}_${query.toLowerCase()}`;
}

function _getCachedResult(apiId: string, query: string): unknown[] | null {
  const key = _getCacheKey(apiId, query);
  const cached = _searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.results;
  }
  _searchCache.delete(key);
  return null;
}

function _setCachedResult(apiId: string, query: string, results: unknown[]): void {
  const key = _getCacheKey(apiId, query);
  _searchCache.set(key, { results, timestamp: Date.now() });
  if (_searchCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of _searchCache) {
      if (now - v.timestamp > SEARCH_CACHE_TTL) _searchCache.delete(k);
    }
  }
}

// ==================== 自定义 API 工具 ====================

interface CustomApiInfo {
  name: string;
  url: string;
  detail?: string;
  isHidden?: boolean;
}

function getCustomApiInfo(index: string): CustomApiInfo | null {
  try {
    const customAPIs: CustomApiInfo[] = JSON.parse(localStorage.getItem('customAPIs') || '[]');
    return customAPIs[Number(index)] || null;
  } catch {
    return null;
  }
}

// ==================== 搜索主函数 ====================

export interface SearchResult {
  [key: string]: unknown;
  source_name: string;
  source_code: string;
  api_url?: string;
  vod_name?: string;
  vod_pic?: string;
  vod_id?: string;
}

/**
 * 按 API 源搜索关键词
 * @param apiId API 标识符（内置 key 或 custom_N）
 * @param query 搜索关键词
 * @param loadBalancer 可选的负载均衡器实例
 */
export async function searchByAPIAndKeyWord(
  apiId: string,
  query: string,
  loadBalancer?: LoadBalancer
): Promise<SearchResult[]> {
  const cached = _getCachedResult(apiId, query);
  if (cached) return cached as SearchResult[];

  try {
    let apiUrl: string;
    let apiName: string;
    let apiBaseUrl: string;

    if (apiId.startsWith('custom_')) {
      const customIndex = apiId.replace('custom_', '');
      const customApi = getCustomApiInfo(customIndex);
      if (!customApi) return [];

      apiBaseUrl = customApi.url;
      apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
      apiName = customApi.name;
    } else {
      if (!API_SITES[apiId]) return [];
      apiBaseUrl = API_SITES[apiId].api;
      apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
      apiName = API_SITES[apiId].name;
    }

    const startTime = Date.now();

    if (loadBalancer) {
      loadBalancer.increaseApiLoad(apiId);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      AGGREGATED_SEARCH_CONFIG?.timeout || 8000
    );

    const proxiedUrl = await addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl));

    const response = await fetch(proxiedUrl, {
      headers: { ...API_CONFIG.search.headers },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
      const responseTime = Date.now() - startTime;
      if (loadBalancer) loadBalancer.recordApiResult(apiId, true, responseTime);
      return [];
    }

    const results: SearchResult[] = data.list.map((item: any) => ({
      ...item,
      source_name: apiName,
      source_code: apiId,
      api_url:
        apiId.startsWith('custom_')
          ? getCustomApiInfo(apiId.replace('custom_', ''))?.url
          : undefined,
    }));

    // 分页获取
    const pageCount = data.pagecount || 1;
    const pagesToFetch = Math.min(pageCount - 1, API_CONFIG.search.maxPages - 1);

    if (pagesToFetch > 0) {
      const additionalPagePromises: Promise<SearchResult[]>[] = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl =
          apiBaseUrl +
          API_CONFIG.search.pagePath
            .replace('{query}', encodeURIComponent(query))
            .replace('{page}', String(page));

        const pagePromise = (async (): Promise<SearchResult[]> => {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(
              () => pageController.abort(),
              AGGREGATED_SEARCH_CONFIG?.timeout || 8000
            );

            const proxiedPageUrl = await addAuthToProxyUrl(
              PROXY_URL + encodeURIComponent(pageUrl)
            );

            const pageResponse = await fetch(proxiedPageUrl, {
              headers: { ...API_CONFIG.search.headers },
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) return [];

            const pageData = await pageResponse.json();
            if (!pageData || !pageData.list || !Array.isArray(pageData.list)) return [];

            return pageData.list.map((item: any) => ({
              ...item,
              source_name: apiName,
              source_code: apiId,
              api_url:
                apiId.startsWith('custom_')
                  ? getCustomApiInfo(apiId.replace('custom_', ''))?.url
                  : undefined,
            }));
          } catch (error) {
            console.warn(`API ${apiId} 第${page}页搜索失败:`, error);
            return [];
          }
        })();

        additionalPagePromises.push(pagePromise);
      }

      const additionalResults = await Promise.all(additionalPagePromises);
      for (const pageResults of additionalResults) {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      }
    }

    const responseTime = Date.now() - startTime;
    if (loadBalancer) loadBalancer.recordApiResult(apiId, true, responseTime);

    _setCachedResult(apiId, query, results);
    return results;
  } catch (error) {
    console.warn(`API ${apiId} 搜索失败:`, error);
    if (loadBalancer) loadBalancer.recordApiResult(apiId, false, 0, error as Error);
    return [];
  }
}
