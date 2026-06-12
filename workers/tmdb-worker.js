// @ts-nocheck
// Cloudflare Worker - TMDB API 代理
// 支持路径参数和查询参数两种方式
//
// 方式1: ?endpoint=discover/movie&page=1
// 方式2: /discover/movie?page=1
//
// 部署后设置环境变量 TMDB_API_KEY
//
// 缓存策略：
// - 首页/分类/详情数据：边缘缓存 24 小时
// - 搜索数据：边缘缓存 1 小时（按搜索词独立缓存）
// - 浏览器统一缓存 2 分钟 + stale-while-revalidate

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// 不同端点的边缘缓存时间（秒）
// 0 = 不使用边缘缓存
const EDGE_CACHE_TTL = {
  'discover/': 86400,       // 24小时 - 首页分类发现
  'genre/': 86400,          // 24小时 - 类型列表
  'trending/': 86400,       // 24小时 - 趋势内容
  'movie/': 86400,          // 24小时 - 电影详情
  'tv/': 86400,             // 24小时 - 剧集详情
  'person/': 86400,         // 24小时 - 人物信息
  'configuration': 86400,   // 24小时 - TMDB 配置
  'search/': 3600,          // 1小时 - 搜索结果（不同搜索词独立缓存）
  'keyword/': 86400,        // 24小时 - 关键词
  'collection/': 86400,     // 24小时 - 合集
  'credit/': 86400,         // 24小时 - 演职员
};

function getCacheTTL(endpoint) {
  for (const [prefix, ttl] of Object.entries(EDGE_CACHE_TTL)) {
    if (endpoint.startsWith(prefix) || endpoint === prefix.replace('/', '')) {
      return ttl;
    }
  }
  return 0; // 未匹配的 endpoint 不使用边缘缓存
}

function buildCacheControl(cacheTTL) {
  // 浏览器缓存统一 2 分钟
  let cc = 'public, max-age=120';

  if (cacheTTL > 0) {
    // 边缘缓存 + stale-while-revalidate（过期后一半时间内可提供过期内容）
    const swr = Math.floor(cacheTTL * 0.5);
    cc += `, s-maxage=${cacheTTL}, stale-while-revalidate=${swr}`;
  } else {
    // 无边缘缓存时保留短的 stale-while-revalidate
    cc += ', stale-while-revalidate=600';
  }

  return cc;
}

async function handleRequest(request, event) {
  const url = new URL(request.url);
  const cache = caches.default;

  if (url.pathname === '/' && !url.searchParams.has('endpoint')) {
    return serveDashboard();
  }

  let endpoint = url.searchParams.get('endpoint') || '';

  if (!endpoint) {
    endpoint = url.pathname.replace(/^\//, '');
  }

  if (!endpoint) {
    return jsonResponse({ success: false, error: '缺少 endpoint 参数' }, 400, 0);
  }

  const allowedPrefixes = [
    'discover/', 'search/', 'genre/', 'movie/', 'tv/',
    'trending/', 'person/', 'configuration', 'keyword/',
    'credit/', 'find/', 'collection/', 'network/',
    'watch/', 'certification', 'company/', 'timezone/',
    'account/', 'authentication/', 'changes', 'review/',
    'list/', 'translations/'
  ];

  const isAllowed = allowedPrefixes.some(p => endpoint.startsWith(p));
  if (!isAllowed) {
    return jsonResponse({ success: false, error: `不允许的端点: ${endpoint}` }, 403, 0);
  }

  const cacheTTL = getCacheTTL(endpoint);

  // 先尝试命中边缘缓存（仅对 GET 请求）
  if (cacheTTL > 0 && request.method === 'GET') {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  const tmdbApiKey = typeof TMDB_API_KEY !== 'undefined' ? TMDB_API_KEY : '';
  if (!tmdbApiKey) {
    return jsonResponse({
      success: false,
      error: 'TMDB API Key 未配置',
      hint: '请在 Cloudflare Dashboard → Worker → 设置 → 环境变量中添加 TMDB_API_KEY'
    }, 500, 0);
  }

  const queryParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'endpoint') {
      queryParams.set(key, value);
    }
  }
  queryParams.set('api_key', tmdbApiKey);
  if (!queryParams.has('language')) {
    queryParams.set('language', 'zh-CN');
  }

  const targetUrl = `${TMDB_BASE_URL}/${endpoint}?${queryParams.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch { errorData = errorText; }
      return jsonResponse({
        success: false,
        error: `TMDB API 错误: ${response.status}`,
        details: errorData
      }, response.status, 0);
    }

    const data = await response.json();

    if (endpoint === 'configuration') {
      data.image_base_url = TMDB_IMAGE_BASE;
    }

    const res = jsonResponse(data, 200, cacheTTL);

    // 写入边缘缓存 —— 用 waitUntil 不阻塞响应返回
    if (cacheTTL > 0 && request.method === 'GET') {
      const cloned = res.clone();
      event.waitUntil(cache.put(request, cloned));
    }

    return res;
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return jsonResponse({
      success: false,
      error: isTimeout ? 'TMDB 请求超时，请稍后重试' : `TMDB 请求失败: ${error.message}`
    }, 500, 0);
  }
}

async function serveDashboard() {
  const apiKey = typeof TMDB_API_KEY !== 'undefined' ? TMDB_API_KEY : '';
  const keyConfigured = !!apiKey;

  let tmdbStatus = 'unknown';
  let tmdbLabel = '检测中...';

  if (!keyConfigured) {
    tmdbStatus = 'error';
    tmdbLabel = 'API Key 未配置';
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const testUrl = `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`;
      const resp = await fetch(testUrl, { signal: controller.signal });
      clearTimeout(timer);
      tmdbStatus = resp.ok ? 'ok' : 'error';
      tmdbLabel = resp.ok ? '连通正常' : `HTTP ${resp.status}`;
    } catch (e) {
      tmdbStatus = 'error';
      tmdbLabel = e.name === 'AbortError' ? '连接超时' : '连接失败';
    }
  }

  const workerStatus = 'ok';
  const workerLabel = '运行中';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LeLeTV TMDB Proxy</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0f;color:#e0e0e0;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{max-width:420px;width:90%;padding:40px 36px;background:#16161a;border:1px solid #2a2a30;border-radius:12px}
h1{font-size:16px;font-weight:500;color:#888;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase}
.sub{font-size:12px;color:#555;margin-bottom:28px}
.status-list{display:flex;flex-direction:column;gap:14px}
.status-item{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#1a1a1f;border-radius:8px;font-size:14px}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.dot.ok{background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,0.4)}
.dot.error{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.4)}
.dot.unknown{background:#6b7280;box-shadow:0 0 8px rgba(107,114,128,0.3)}
.label{color:#aaa}
.status-item .value{color:#e0e0e0;margin-left:auto}
.refresh{display:block;margin-top:24px;padding:8px 0;width:100%;background:#1e1e24;border:1px solid #2a2a30;border-radius:8px;color:#888;font-size:13px;cursor:pointer;transition:all 0.2s;text-align:center;text-decoration:none}
.refresh:hover{background:#2a2a30;color:#e0e0e0}
.footer{margin-top:20px;text-align:center;font-size:11px;color:#444}
</style>
</head>
<body>
<div class="container">
<h1>LeLeTV TMDB Proxy</h1>
<div class="sub">TMDB API 代理状态</div>
<div class="status-list">
<div class="status-item">
<span class="dot ${workerStatus}"></span>
<span class="label">Worker</span>
<span class="value">${workerLabel}</span>
</div>
<div class="status-item">
<span class="dot ${tmdbStatus}"></span>
<span class="label">TMDB</span>
<span class="value">${tmdbLabel}</span>
</div>
</div>
<a href="/" class="refresh">刷新状态</a>
<div class="footer">Powered by Cloudflare Workers</div>
</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function jsonResponse(data, status, cacheTTL) {
  const body = JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': buildCacheControl(cacheTTL),
      'X-TMDB-Proxy': 'leletv-worker-v2'
    }
  });
}

addEventListener('fetch', event => {
  if (event.request.method === 'OPTIONS') {
    event.respondWith(new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    }));
  } else {
    event.respondWith(handleRequest(event.request, event));
  }
});
