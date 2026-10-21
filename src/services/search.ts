interface SearchResultItem {
    [key: string]: unknown;
    source_name?: string | undefined;
    source_code?: string;
    api_url?: string | undefined;
    source_latency?: number;
}

interface SearchResponseData {
    list?: unknown[];
    pagecount?: number;
    [key: string]: unknown;
}

interface SearchWindow extends Window {
    loadBalancer?: LoadBalancer;
    ProxyAuth?: { addAuthToProxyUrl(url: string): Promise<string> };
}

const searchWindow = window as SearchWindow;

// 搜索缓存
const _searchCache = new Map<string, { results: SearchResultItem[]; timestamp: number }>();
const SEARCH_CACHE_TTL = 30 * 60 * 1000; // 缓存30分钟

// 按分类拉取缓存（类别入口混合兜底用）
const _categoryCache = new Map<string, { results: SearchResultItem[]; timestamp: number }>();
const CATEGORY_CACHE_TTL = 30 * 60 * 1000; // 缓存30分钟

function _getCacheKey(apiId: string, query: string): string {
    return `${apiId}_${query.toLowerCase()}`;
}

function _getCachedResult(apiId: string, query: string): SearchResultItem[] | null {
    const key = _getCacheKey(apiId, query);
    const cached = _searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
        return cached.results;
    }
    _searchCache.delete(key);
    return null;
}

function _setCachedResult(apiId: string, query: string, results: SearchResultItem[]): void {
    const key = _getCacheKey(apiId, query);
    _searchCache.set(key, { results, timestamp: Date.now() });
    // 缓存超过100条时清理过期项
    if (_searchCache.size > 100) {
        const now = Date.now();
        for (const [k, v] of _searchCache) {
            if (now - v.timestamp > SEARCH_CACHE_TTL) _searchCache.delete(k);
        }
    }
}

async function searchByAPIAndKeyWord(apiId: string, query: string): Promise<SearchResultItem[]> {
    // 检查缓存
    const cached = _getCachedResult(apiId, query);
    if (cached) {
        return cached;
    }

    try {
        let apiUrl: string;
        let apiName: string | undefined;
        let apiBaseUrl: string;

        // 处理自定义API
        if (apiId.startsWith('custom_')) {
            const customIndex = apiId.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) return [];

            apiBaseUrl = customApi.url;
            apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
            apiName = customApi.name;
        } else {
            // 内置API
            if (!API_SITES[apiId]) return [];
            apiBaseUrl = API_SITES[apiId].api;
            apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
            apiName = API_SITES[apiId].name;
        }

        // 记录开始时间用于负载均衡统计
        const startTime = Date.now();

        // 增加API负载
        if (searchWindow.loadBalancer) {
            searchWindow.loadBalancer.increaseApiLoad(apiId);
        }

        // 添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AGGREGATED_SEARCH_CONFIG?.timeout || 8000);

        // 添加鉴权参数到代理URL
        const proxiedUrl = await searchWindow.ProxyAuth?.addAuthToProxyUrl ?
            await searchWindow.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
            PROXY_URL + encodeURIComponent(apiUrl);

        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json() as SearchResponseData;

        if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
            // 记录成功但无结果的情况
            const responseTime = Date.now() - startTime;
            if (searchWindow.loadBalancer) {
                searchWindow.loadBalancer.recordApiResult(apiId, true, responseTime);
            }
            return [];
        }

        // 处理第一页结果
        const results: SearchResultItem[] = data.list.map(item => ({
            ...(item as SearchResultItem),
            source_name: apiName,
            source_code: apiId,
            api_url: apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
        }));

        // 获取总页数
        const pageCount = data.pagecount || 1;
        // 确定需要获取的额外页数 (最多获取maxPages页)
        const pagesToFetch = Math.min(pageCount - 1, API_CONFIG.search.maxPages - 1);

        // 如果有额外页数，获取更多页的结果
        if (pagesToFetch > 0) {
            const additionalPagePromises: Promise<SearchResultItem[]>[] = [];

            for (let page = 2; page <= pagesToFetch + 1; page++) {
                // 构建分页URL
                const pageUrl = apiBaseUrl + API_CONFIG.search.pagePath
                    .replace('{query}', encodeURIComponent(query))
                    .replace('{page}', String(page));

                // 创建获取额外页的Promise
                const pagePromise = (async (): Promise<SearchResultItem[]> => {
                    try {
                        const pageController = new AbortController();
                        const pageTimeoutId = setTimeout(() => pageController.abort(), AGGREGATED_SEARCH_CONFIG?.timeout || 8000);

                        // 添加鉴权参数到代理URL
                        const proxiedPageUrl = await searchWindow.ProxyAuth?.addAuthToProxyUrl ?
                            await searchWindow.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(pageUrl)) :
                            PROXY_URL + encodeURIComponent(pageUrl);

                        const pageResponse = await fetch(proxiedPageUrl, {
                            headers: API_CONFIG.search.headers,
                            signal: pageController.signal
                        });

                        clearTimeout(pageTimeoutId);

                        if (!pageResponse.ok) return [];

                        const pageData = await pageResponse.json() as SearchResponseData;

                        if (!pageData || !pageData.list || !Array.isArray(pageData.list)) return [];

                        // 处理当前页结果
                        return pageData.list.map(item => ({
                            ...(item as SearchResultItem),
                            source_name: apiName,
                            source_code: apiId,
                            api_url: apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
                        }));
                    } catch (error) {
                        console.warn(`API ${apiId} 第${page}页搜索失败:`, error);
                        return [];
                    }
                })();

                additionalPagePromises.push(pagePromise);
            }

            // 等待所有额外页的结果
            const additionalResults = await Promise.all(additionalPagePromises);

            // 合并所有页的结果
            additionalResults.forEach(pageResults => {
                if (pageResults.length > 0) {
                    results.push(...pageResults);
                }
            });
        }

        // 记录成功的请求
        const responseTime = Date.now() - startTime;
        if (searchWindow.loadBalancer) {
            searchWindow.loadBalancer.recordApiResult(apiId, true, responseTime);
        }

        // 把该源本次搜索的整体耗时附加到结果上，供结果卡片标注快/中/慢
        results.forEach(item => { item.source_latency = responseTime; });

        // 写入缓存
        _setCachedResult(apiId, query, results);
        return results;
    } catch (error) {
        console.warn(`API ${apiId} 搜索失败:`, error);

        // 记录失败的请求
        if (searchWindow.loadBalancer) {
            searchWindow.loadBalancer.recordApiResult(apiId, false, 0, error);
        }

        return [];
    }
}

// 按分类拉取某源影片（MacCMS 标准 ac=videolist&class=<分类名>&pg=<页码>）
// 用于类别入口「关键词搜索无结果」时的混合兜底，不依赖关键词
async function searchByCategory(apiId: string, className: string, page = 1): Promise<SearchResultItem[]> {
    const cacheKey = apiId + '|' + className + '|' + page;
    const cached = _categoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATEGORY_CACHE_TTL) {
        return cached.results;
    }
    _categoryCache.delete(cacheKey);

    try {
        let apiBaseUrl: string;
        let apiName: string | undefined;

        if (apiId.startsWith('custom_')) {
            const customApi = getCustomApiInfo(apiId.replace('custom_', ''));
            if (!customApi) return [];
            apiBaseUrl = customApi.url;
            apiName = customApi.name;
        } else {
            if (!API_SITES[apiId]) return [];
            apiBaseUrl = API_SITES[apiId].api;
            apiName = API_SITES[apiId].name;
        }

        const apiUrl = apiBaseUrl + '?ac=videolist&class=' + encodeURIComponent(className) + '&pg=' + page;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AGGREGATED_SEARCH_CONFIG?.timeout || 8000);

        const proxiedUrl = await searchWindow.ProxyAuth?.addAuthToProxyUrl ?
            await searchWindow.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
            PROXY_URL + encodeURIComponent(apiUrl);

        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) return [];

        const data = await response.json() as SearchResponseData;
        if (!data || !Array.isArray(data.list) || data.list.length === 0) return [];

        const results: SearchResultItem[] = data.list.map(item => ({
            ...(item as SearchResultItem),
            source_name: apiName,
            source_code: apiId,
            api_url: apiId.startsWith('custom_') ? apiBaseUrl : undefined
        }));

        _categoryCache.set(cacheKey, { results, timestamp: Date.now() });
        if (_categoryCache.size > 100) {
            const now = Date.now();
            for (const [k, v] of _categoryCache) {
                if (now - v.timestamp > CATEGORY_CACHE_TTL) _categoryCache.delete(k);
            }
        }
        return results;
    } catch (error) {
        console.warn(`API ${apiId} 按分类(${className})拉取失败:`, error);
        return [];
    }
}

// 阶段 5A-4 过渡期兼容桥：app bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  SEARCH_CACHE_TTL,
  searchByAPIAndKeyWord,
  searchByCategory
});
