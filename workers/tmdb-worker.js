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

// 邀请码 API 辅助函数
function jsonResponse(data, status) {
  const body = JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// 生成邀请码：LELE-XXXX-XXXX（排除易混淆字符 0O1Il）
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function segment(len) {
    let s = '';
    const array = new Uint8Array(len);
    crypto.getRandomValues(array);
    for (let i = 0; i < len; i++) {
      s += chars[array[i] % chars.length];
    }
    return s;
  }
  return `LELE-${segment(4)}-${segment(4)}`;
}

// 验证管理员密码
async function verifyAdminPassword(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !env.PASSWORD) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(env.PASSWORD);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return token === expectedHash;
}

// 获取客户端 IP
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

// 获取浏览器 UA 摘要
function getBrowserSummary(request) {
  const ua = request.headers.get('User-Agent') || '';
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg/')) return 'Edge';
  return 'Unknown';
}

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
  
  // 拦截 /invite/* 路由
  if (url.pathname.startsWith('/invite/')) {
    return handleInviteRequest(request, event);
  }
  
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

// ====== 邀请码 API 路由 ======

async function handleInviteRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ ok: false, error: '不支持的请求方法' }, 405);
  }
  
  try {
    if (path === '/invite/verify' && request.method === 'POST') {
      return handleVerify(request, env);
    }
    if (path === '/invite/heartbeat' && request.method === 'POST') {
      return handleHeartbeat(request, env);
    }
    if (path === '/invite/generate' && request.method === 'POST') {
      return handleGenerate(request, env);
    }
    if (path === '/invite/list' && request.method === 'GET') {
      return handleList(request, env);
    }
    if (path === '/invite/toggle' && request.method === 'POST') {
      return handleToggle(request, env);
    }
    if (path === '/invite/stats' && request.method === 'GET') {
      return handleStats(request, env);
    }
    
    return jsonResponse({ ok: false, error: '未找到路由' }, 404);
  } catch (error) {
    console.error('Invite API error:', error);
    return jsonResponse({ ok: false, error: `服务器错误: ${error.message}` }, 500);
  }
}

// POST /invite/verify - 验证邀请码 + 注册/更新设备
async function handleVerify(request, env) {
  const body = await request.json();
  const { code, device_name, device_fingerprint } = body;
  
  if (!code || !device_name || !device_fingerprint) {
    return jsonResponse({ ok: false, error: '缺少必填参数: code, device_name, device_fingerprint' }, 400);
  }
  
  const invite = await env.INVITE_DB.prepare(
    'SELECT * FROM invitation_codes WHERE code = ?'
  ).bind(code).first();
  
  if (!invite) {
    return jsonResponse({ ok: false, error: '邀请码无效' }, 403);
  }
  
  if (!invite.is_active) {
    return jsonResponse({ ok: false, error: '邀请码已被禁用' }, 403);
  }
  
  const existingDevice = await env.INVITE_DB.prepare(
    'SELECT * FROM devices WHERE device_fingerprint = ?'
  ).bind(device_fingerprint).first();
  
  if (existingDevice) {
    await env.INVITE_DB.prepare(
      'UPDATE devices SET last_active_at = ?, ip_address = ?, browser = ?, device_name = ? WHERE id = ?'
    ).bind(Date.now(), getClientIP(request), getBrowserSummary(request), device_name, existingDevice.id).run();
    
    return jsonResponse({ ok: true, action: 'renewed', message: '欢迎回来' });
  }
  
  const deviceCount = await env.INVITE_DB.prepare(
    'SELECT COUNT(*) as count FROM devices WHERE code = ?'
  ).bind(code).first();
  
  if (deviceCount.count >= invite.max_devices) {
    const oldest = await env.INVITE_DB.prepare(
      'SELECT id FROM devices WHERE code = ? ORDER BY last_active_at ASC LIMIT 1'
    ).bind(code).first();
    
    if (oldest) {
      await env.INVITE_DB.prepare('DELETE FROM devices WHERE id = ?').bind(oldest.id).run();
    }
  }
  
  const now = Date.now();
  await env.INVITE_DB.prepare(
    'INSERT INTO devices (code, device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(code, device_name, device_fingerprint, getBrowserSummary(request), getClientIP(request), now, now).run();
  
  const action = deviceCount.count >= invite.max_devices ? 'evicted' : 'registered';
  return jsonResponse({ ok: true, action, message: '验证成功' });
}

// POST /invite/heartbeat - 设备心跳
async function handleHeartbeat(request, env) {
  const body = await request.json();
  const { device_fingerprint } = body;
  
  if (!device_fingerprint) {
    return jsonResponse({ ok: false, error: '缺少 device_fingerprint' }, 400);
  }
  
  const result = await env.INVITE_DB.prepare(
    'UPDATE devices SET last_active_at = ? WHERE device_fingerprint = ?'
  ).bind(Date.now(), device_fingerprint).run();
  
  return jsonResponse({ ok: true, updated: result.changes > 0 });
}

// POST /invite/generate - 管理员生成邀请码
async function handleGenerate(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateInviteCode();
    const existing = await env.INVITE_DB.prepare(
      'SELECT id FROM invitation_codes WHERE code = ?'
    ).bind(code).first();
    if (!existing) break;
    code = null;
  }
  
  if (!code) {
    return jsonResponse({ ok: false, error: '邀请码生成失败，请重试' }, 500);
  }
  
  await env.INVITE_DB.prepare(
    'INSERT INTO invitation_codes (code, created_at) VALUES (?, ?)'
  ).bind(code, Date.now()).run();
  
  return jsonResponse({ ok: true, code, created_at: Date.now() });
}

// GET /invite/list - 管理员查看所有邀请码
async function handleList(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const codes = await env.INVITE_DB.prepare(
    'SELECT * FROM invitation_codes ORDER BY created_at DESC'
  ).all();
  
  const result = await Promise.all(codes.results.map(async (invite) => {
    const devices = await env.INVITE_DB.prepare(
      'SELECT device_name, browser, ip_address, first_active_at, last_active_at FROM devices WHERE code = ? ORDER BY last_active_at DESC'
    ).bind(invite.code).all();
    
    return {
      code: invite.code,
      created_at: invite.created_at,
      is_active: !!invite.is_active,
      max_devices: invite.max_devices,
      device_count: devices.results.length,
      devices: devices.results
    };
  }));
  
  return jsonResponse({ ok: true, codes: result });
}

// POST /invite/toggle - 管理员启用/禁用邀请码
async function handleToggle(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const body = await request.json();
  const { code, is_active } = body;
  
  if (!code || typeof is_active !== 'boolean') {
    return jsonResponse({ ok: false, error: '缺少必填参数' }, 400);
  }
  
  const result = await env.INVITE_DB.prepare(
    'UPDATE invitation_codes SET is_active = ? WHERE code = ?'
  ).bind(is_active ? 1 : 0, code).run();
  
  return jsonResponse({ ok: true, updated: result.changes > 0 });
}

// GET /invite/stats - 管理员统计概览
async function handleStats(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const totalCodes = await env.INVITE_DB.prepare('SELECT COUNT(*) as count FROM invitation_codes').first();
  const activeCodes = await env.INVITE_DB.prepare('SELECT COUNT(*) as count FROM invitation_codes WHERE is_active = 1').first();
  const totalDevices = await env.INVITE_DB.prepare('SELECT COUNT(*) as count FROM devices').first();
  
  return jsonResponse({
    ok: true,
    total_codes: totalCodes.count,
    active_codes: activeCodes.count,
    total_devices: totalDevices.count
  });
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
  const url = new URL(event.request.url);
  
  if (event.request.method === 'OPTIONS') {
    if (url.pathname.startsWith('/invite/')) {
      event.respondWith(handleInviteRequest(event.request, event));
    } else {
      event.respondWith(new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      }));
    }
  } else {
    event.respondWith(handleRequest(event.request, event));
  }
});
