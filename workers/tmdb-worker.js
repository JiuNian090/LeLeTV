// Cloudflare Worker - TMDB API 代理
// 支持路径参数和查询参数两种方式
//
// 方式1: ?endpoint=discover/movie&page=1
// 方式2: /discover/movie?page=1
//
// 部署后设置环境变量 TMDB_API_KEY

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === '/health' || url.pathname === '/') {
    return healthCheck();
  }

  let endpoint = url.searchParams.get('endpoint') || '';

  if (!endpoint) {
    endpoint = url.pathname.replace(/^\//, '');
  }

  if (!endpoint) {
    return jsonResponse({ success: false, error: '缺少 endpoint 参数' }, 400);
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
    return jsonResponse({ success: false, error: `不允许的端点: ${endpoint}` }, 403);
  }

  const tmdbApiKey = typeof TMDB_API_KEY !== 'undefined' ? TMDB_API_KEY : '';
  if (!tmdbApiKey) {
    return jsonResponse({
      success: false,
      error: 'TMDB API Key 未配置',
      hint: '请在 Cloudflare Dashboard → Worker → 设置 → 环境变量中添加 TMDB_API_KEY'
    }, 500);
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
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch { errorData = errorText; }
      return jsonResponse({
        success: false,
        error: `TMDB API 错误: ${response.status}`,
        details: errorData
      }, response.status);
    }

    const data = await response.json();

    if (endpoint === 'configuration') {
      data.image_base_url = TMDB_IMAGE_BASE;
    }

    return jsonResponse(data, 200);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: `TMDB 请求失败: ${error.message}`
    }, 500);
  }
}

function healthCheck() {
  return jsonResponse({
    status: 'ok',
    service: 'TMDB Proxy Worker',
    version: '2.0.0',
    usage: {
      query_param: '/?endpoint=discover/movie&page=1',
      path_param: '/discover/movie?page=1',
      health: '/health'
    },
    note: 'TMDB_API_KEY 通过 Worker 环境变量安全注入'
  }, 200);
}

function jsonResponse(data, status) {
  const body = JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
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
    event.respondWith(handleRequest(event.request));
  }
});
