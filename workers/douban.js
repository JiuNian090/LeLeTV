// @ts-nocheck
// Cloudflare Worker — 豆瓣元数据代理
//
// 与 workers/tmdb-worker.js 同一个 Worker：入口 import 本模块，按 /douban/* 分流。
// 作用：
//   1. 规避豆瓣接口的 CORS（豆瓣不返回 Access-Control-Allow-Origin）
//   2. 统一 UA / Referer，降低被反爬拦截的概率
//   3. 用 caches.default 做边缘缓存；失败返回 JSON，绝不透传 HTML
//   4. 代理豆瓣图片（豆瓣图床只接受豆瓣域 Referer）
//
// 路由（全部 GET）：
//   /douban/tags?type=movie|tv
//   /douban/list?mode=tag&type=movie&tag=热门&page=0&pageSize=20
//   /douban/list?mode=filter&type=movie&tags=电影,剧情&sort=U&range=0,10&start=0
//   /douban/search?q=关键词&type=movie|tv
//   /douban/detail?id=1292052&type=movie&credits=1
//   /douban/image?url=https%3A%2F%2Fimg3.doubanio.com%2Fview%2Fphoto%2F...
//
// 不做什么：
//   - 不做通用转发（只请求豆瓣固定域名与固定路径）
//   - 不处理非 GET
//   - 不把上游错误 HTML 返回给浏览器

const DOUBAN_MOVIE_BASE = 'https://movie.douban.com';
const DOUBAN_MOBILE_BASE = 'https://m.douban.com';
const DOUBAN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DOUBAN_MOVIE_REFERER = 'https://movie.douban.com/';
const DOUBAN_MOBILE_REFERER = 'https://m.douban.com/';

const CACHE_TTL = {
  tags: 3600,
  list: 600,
  search: 300,
  detail: 1800,
  credits: 1800,
  image: 2592000,
};

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function buildCacheControl(ttl) {
  if (!ttl) return 'no-store';
  return `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`;
}

function jsonResponse(data, status = 200, cacheTTL = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': buildCacheControl(cacheTTL),
      'X-Douban-Proxy': 'leletv-worker-v1',
    },
  });
}

function errorResponse(error) {
  const code = error && error.code ? error.code : 'upstream_error';
  const status = code === 'anti-bot' ? 503 : (code === 'bad_request' ? 400 : 502);
  const message = error && error.message ? String(error.message) : '豆瓣请求失败';
  return jsonResponse({ ok: false, error: code, message }, status, 0);
}

function isMediaType(value) {
  return value === 'movie' || value === 'tv';
}

function clampInt(raw, min, max, fallback) {
  const value = Number.parseInt(String(raw == null ? '' : raw), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function validTag(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > 100) return '';
  // 标签里允许中文、字母、数字、空格与少量分隔符；拒绝控制字符
  if (/[\u0000-\u001f\u007f]/.test(text)) return '';
  return text;
}

function isAllowedImageUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || ''));
  } catch (e) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== '443') return false;
  if (parsed.hostname !== 'doubanio.com' && !parsed.hostname.endsWith('.doubanio.com')) return false;
  // 只允许豆瓣图片路径，防止把代理当通用下载器
  return parsed.pathname.startsWith('/view/photo/') || parsed.pathname.startsWith('/view/celebrity/');
}

async function fetchUpstreamJson(target, referer, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': DOUBAN_UA,
        Referer: referer,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      const error = new Error(`豆瓣上游返回 ${response.status}`);
      error.code = response.status === 403 || response.status === 418 ? 'anti-bot' : 'upstream_error';
      throw error;
    }

    const text = await response.text();
    if (!text) {
      const error = new Error('豆瓣上游返回空内容');
      error.code = 'upstream_error';
      throw error;
    }

    // 豆瓣被风控时经常返回 HTML 登录页/验证码页；不能把它当 JSON 透传
    const head = text.trim().slice(0, 500);
    if (head.startsWith('<') || /验证码|异常请求|登录豆瓣|检测到有异常/.test(head)) {
      const error = new Error('豆瓣触发了反爬验证');
      error.code = 'anti-bot';
      throw error;
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      const error = new Error('豆瓣返回了非 JSON 内容');
      error.code = 'anti-bot';
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(request, cacheTTL) {
  if (!cacheTTL) return null;
  try {
    return await caches.default.match(request);
  } catch (e) {
    return null;
  }
}

async function writeCache(ctx, request, response, cacheTTL) {
  if (!cacheTTL || !ctx || typeof ctx.waitUntil !== 'function') return;
  try {
    ctx.waitUntil(caches.default.put(request, response.clone()));
  } catch (e) {
    // 缓存失败不影响本次响应
  }
}

async function cachedJson(request, ctx, cacheTTL, loader) {
  const cached = await readCache(request, cacheTTL);
  if (cached) return cached;

  const data = await loader();
  const response = jsonResponse(data, 200, cacheTTL);
  await writeCache(ctx, request, response, cacheTTL);
  return response;
}

async function handleTags(request, ctx, url) {
  const type = url.searchParams.get('type') || 'movie';
  if (!isMediaType(type)) throw Object.assign(new Error('type 只能是 movie 或 tv'), { code: 'bad_request' });

  return cachedJson(request, ctx, CACHE_TTL.tags, async () => {
    const data = await fetchUpstreamJson(
      `${DOUBAN_MOVIE_BASE}/j/search_tags?type=${type}`,
      DOUBAN_MOVIE_REFERER
    );
    return { ok: true, tags: Array.isArray(data.tags) ? data.tags : [] };
  });
}

async function handleList(request, ctx, url) {
  const type = url.searchParams.get('type') || 'movie';
  if (!isMediaType(type)) throw Object.assign(new Error('type 只能是 movie 或 tv'), { code: 'bad_request' });

  const mode = url.searchParams.get('mode') === 'filter' ? 'filter' : 'tag';
  const page = clampInt(url.searchParams.get('page'), 0, 500, 0);
  const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 50, 20);

  return cachedJson(request, ctx, CACHE_TTL.list, async () => {
    if (mode === 'filter') {
      const tags = validTag(url.searchParams.get('tags'));
      if (!tags) throw Object.assign(new Error('缺少 tags 参数'), { code: 'bad_request' });
      const sort = ['U', 'T', 'S'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'U';
      const range = /^\d+(\.\d+)?,\d+(\.\d+)?$/.test(url.searchParams.get('range') || '')
        ? url.searchParams.get('range')
        : '0,10';
      const start = clampInt(url.searchParams.get('start'), 0, 10000, page * 20);
      const target = `${DOUBAN_MOVIE_BASE}/j/new_search_subjects`
        + `?sort=${sort}&range=${encodeURIComponent(range)}&tags=${encodeURIComponent(tags)}&start=${start}`;
      const data = await fetchUpstreamJson(target, DOUBAN_MOVIE_REFERER);
      const items = Array.isArray(data.data) ? data.data : [];
      return { ok: true, mode, data: items, hasMore: items.length >= 20 };
    }

    const tag = validTag(url.searchParams.get('tag')) || '热门';
    const start = page * pageSize;
    const target = `${DOUBAN_MOVIE_BASE}/j/search_subjects`
      + `?type=${type}&tag=${encodeURIComponent(tag)}&page_limit=${pageSize}&page_start=${start}`;
    const data = await fetchUpstreamJson(target, DOUBAN_MOVIE_REFERER);
    const items = Array.isArray(data.subjects) ? data.subjects : [];
    return { ok: true, mode: 'tag', data: items, hasMore: items.length >= pageSize };
  });
}

async function handleSearch(request, ctx, url) {
  const keyword = validTag(url.searchParams.get('q'));
  if (!keyword) throw Object.assign(new Error('缺少搜索关键词'), { code: 'bad_request' });
  const type = url.searchParams.get('type') || '';
  if (type && !isMediaType(type)) throw Object.assign(new Error('type 只能是 movie 或 tv'), { code: 'bad_request' });

  return cachedJson(request, ctx, CACHE_TTL.search, async () => {
    const data = await fetchUpstreamJson(
      `${DOUBAN_MOVIE_BASE}/j/subject_suggest?q=${encodeURIComponent(keyword)}`,
      DOUBAN_MOVIE_REFERER
    );
    const items = Array.isArray(data) ? data : [];
    return {
      ok: true,
      data: type ? items.filter(item => item && item.type === type) : items,
    };
  });
}

async function handleDetail(request, ctx, url) {
  const id = String(url.searchParams.get('id') || '').trim();
  if (!/^\d{1,12}$/.test(id)) throw Object.assign(new Error('无效的豆瓣 ID'), { code: 'bad_request' });

  const type = url.searchParams.get('type') || 'movie';
  if (!isMediaType(type)) throw Object.assign(new Error('type 只能是 movie 或 tv'), { code: 'bad_request' });

  const withCredits = url.searchParams.get('credits') === '1' || url.searchParams.get('credits') === 'true';

  return cachedJson(request, ctx, CACHE_TTL.detail, async () => {
    const detailUrl = `${DOUBAN_MOBILE_BASE}/rexxar/api/v2/${type}/${id}`;
    const detail = await fetchUpstreamJson(detailUrl, DOUBAN_MOBILE_REFERER);

    let credits = null;
    if (withCredits) {
      try {
        credits = await fetchUpstreamJson(`${detailUrl}/credits`, DOUBAN_MOBILE_REFERER);
      } catch (e) {
        // credits 是增强信息，失败不应该让详情整体失败
        console.warn('[douban] credits 获取失败:', e && e.message);
      }
    }

    return { ok: true, detail, credits };
  });
}

async function handleImage(request, ctx, url) {
  const raw = url.searchParams.get('url') || '';
  if (!isAllowedImageUrl(raw)) {
    return jsonResponse({ ok: false, error: 'bad_request', message: '不允许的图片地址' }, 400, 0);
  }

  const cached = await readCache(request, CACHE_TTL.image);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch(raw, {
      signal: controller.signal,
      headers: {
        'User-Agent': DOUBAN_UA,
        Referer: DOUBAN_MOVIE_REFERER,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      return jsonResponse({ ok: false, error: 'upstream_error', message: `豆瓣图片返回 ${upstream.status}` }, 502, 0);
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return jsonResponse({ ok: false, error: 'upstream_error', message: '上游不是图片' }, 502, 0);
    }

    const length = Number(upstream.headers.get('content-length') || 0);
    if (length > MAX_IMAGE_BYTES) {
      return jsonResponse({ ok: false, error: 'too_large', message: '图片过大' }, 413, 0);
    }

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': buildCacheControl(CACHE_TTL.image),
        'Access-Control-Allow-Origin': '*',
        'X-Douban-Proxy': 'leletv-worker-v1',
      },
    });
    await writeCache(ctx, request, response, CACHE_TTL.image);
    return response;
  } catch (e) {
    return jsonResponse({ ok: false, error: 'upstream_error', message: '豆瓣图片获取失败' }, 502, 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function handleDoubanRequest(request, env, ctx, url) {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed', message: '只支持 GET' }, 405, 0);
  }

  try {
    switch (url.pathname) {
      case '/douban/tags':
        return await handleTags(request, ctx, url);
      case '/douban/list':
        return await handleList(request, ctx, url);
      case '/douban/search':
        return await handleSearch(request, ctx, url);
      case '/douban/detail':
        return await handleDetail(request, ctx, url);
      case '/douban/image':
        return await handleImage(request, ctx, url);
      default:
        return jsonResponse({ ok: false, error: 'not_found', message: '未知的豆瓣路由' }, 404, 0);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
