// @ts-nocheck
// Cloudflare Worker - TMDB API 代理 + 邀请码 API
// ES Module 格式（支持 D1 绑定）
//
// TMDB 部分：
// 方式1: ?endpoint=discover/movie&page=1
// 方式2: /discover/movie?page=1
//
// 邀请码部分：
// POST /invite/verify, /invite/heartbeat, /invite/generate, /invite/toggle
// GET  /invite/list, /invite/stats
//
// 视频源配置与管理面板（源列表已从 config.js 搬到 D1，表结构见 migrations/004_add_api_sites.sql）：
// GET  /api-sites               公开只读，仅返回启用的普通源（边缘缓存 60s）
// GET  /api-sites/hidden        需管理员鉴权，返回启用的私密源（18+）
// GET  /admin                   管理面板页面（自带登录框，页面本身不鉴权）
// POST /admin/login             账号（ADMINUSER）+ 密码（ADMINKEY）换取 Bearer token
// GET  /admin/status            运行状态（TMDB 配置、D1 就绪、源数量），需管理员鉴权
// GET  /admin/api-sites/list    全量列表（含停用与私密），需管理员鉴权
// POST /admin/api-sites/save | /delete | /toggle，需管理员鉴权
//
// 环境变量：
// - TMDB_API_KEY (secret)
// - HIDDENKEY (secret) / ADMINUSER + ADMINKEY：管理员鉴权（Bearer = 其 SHA-256）
// - D1: INVITE_DB binding
//
// 缓存策略：
// - 首页/分类/详情数据：边缘缓存 24 小时
// - 搜索数据：边缘缓存 1 小时（按搜索词独立缓存）
// - 浏览器统一缓存 2 分钟 + stale-while-revalidate

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ====== 邀请码 API 辅助函数 ======

// 设备记录找回门槛：设备实例 ID 丢失时（多为 Safari ITP 清理长期未访问站点的数据），
// 只有旧记录已闲置这么久，才认为它属于本机——否则同型号设备（软指纹相同）
// 首次登录会把对方正在使用的记录抢过来
const RESTORE_MIN_IDLE_MS = 24 * 60 * 60 * 1000;

// devices.device_signature 列是否存在（003 迁移是否已执行）。
// 探测为真后永久缓存；为假则每次重探，便于迁移执行后无需重启即自动生效。
let _signatureColumnChecked = false;
let _hasSignatureColumn = false;
async function hasSignatureColumn(env) {
  if (_signatureColumnChecked && _hasSignatureColumn) return true;
  try {
    await env.INVITE_DB.prepare('SELECT device_signature FROM devices LIMIT 1').first();
    _hasSignatureColumn = true;
  } catch {
    _hasSignatureColumn = false;
    console.warn('[invite] devices.device_signature 不存在，请执行 migrations/003_add_device_signature.sql');
  }
  _signatureColumnChecked = true;
  return _hasSignatureColumn;
}

// D1 的 run() 结果里受影响行数位于 meta.changes，顶层没有 changes 字段；
// 直接读 result.changes 恒为 undefined，会让 removed/deleted/updated 永远报 false
function affectedRows(result) {
  const changes = result?.meta?.changes ?? result?.changes;
  return typeof changes === 'number' ? changes : 0;
}

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

/** SHA-256 十六进制摘要（管理员 token 的生成与校验都基于它） */
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 管理员账号（ADMINUSER + ADMINKEY）对应的 Bearer token；未配置时返回空串 */
async function adminToken(env) {
  const adminName = env.ADMINUSER || '';
  const adminCode = env.ADMINKEY || '';
  if (!adminName || !adminCode) return '';
  return sha256Hex(adminCode + '::' + adminName);
}

async function verifyAdminPassword(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  // 检查原始 HIDDENKEY（兼容旧版 PASSWORD）
  if (env.HIDDENKEY && token === await sha256Hex(env.HIDDENKEY)) return true;

  // 检查管理员设备凭证（ADMINUSER + ADMINKEY）
  const expectedToken = await adminToken(env);
  if (expectedToken && token === expectedToken) return true;

  return false;
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

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

// ====== TMDB 缓存配置 ======

const EDGE_CACHE_TTL = {
  'discover/': 86400,
  'genre/': 86400,
  'trending/': 86400,
  'movie/': 86400,
  'tv/': 86400,
  'person/': 86400,
  'configuration': 86400,
  'search/': 3600,
  'keyword/': 86400,
  'collection/': 86400,
  'credit/': 86400,
};

function getCacheTTL(endpoint) {
  for (const [prefix, ttl] of Object.entries(EDGE_CACHE_TTL)) {
    if (endpoint.startsWith(prefix) || endpoint === prefix.replace('/', '')) {
      return ttl;
    }
  }
  return 0;
}

function buildCacheControl(cacheTTL) {
  let cc = 'public, max-age=120';
  if (cacheTTL > 0) {
    const swr = Math.floor(cacheTTL * 0.5);
    cc += `, s-maxage=${cacheTTL}, stale-while-revalidate=${swr}`;
  } else {
    cc += ', stale-while-revalidate=600';
  }
  return cc;
}

// ====== TMDB API 处理 ======

async function handleTMDBRequest(request, env, ctx) {
  const url = new URL(request.url);
  const cache = caches.default;

  if (url.pathname === '/' && !url.searchParams.has('endpoint')) {
    return serveDashboard(env);
  }

  let endpoint = url.searchParams.get('endpoint') || '';
  if (!endpoint) {
    endpoint = url.pathname.replace(/^\//, '');
  }
  if (!endpoint) {
    return tmdbJsonResponse({ success: false, error: '缺少 endpoint 参数' }, 400, 0);
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
    return tmdbJsonResponse({ success: false, error: `不允许的端点: ${endpoint}` }, 403, 0);
  }

  const cacheTTL = getCacheTTL(endpoint);

  if (cacheTTL > 0 && request.method === 'GET') {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  const tmdbApiKey = env.TMDB_API_KEY || '';
  if (!tmdbApiKey) {
    return tmdbJsonResponse({
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
      return tmdbJsonResponse({
        success: false,
        error: `TMDB API 错误: ${response.status}`,
        details: errorData
      }, response.status, 0);
    }

    const data = await response.json();
    if (endpoint === 'configuration') {
      data.image_base_url = TMDB_IMAGE_BASE;
    }

    const res = tmdbJsonResponse(data, 200, cacheTTL);

    if (cacheTTL > 0 && request.method === 'GET') {
      const cloned = res.clone();
      ctx.waitUntil(cache.put(request, cloned));
    }

    return res;
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return tmdbJsonResponse({
      success: false,
      error: isTimeout ? 'TMDB 请求超时，请稍后重试' : `TMDB 请求失败: ${error.message}`
    }, 500, 0);
  }
}

function tmdbJsonResponse(data, status, cacheTTL) {
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

function serveDashboard(env) {
  const apiKey = env.TMDB_API_KEY || '';
  const keyConfigured = !!apiKey;

  return new Response(`<!DOCTYPE html>
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
<span class="dot ok"></span>
<span class="label">Worker</span>
<span class="value">运行中</span>
</div>
<div class="status-item">
<span class="dot ${keyConfigured ? 'ok' : 'error'}"></span>
<span class="label">TMDB</span>
<span class="value">${keyConfigured ? '已配置' : 'API Key 未配置'}</span>
</div>
</div>
<a href="/" class="refresh">刷新状态</a>
<div class="footer">Powered by Cloudflare Workers</div>
</div>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
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
    if (path === '/invite/my-devices' && request.method === 'POST') {
      return handleMyDevices(request, env);
    }
    if (path === '/invite/remove-device' && request.method === 'POST') {
      return handleRemoveDevice(request, env);
    }
    if (path === '/invite/delete-code' && request.method === 'POST') {
      return handleDeleteCode(request, env);
    }
    if (path === '/invite/set-remark' && request.method === 'POST') {
      return handleSetRemark(request, env);
    }
    if (path === '/invite/rename-device' && request.method === 'POST') {
      return handleRenameDevice(request, env);
    }
    
    return jsonResponse({ ok: false, error: '未找到路由' }, 404);
  } catch (error) {
    console.error('Invite API error:', error);
    return jsonResponse({ ok: false, error: `服务器错误: ${error.message}` }, 500);
  }
}

async function handleVerify(request, env) {
  const body = await request.json();
  const { code, device_name, device_fingerprint, device_signature, device_id_lost } = body;
  // device_fingerprint 现为「设备实例 ID」（浏览器本地生成并持久化的随机 ID）；
  // device_signature 为软指纹，仅用于设备 ID 丢失（清缓存/无痕模式）时找回原有记录
  const deviceId = String(device_fingerprint || '').trim();
  const signature = String(device_signature || '').trim();
  // 仅当客户端声明「本机 ID 是新生成的（本地存储被清）」时才考虑用软指纹找回
  const idLost = device_id_lost === true;

  if (!code || !device_name || !deviceId) {
    return jsonResponse({ ok: false, error: '缺少必填参数: code, device_name, device_fingerprint' }, 400);
  }
  
  // 检查是否是管理员账号（通过环境变量配置）
  const adminName = env.ADMINUSER || '';
  const adminCode = env.ADMINKEY || '';
  if (adminName && adminCode &&
      device_name.trim().toLowerCase() === adminName.toLowerCase() &&
      code.trim().toUpperCase() === adminCode.toUpperCase()) {
    return jsonResponse({ ok: true, is_admin: true, action: 'admin', message: '管理员验证成功' });
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
  
  const withSignature = await hasSignatureColumn(env);

  const existingDevice = await env.INVITE_DB.prepare(
    'SELECT * FROM devices WHERE device_fingerprint = ?'
  ).bind(deviceId).first();
  
  if (existingDevice) {
    const renewArgs = [Date.now(), getClientIP(request), getBrowserSummary(request), device_name];
    if (withSignature) renewArgs.push(signature);
    renewArgs.push(existingDevice.id);
    await env.INVITE_DB.prepare(
      'UPDATE devices SET last_active_at = ?, ip_address = ?, browser = ?, device_name = ?'
      + (withSignature ? ', device_signature = ?' : '')
      + ' WHERE id = ?'
    ).bind(...renewArgs).run();
    
    return jsonResponse({ ok: true, action: 'renewed', message: '欢迎回来' });
  }
  
  // 设备实例 ID 未命中时，只有下面几道锁全部满足才接管旧记录（视为「同一台设备换了 ID」）：
  // ① 客户端声明本机 ID 是新生成的（清缓存/无痕）② 同一邀请码下软指纹唯一命中
  // ③ 来源 IP 与该记录一致，且该记录已闲置 RESTORE_MIN_IDLE_MS 以上
  // 少任何一条都按新设备登记——同型号设备软指纹相同，否则会把对方正在用的记录抢走
  if (withSignature && signature && idLost) {
    const clientIP = getClientIP(request);
    const signatureCount = await env.INVITE_DB.prepare(
      'SELECT COUNT(*) as count FROM devices WHERE code = ? AND device_signature = ?'
    ).bind(code, signature).first();

    if (signatureCount && signatureCount.count === 1) {
      const previousDevice = await env.INVITE_DB.prepare(
        'SELECT id, ip_address, last_active_at FROM devices WHERE code = ? AND device_signature = ?'
      ).bind(code, signature).first();

      if (previousDevice
          && previousDevice.ip_address && previousDevice.ip_address === clientIP
          && Date.now() - previousDevice.last_active_at >= RESTORE_MIN_IDLE_MS) {
        await env.INVITE_DB.prepare(
          'UPDATE devices SET device_fingerprint = ?, device_name = ?, last_active_at = ?, ip_address = ?, browser = ? WHERE id = ?'
        ).bind(deviceId, device_name, Date.now(), getClientIP(request), getBrowserSummary(request), previousDevice.id).run();

        return jsonResponse({ ok: true, action: 'restored', message: '欢迎回来' });
      }
    }
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
  const insertArgs = [code, device_name, deviceId, getBrowserSummary(request), getClientIP(request), now, now];
  if (withSignature) insertArgs.push(signature);
  await env.INVITE_DB.prepare(
    'INSERT INTO devices (code, device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at'
    + (withSignature ? ', device_signature' : '')
    + ') VALUES (?, ?, ?, ?, ?, ?, ?' + (withSignature ? ', ?' : '') + ')'
  ).bind(...insertArgs).run();
  
  const action = deviceCount.count >= invite.max_devices ? 'evicted' : 'registered';
  return jsonResponse({ ok: true, action, message: '验证成功' });
}

async function handleHeartbeat(request, env) {
  const body = await request.json();
  const { device_fingerprint } = body;
  
  if (!device_fingerprint) {
    return jsonResponse({ ok: false, error: '缺少 device_fingerprint' }, 400);
  }
  
  // 以「记录是否存在」判定本机是否在册，而不是读 UPDATE 的影响行数：
  // D1 的 run() 把 changes 放在 meta 里（顶层没有该字段），
  // 直读 result.changes 恒为 undefined，会让 updated 永远为 false，
  // 从而被前端当成「本机已被移除」，把所有设备踢下线
  const device = await env.INVITE_DB.prepare(
    'SELECT id FROM devices WHERE device_fingerprint = ?'
  ).bind(device_fingerprint).first();
  
  if (!device) {
    return jsonResponse({ ok: true, updated: false });
  }
  
  await env.INVITE_DB.prepare(
    'UPDATE devices SET last_active_at = ? WHERE device_fingerprint = ?'
  ).bind(Date.now(), device_fingerprint).run();
  
  return jsonResponse({ ok: true, updated: true });
}

async function handleGenerate(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const body = await request.json().catch(() => ({}));
  const remark = (body.remark || '').trim();
  
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
    'INSERT INTO invitation_codes (code, created_at, remark) VALUES (?, ?, ?)'
  ).bind(code, Date.now(), remark).run();
  
  return jsonResponse({ ok: true, code, remark, created_at: Date.now() });
}

async function handleList(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const codes = await env.INVITE_DB.prepare(
    `SELECT ic.* FROM invitation_codes ic
     LEFT JOIN (SELECT code, MAX(last_active_at) as max_active FROM devices GROUP BY code) d ON ic.code = d.code
     ORDER BY COALESCE(d.max_active, ic.created_at) DESC`
  ).all();
  
  const result = await Promise.all(codes.results.map(async (invite) => {
    const devices = await env.INVITE_DB.prepare(
      'SELECT device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at FROM devices WHERE code = ? ORDER BY last_active_at DESC'
    ).bind(invite.code).all();
    
    return {
      code: invite.code,
      created_at: invite.created_at,
      is_active: !!invite.is_active,
      max_devices: invite.max_devices,
      remark: invite.remark || '',
      device_count: devices.results.length,
      devices: devices.results
    };
  }));
  
  return jsonResponse({ ok: true, codes: result });
}

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
  
  return jsonResponse({ ok: true, updated: affectedRows(result) > 0 });
}

async function handleStats(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const totalCodes = await env.INVITE_DB.prepare('SELECT COUNT(*) as count FROM invitation_codes').first();
  const activeCodes = await env.INVITE_DB.prepare('SELECT COUNT(*) as count FROM invitation_codes WHERE is_active = 1').first();
  const totalDevices = await env.INVITE_DB.prepare('SELECT COUNT(*) as count FROM devices').first();
  const recentActiveDevices = await env.INVITE_DB.prepare(
    'SELECT COUNT(*) as count FROM devices WHERE last_active_at > ?'
  ).bind(Date.now() - 86400000).first();
  
  return jsonResponse({
    ok: true,
    total_codes: totalCodes.count,
    active_codes: activeCodes.count,
    total_devices: totalDevices.count,
    recent_active_devices: recentActiveDevices.count
  });
}

// POST /invite/my-devices - 普通用户查询自己的设备
async function handleMyDevices(request, env) {
  const body = await request.json();
  const { code, device_fingerprint } = body;
  
  if (!code || !device_fingerprint) {
    return jsonResponse({ ok: false, error: '缺少参数' }, 400);
  }
  
  // 验证该 fingerprint 确实属于此邀请码
  const device = await env.INVITE_DB.prepare(
    'SELECT id FROM devices WHERE code = ? AND device_fingerprint = ?'
  ).bind(code, device_fingerprint).first();
  
  if (!device) {
    return jsonResponse({ ok: false, error: '验证失败' }, 403);
  }
  
  // 查询邀请码信息和设备列表
  const invite = await env.INVITE_DB.prepare(
    'SELECT * FROM invitation_codes WHERE code = ?'
  ).bind(code).first();
  
  const devices = await env.INVITE_DB.prepare(
    'SELECT device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at FROM devices WHERE code = ? ORDER BY last_active_at DESC'
  ).bind(code).all();
  
  return jsonResponse({
    ok: true,
    code: invite.code,
    created_at: invite.created_at,
    is_active: !!invite.is_active,
    max_devices: invite.max_devices,
    device_count: devices.results.length,
    devices: devices.results
  });
}

// POST /invite/remove-device - 删除设备（管理员或同码用户可操作）
async function handleRemoveDevice(request, env) {
  const body = await request.json();
  const { code, device_fingerprint, target_fingerprint } = body;
  
  if (!code || !target_fingerprint) {
    return jsonResponse({ ok: false, error: '缺少参数' }, 400);
  }
  
  // 鉴权：管理员（Bearer token）或同邀请码下的用户
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    const device = await env.INVITE_DB.prepare(
      'SELECT id FROM devices WHERE code = ? AND device_fingerprint = ?'
    ).bind(code, device_fingerprint).first();
    if (!device) {
      return jsonResponse({ ok: false, error: '无权限' }, 403);
    }
  }
  
  const result = await env.INVITE_DB.prepare(
    'DELETE FROM devices WHERE code = ? AND device_fingerprint = ?'
  ).bind(code, target_fingerprint).run();
  
  return jsonResponse({ ok: true, removed: affectedRows(result) > 0 });
}

// POST /invite/set-remark - 设置邀请码备注（管理员）
async function handleSetRemark(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
  }
  
  const body = await request.json();
  const { code, remark } = body;
  
  if (!code) {
    return jsonResponse({ ok: false, error: '缺少 code' }, 400);
  }
  
  try {
    await env.INVITE_DB.prepare(
      'UPDATE invitation_codes SET remark = ? WHERE code = ?'
    ).bind(remark || '', code).run();
  } catch (err) {
    // D1 表可能缺少 remark 列，自动添加
    if (err.message && err.message.includes('no such column')) {
      await env.INVITE_DB.prepare(
        'ALTER TABLE invitation_codes ADD COLUMN remark TEXT DEFAULT \'\''
      ).run();
      await env.INVITE_DB.prepare(
        'UPDATE invitation_codes SET remark = ? WHERE code = ?'
      ).bind(remark || '', code).run();
    } else {
      throw err;
    }
  }
  
  return jsonResponse({ ok: true });
}

// POST /invite/rename-device - 重命名设备（同码用户可操作，仅限当前设备）
async function handleRenameDevice(request, env) {
  const body = await request.json();
  const { code, device_fingerprint, new_name } = body;
  
  if (!code || !device_fingerprint || !new_name) {
    return jsonResponse({ ok: false, error: '缺少参数' }, 400);
  }
  
  // 仅允许操作同邀请码下的本设备
  const device = await env.INVITE_DB.prepare(
    'SELECT id FROM devices WHERE code = ? AND device_fingerprint = ?'
  ).bind(code, device_fingerprint).first();
  
  if (!device) {
    return jsonResponse({ ok: false, error: '无权限' }, 403);
  }
  
  // 限制设备名长度
  const name = new_name.trim().slice(0, 30);
  if (!name) {
    return jsonResponse({ ok: false, error: '设备名不能为空' }, 400);
  }
  
  await env.INVITE_DB.prepare(
    'UPDATE devices SET device_name = ? WHERE code = ? AND device_fingerprint = ?'
  ).bind(name, code, device_fingerprint).run();
  
  return jsonResponse({ ok: true });
}

// POST /invite/delete-code - 删除邀请码（管理员专属）
async function handleDeleteCode(request, env) {
  const isAdmin = await verifyAdminPassword(request, env);
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: '无权限' }, 403);
  }

  const body = await request.json();
  const { code } = body;

  if (!code) {
    return jsonResponse({ ok: false, error: '缺少参数' }, 400);
  }

  try {
    // 先删除关联设备，再删除邀请码
    await env.INVITE_DB.prepare('DELETE FROM devices WHERE code = ?').bind(code).run();
    const result = await env.INVITE_DB.prepare('DELETE FROM invitation_codes WHERE code = ?').bind(code).run();
    return jsonResponse({ ok: true, deleted: affectedRows(result) > 0 });
  } catch (error) {
    console.error('删除邀请码失败:', error);
    return jsonResponse({ ok: false, error: '服务器错误' }, 500);
  }
}

// ====== 视频源配置 API（api_sites 表）======
//
// 把原先写死在 js/core/config.js 的内置采集源搬到 D1，由 /admin 面板维护，
// 前端启动时拉取后合并（内置源仍是永久兜底，见 js/core/config.js 的 extendAPISites）。
//
// 鉴权复用邀请码那套 verifyAdminPassword（Bearer = HIDDENKEY 或 ADMINKEY::ADMINUSER 的 SHA-256）。
// 面板页面是在浏览器地址栏打开的，带不了 Authorization 头，因此额外允许 ?key=<同一个 token>。

// 公开接口的边缘缓存时长（秒）。面板保存后会主动清除，这里主要是挡住刷新风暴
const API_SITES_CACHE_TTL = 60;
// source_key 限定小写字母/数字/下划线。前端大量用 startsWith('custom_') 区分自定义源，
// 所以还要显式拒绝 custom 前缀，避免远端源被误当成用户自定义源
const API_SITE_KEY_PATTERN = /^[a-z0-9][a-z0-9_]{0,31}$/;
const API_SITE_MAX_URL_LEN = 512;
const API_SITE_MAX_NAME_LEN = 40;

// 内网/元数据地址判断：面板本质是「任意 URL 注入点」，而前端走的是没有域名白名单的 /proxy/，
// 不挡住这里就等于给自己开了一个 SSRF 入口
function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!h) return true;
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = /^172\.(\d{1,3})\./.exec(h);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) return true;
  }
  if (/\.(local|internal|localdomain)$/.test(h)) return true;
  return false;
}

/** 校验并规范化 API / detail 地址；返回 { value } 或 { error } */
function sanitizeApiSiteUrl(raw, fieldLabel) {
  const url = String(raw == null ? '' : raw).trim();
  if (!url) return { error: `${fieldLabel}不能为空` };
  if (url.length > API_SITE_MAX_URL_LEN) {
    return { error: `${fieldLabel}过长（上限 ${API_SITE_MAX_URL_LEN} 字符）` };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: `${fieldLabel}格式不正确，需以 http:// 或 https:// 开头` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: `${fieldLabel}只允许 http/https 协议` };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { error: `${fieldLabel}不允许指向内网地址` };
  }
  // 与前端自定义源的规范化保持一致：去掉末尾斜杠
  return { value: url.replace(/\/+$/, '') };
}

function generateApiSiteKey() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return 'remote_' + Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 数据库行 → 前端 API_SITES 的条目结构（detail/hidden 为空时不输出，与内置源写法一致） */
function apiSiteRowToEntry(row) {
  const entry = { api: row.api, name: row.name };
  if (row.detail) entry.detail = row.detail;
  if (row.hidden) entry.hidden = true;
  return entry;
}

function apiSiteRowsToMap(rows) {
  const sites = {};
  for (const row of rows || []) {
    sites[row.source_key] = apiSiteRowToEntry(row);
  }
  return sites;
}

/** 配置版本号：前端拿它比对，相同就跳过重建设置页复选框列表（避免每次刷新都闪一下） */
function buildApiSitesVersion(rows) {
  let max = 0;
  for (const row of rows || []) {
    const t = Number(row.updated_at) || 0;
    if (t > max) max = t;
  }
  return `${max}-${(rows || []).length}`;
}

/** 管理员鉴权：Authorization 头优先，其次 ?key=（面板页面用），两者都是同一个 token */
async function verifyAdminRequest(request, env, url) {
  if (await verifyAdminPassword(request, env)) return true;
  const key = url.searchParams.get('key') || '';
  if (!key) return false;
  return verifyAdminPassword(
    new Request(request.url, { headers: { Authorization: `Bearer ${key}` } }),
    env
  );
}

function apiSitesCacheKey(url, hidden) {
  const path = hidden ? '/api-sites/hidden' : '/api-sites';
  return new Request(new URL(path, url.origin).toString(), { method: 'GET' });
}

/** 写操作后清除公开接口的边缘缓存，否则最长 60s 内用户仍会拿到旧列表 */
async function purgeApiSitesCache(url) {
  try {
    await Promise.all([
      caches.default.delete(apiSitesCacheKey(url, false)),
      caches.default.delete(apiSitesCacheKey(url, true)),
    ]);
  } catch (e) {
    console.warn('[api-sites] 清除边缘缓存失败:', e && e.message);
  }
}

/** 只读接口：普通源走公开边缘缓存；私密源必须已通过管理员鉴权，且不进公共缓存 */
async function serveApiSites(env, ctx, url, hidden) {
  const cacheKey = apiSitesCacheKey(url, hidden);

  if (!hidden) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  let rows;
  try {
    const result = await env.INVITE_DB.prepare(
      'SELECT source_key, name, api, detail, hidden, updated_at FROM api_sites'
      + ' WHERE enabled = 1 AND hidden = ? ORDER BY sort_order ASC, id ASC'
    ).bind(hidden ? 1 : 0).all();
    rows = (result && result.results) || [];
  } catch (error) {
    // 表还没建（未执行 004 迁移）时不让前端整个挂掉：返回空列表，前端会退回内置源
    console.error('[api-sites] 读取失败，请确认已执行 migrations/004_add_api_sites.sql:', error && error.message);
    return jsonResponse({ ok: false, error: '数据源配置暂不可用', version: '', sites: {} }, 200);
  }

  const res = jsonResponse({
    ok: true,
    version: buildApiSitesVersion(rows),
    sites: apiSiteRowsToMap(rows),
  }, 200);

  if (hidden) {
    // 私密源不进边缘公共缓存，否则会通过公共缓存泄露给未鉴权请求
    res.headers.set('Cache-Control', 'no-store');
  } else {
    res.headers.set('Cache-Control', `public, max-age=${API_SITES_CACHE_TTL}, stale-while-revalidate=300`);
    if (ctx && ctx.waitUntil) ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  }
  return res;
}

async function handleApiSiteList(env) {
  try {
    const result = await env.INVITE_DB.prepare(
      'SELECT id, source_key, name, api, detail, hidden, enabled, sort_order, updated_at'
      + ' FROM api_sites ORDER BY sort_order ASC, id ASC'
    ).all();
    const sites = ((result && result.results) || []).map(row => ({
      id: row.id,
      key: row.source_key,
      name: row.name,
      api: row.api,
      detail: row.detail || '',
      hidden: !!row.hidden,
      enabled: !!row.enabled,
      updated_at: row.updated_at || 0,
    }));
    return jsonResponse({ ok: true, sites }, 200);
  } catch (error) {
    console.error('[api-sites] 列表读取失败:', error && error.message);
    return jsonResponse({ ok: false, error: '读取失败：请确认已执行 migrations/004_add_api_sites.sql' }, 500);
  }
}

async function handleApiSiteSave(request, env, url) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonResponse({ ok: false, error: '请求体不是合法 JSON' }, 400);
  }

  const name = String(body.name || '').trim();
  if (!name) return jsonResponse({ ok: false, error: '名称不能为空' }, 400);
  if (name.length > API_SITE_MAX_NAME_LEN) {
    return jsonResponse({ ok: false, error: `名称过长（上限 ${API_SITE_MAX_NAME_LEN} 字符）` }, 400);
  }

  const apiCheck = sanitizeApiSiteUrl(body.api, 'API 地址');
  if (apiCheck.error) return jsonResponse({ ok: false, error: apiCheck.error }, 400);

  let detail = '';
  if (String(body.detail || '').trim()) {
    const detailCheck = sanitizeApiSiteUrl(body.detail, 'detail 地址');
    if (detailCheck.error) return jsonResponse({ ok: false, error: detailCheck.error }, 400);
    detail = detailCheck.value;
  }

  const hidden = body.hidden ? 1 : 0;
  const now = Date.now();
  const id = parseInt(body.id, 10) || 0;

  try {
    if (id) {
      // 更新：source_key 不允许改，用户 localStorage 里的勾选记录以它为键
      const existing = await env.INVITE_DB.prepare(
        'SELECT source_key FROM api_sites WHERE id = ?'
      ).bind(id).first();
      if (!existing) return jsonResponse({ ok: false, error: '数据源不存在' }, 404);

      await env.INVITE_DB.prepare(
        'UPDATE api_sites SET name = ?, api = ?, detail = ?, hidden = ?, updated_at = ? WHERE id = ?'
      ).bind(name, apiCheck.value, detail, hidden, now, id).run();

      await purgeApiSitesCache(url);
      return jsonResponse({ ok: true, action: 'updated', key: existing.source_key, id }, 200);
    }

    let key = String(body.key || '').trim().toLowerCase();
    if (key) {
      if (key.startsWith('custom')) {
        return jsonResponse({ ok: false, error: 'key 不能以 custom 开头（该前缀保留给用户自定义源）' }, 400);
      }
      if (!API_SITE_KEY_PATTERN.test(key)) {
        return jsonResponse({ ok: false, error: 'key 只能是 1-32 位小写字母/数字/下划线，且以字母或数字开头' }, 400);
      }
    } else {
      key = generateApiSiteKey();
    }

    const dup = await env.INVITE_DB.prepare(
      'SELECT id FROM api_sites WHERE source_key = ?'
    ).bind(key).first();
    if (dup) {
      return jsonResponse({ ok: false, error: `key「${key}」已存在；若要修改请编辑那一条` }, 409);
    }

    const maxRow = await env.INVITE_DB.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM api_sites'
    ).first();
    const sortOrder = ((maxRow && maxRow.m) || 0) + 1;

    await env.INVITE_DB.prepare(
      'INSERT INTO api_sites (source_key, name, api, detail, hidden, enabled, sort_order, created_at, updated_at)'
      + ' VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)'
    ).bind(key, name, apiCheck.value, detail, hidden, sortOrder, now, now).run();

    await purgeApiSitesCache(url);
    return jsonResponse({ ok: true, action: 'created', key }, 200);
  } catch (error) {
    console.error('[api-sites] 保存失败:', error && error.message);
    return jsonResponse({ ok: false, error: '保存失败：请确认已执行 migrations/004_add_api_sites.sql' }, 500);
  }
}

async function handleApiSiteToggle(request, env, url) {
  const body = await request.json().catch(() => null);
  const id = body ? (parseInt(body.id, 10) || 0) : 0;
  if (!id) return jsonResponse({ ok: false, error: '缺少 id' }, 400);

  const enabled = body.enabled ? 1 : 0;
  try {
    const result = await env.INVITE_DB.prepare(
      'UPDATE api_sites SET enabled = ?, updated_at = ? WHERE id = ?'
    ).bind(enabled, Date.now(), id).run();
    if (affectedRows(result) === 0) {
      return jsonResponse({ ok: false, error: '数据源不存在' }, 404);
    }
    await purgeApiSitesCache(url);
    return jsonResponse({ ok: true, enabled: !!enabled }, 200);
  } catch (error) {
    console.error('[api-sites] 启停失败:', error && error.message);
    return jsonResponse({ ok: false, error: '操作失败' }, 500);
  }
}

async function handleApiSiteDelete(request, env, url) {
  const body = await request.json().catch(() => null);
  const id = body ? (parseInt(body.id, 10) || 0) : 0;
  if (!id) return jsonResponse({ ok: false, error: '缺少 id' }, 400);

  try {
    const row = await env.INVITE_DB.prepare(
      'SELECT source_key FROM api_sites WHERE id = ?'
    ).bind(id).first();
    if (!row) return jsonResponse({ ok: false, error: '数据源不存在' }, 404);

    await env.INVITE_DB.prepare('DELETE FROM api_sites WHERE id = ?').bind(id).run();
    await purgeApiSitesCache(url);
    return jsonResponse({ ok: true, key: row.source_key }, 200);
  } catch (error) {
    console.error('[api-sites] 删除失败:', error && error.message);
    return jsonResponse({ ok: false, error: '删除失败' }, 500);
  }
}

// ====== 管理员登录与状态（/admin/login、/admin/status）======

// 登录失败节流：同一 IP 连续失败达到上限后锁定一段时间。
// 注意它只活在 worker isolate 的内存里 —— isolate 重启或多实例并存时计数会重置/分散，
// 因此挡的是自动化暴力尝试，不是严格防线。
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 10 * 60 * 1000;
const _loginFailures = new Map();

function loginThrottleState(ip) {
  const rec = _loginFailures.get(ip);
  if (!rec) return { locked: false, remainingMs: 0 };
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: rec.lockedUntil - Date.now() };
  }
  return { locked: false, remainingMs: 0 };
}

function recordLoginFailure(ip) {
  const rec = _loginFailures.get(ip) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    rec.count = 0;
  }
  _loginFailures.set(ip, rec);
}

/**
 * POST /admin/login —— body: { username, password }
 * 账号比对 ADMINUSER、密码比对 ADMINKEY，比较方式与邀请码管理员登录（handleVerify）保持一致：
 * 账号不分大小写，密码同样不分大小写。成功后返回可长期使用的 Bearer token。
 */
async function handleAdminLogin(request, env) {
  const ip = getClientIP(request);

  const throttle = loginThrottleState(ip);
  if (throttle.locked) {
    const mins = Math.max(1, Math.ceil(throttle.remainingMs / 60000));
    return jsonResponse({ ok: false, error: `尝试次数过多，请 ${mins} 分钟后再试` }, 429);
  }

  const body = await request.json().catch(() => null);
  const username = String((body && body.username) || '').trim();
  const password = String((body && body.password) || '').trim();
  if (!username || !password) {
    return jsonResponse({ ok: false, error: '请输入账号和密码' }, 400);
  }

  const adminName = env.ADMINUSER || '';
  const adminCode = env.ADMINKEY || '';
  if (!adminName || !adminCode) {
    // 不暴露「服务端没配」这个信息，统一按凭证错误回复
    console.warn('[admin] 未配置 ADMINUSER / ADMINKEY，登录不可用');
    return jsonResponse({ ok: false, error: '账号或密码错误' }, 401);
  }

  const nameOk = username.toLowerCase() === adminName.toLowerCase();
  const codeOk = password.toUpperCase() === adminCode.toUpperCase();
  if (!nameOk || !codeOk) {
    recordLoginFailure(ip);
    // 不区分「账号错」与「密码错」，避免被拿来枚举账号
    return jsonResponse({ ok: false, error: '账号或密码错误' }, 401);
  }

  _loginFailures.delete(ip);
  return jsonResponse({ ok: true, token: await adminToken(env), username: adminName }, 200);
}

/** GET /admin/status —— 供主面板展示总体状态 */
async function handleAdminStatus(env) {
  let d1Ready = true;
  let total = 0;
  let enabled = 0;
  let hidden = 0;
  try {
    const row = await env.INVITE_DB.prepare(
      'SELECT COUNT(*) AS total,'
      + ' SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,'
      + ' SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) AS hidden'
      + ' FROM api_sites'
    ).first();
    total = Number(row && row.total) || 0;
    // 空表时 SUM 返回 NULL，统一兜成 0
    enabled = Number(row && row.enabled) || 0;
    hidden = Number(row && row.hidden) || 0;
  } catch (error) {
    d1Ready = false;
    console.warn('[admin] api_sites 统计失败，请确认已执行 migrations/004_add_api_sites.sql:', error && error.message);
  }

  return jsonResponse({
    ok: true,
    time: Date.now(),
    tmdb_configured: !!env.TMDB_API_KEY,
    admin_configured: !!(env.ADMINUSER && env.ADMINKEY),
    hidden_key_configured: !!env.HIDDENKEY,
    d1_ready: d1Ready,
    sites_total: total,
    sites_enabled: enabled,
    sites_hidden: hidden,
  }, 200);
}

// ====== 管理面板（GET /admin）======
// UI 沿用 TMDB 状态面板（serveDashboard）的视觉语言：同色板、同圆角、同字号层级。
// 页面本身不做服务端鉴权（否则没法展示登录框），所有数据接口仍然要求 Bearer token。

/** 管理面板：登录视图 + 主面板（运行状态 + 数据源管理） */
function apiSitesAdminPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LeLeTV 管理面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0f;color:#e0e0e0;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;min-height:100vh;padding:36px 16px}
.container{max-width:720px;margin:0 auto;padding:32px 30px;background:#16161a;border:1px solid #2a2a30;border-radius:12px}
h1{font-size:16px;font-weight:500;color:#888;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase}
.sub{font-size:12px;color:#555;margin-bottom:26px}
h2{font-size:12px;font-weight:500;color:#777;letter-spacing:1px;text-transform:uppercase;margin:0 0 14px}
.block{margin-bottom:28px}
.field{margin-bottom:14px}
.field>label{display:block;font-size:12px;color:#666;margin-bottom:6px}
input[type=text]{width:100%;background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px;color:#e0e0e0;padding:10px 12px;font-size:13px;font-family:inherit;transition:border-color .2s}
input[type=text]:focus{outline:none;border-color:#ec4899}
input[type=text]:disabled{color:#666;cursor:not-allowed}
.grid{display:flex;gap:12px;flex-wrap:wrap}
.grid>.field{flex:1;min-width:220px}
.check{display:flex;align-items:center;gap:8px;font-size:13px;color:#aaa;cursor:pointer}
.check input{accent-color:#ec4899}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
button{background:#1e1e24;border:1px solid #2a2a30;border-radius:8px;color:#aaa;font-size:12px;padding:8px 16px;cursor:pointer;font-family:inherit;transition:all .2s}
button:hover{background:#2a2a30;color:#e0e0e0}
button:disabled{opacity:.5;cursor:not-allowed}
button.primary{background:#ec4899;border-color:#ec4899;color:#fff}
button.primary:hover{background:#db2777}
button.danger:hover{background:#2a1a1c;border-color:#7f1d1d;color:#fca5a5}
.item{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#1a1a1f;border-radius:8px;margin-bottom:8px}
.item .info{flex:1;min-width:0}
.item .nm{font-size:14px;color:#e0e0e0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.item .meta{font-size:11px;color:#555;margin-top:4px;word-break:break-all}
.item .ops{display:flex;gap:6px;flex-shrink:0}
.tag{font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #2a2a30;color:#777;white-space:nowrap}
.tag.on{color:#22c55e;border-color:#14532d}
.tag.off{color:#6b7280}
.tag.priv{color:#ec4899;border-color:#831843}
.msg{font-size:12px;min-height:18px;margin-top:12px}
.msg.err{color:#f87171}
.msg.ok{color:#4ade80}
.empty{font-size:13px;color:#555;text-align:center;padding:22px 0}
.hidden{display:none}
h2{display:flex;align-items:center;gap:10px}
button.mini{padding:4px 10px;font-size:11px;margin-left:auto}
.stat-grid{display:flex;flex-wrap:wrap;gap:10px}
.stat{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#1a1a1f;border-radius:8px;font-size:14px;flex:1;min-width:210px}
.stat .k{color:#aaa}
.stat .v{color:#e0e0e0;margin-left:auto}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.dot.ok{background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.4)}
.dot.error{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,.4)}
.dot.unknown{background:#6b7280;box-shadow:0 0 8px rgba(107,114,128,.3)}
input[type=password]{width:100%;background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px;color:#e0e0e0;padding:10px 12px;font-size:13px;font-family:inherit;transition:border-color .2s}
input[type=password]:focus{outline:none;border-color:#ec4899}
.footer{margin-top:22px;text-align:center;font-size:11px;color:#444}
</style>
</head>
<body>
<div class="container">
<h1>LeLeTV 管理面板</h1>
<div class="sub">TMDB 代理状态 · 视频源配置（D1 · api_sites）</div>

<!-- 登录视图：数据接口全部要求 Bearer token，页面只负责收集账号密码 -->
<div id="loginView">
<div class="block">
<h2>管理员登录</h2>
<div class="field">
<label>账号</label>
<input type="text" id="loginUser" autocomplete="username" placeholder="ADMINUSER">
</div>
<div class="field">
<label>密码</label>
<input type="password" id="loginPass" autocomplete="current-password" placeholder="ADMINKEY">
</div>
<div class="actions">
<button class="primary" id="loginBtn">登录</button>
</div>
<div class="msg" id="loginMsg"></div>
</div>
</div>

<!-- 主面板 -->
<div id="mainView" class="hidden">
<div class="block">
<h2>运行状态<button id="logoutBtn" class="mini">退出登录</button></h2>
<div class="stat-grid" id="statGrid"></div>
</div>

<div class="block">
<h2 id="formTitle">新增数据源</h2>
<div class="grid">
<div class="field">
<label>显示名称</label>
<input type="text" id="fName" maxlength="40" placeholder="例如：非凡资源">
</div>
<div class="field">
<label>源标识 key（留空自动生成，创建后不可改）</label>
<input type="text" id="fKey" maxlength="32" placeholder="remote_xxxxxxxx 或与内置源同名以覆盖">
</div>
</div>
<div class="field">
<label>API 地址</label>
<input type="text" id="fApi" maxlength="512" placeholder="https://api.example.com/api.php/provide/vod/">
</div>
<div class="field">
<label>detail 地址（可选）</label>
<input type="text" id="fDetail" maxlength="512" placeholder="留空表示与 API 地址相同">
</div>
<label class="check"><input type="checkbox" id="fHidden"> 私密源（18+，仅隐藏内容模式可见，不通过公开接口下发）</label>
<div class="actions">
<button id="fReset">清空表单</button>
<button class="primary" id="fSubmit">保存</button>
</div>
<div class="msg" id="msg"></div>
</div>

<div class="block">
<h2>已配置的数据源</h2>
<div id="list"><div class="empty">加载中…</div></div>
</div>
</div>

<div class="footer">Powered by Cloudflare Workers · D1</div>
</div>
<script>
(function () {
  'use strict';
  var STORE_KEY = 'leletv_admin_panel_token';

  var loginView = document.getElementById('loginView');
  var mainView = document.getElementById('mainView');
  var loginUser = document.getElementById('loginUser');
  var loginPass = document.getElementById('loginPass');
  var loginBtn = document.getElementById('loginBtn');
  var loginMsg = document.getElementById('loginMsg');
  var logoutBtn = document.getElementById('logoutBtn');
  var statGrid = document.getElementById('statGrid');
  var listEl = document.getElementById('list');
  var msgEl = document.getElementById('msg');
  var fId = '';
  var fName = document.getElementById('fName');
  var fKey = document.getElementById('fKey');
  var fApi = document.getElementById('fApi');
  var fDetail = document.getElementById('fDetail');
  var fHidden = document.getElementById('fHidden');
  var formTitle = document.getElementById('formTitle');
  var submitBtn = document.getElementById('fSubmit');
  var resetBtn = document.getElementById('fReset');
  var allSites = [];
  var token = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function say(el, text, cls) {
    el.textContent = text || '';
    el.className = 'msg ' + (cls || '');
  }

  function readStored() {
    try { return localStorage.getItem(STORE_KEY) || ''; } catch (e) { return ''; }
  }

  function writeStored(value) {
    try {
      if (value) localStorage.setItem(STORE_KEY, value);
      else localStorage.removeItem(STORE_KEY);
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function call(path, body) {
    var opt = { method: body ? 'POST' : 'GET', headers: { 'Authorization': 'Bearer ' + token } };
    if (body) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; })
        .then(function (data) { data.status = r.status; return data; });
    });
  }

  function doLogin(username, password) {
    return fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
    });
  }

  function showLogin(message, isError) {
    mainView.className = 'hidden';
    loginView.className = '';
    loginBtn.disabled = false;
    say(loginMsg, message || '', isError ? 'err' : '');
  }

  function showMain() {
    loginView.className = 'hidden';
    mainView.className = '';
    loadStatus();
    loadSites();
  }

  function loadStatus() {
    call('/admin/status').then(function (res) {
      if (!res.ok) {
        statGrid.innerHTML = '<div class="stat"><span class="dot error"></span><span class="k">状态</span><span class="v">读取失败</span></div>';
        return;
      }
      var rows = [
        ['ok', 'Worker', '运行中'],
        [res.tmdb_configured ? 'ok' : 'error', 'TMDB', res.tmdb_configured ? 'API Key 已配置' : 'API Key 未配置'],
        [res.d1_ready ? 'ok' : 'error', '数据源表', res.d1_ready ? '已就绪' : '未建表（需执行迁移 004）'],
        ['unknown', '数据源', res.sites_enabled + ' 启用 / ' + res.sites_total + ' 总数'],
        ['unknown', '其中私密源', String(res.sites_hidden)]
      ];
      statGrid.innerHTML = rows.map(function (r) {
        return '<div class="stat"><span class="dot ' + r[0] + '"></span>'
          + '<span class="k">' + esc(r[1]) + '</span>'
          + '<span class="v">' + esc(r[2]) + '</span></div>';
      }).join('');
    }).catch(function () {
      statGrid.innerHTML = '<div class="stat"><span class="dot error"></span><span class="k">状态</span><span class="v">网络错误</span></div>';
    });
  }

  function resetForm() {
    fId = '';
    fName.value = '';
    fKey.value = '';
    fApi.value = '';
    fDetail.value = '';
    fHidden.checked = false;
    fKey.disabled = false;
    formTitle.textContent = '新增数据源';
  }

  function render(sites) {
    allSites = sites;
    if (!sites.length) {
      listEl.innerHTML = '<div class="empty">还没有配置任何数据源</div>';
      return;
    }
    listEl.innerHTML = sites.map(function (s) {
      var tags = '<span class="tag ' + (s.enabled ? 'on' : 'off') + '">' + (s.enabled ? '启用' : '停用') + '</span>';
      if (s.hidden) tags += '<span class="tag priv">私密</span>';
      return '<div class="item">' +
        '<div class="info">' +
          '<div class="nm">' + esc(s.name) + tags + '</div>' +
          '<div class="meta">' + esc(s.key) + '</div>' +
          '<div class="meta">' + esc(s.api) + '</div>' +
          (s.detail ? '<div class="meta">detail: ' + esc(s.detail) + '</div>' : '') +
        '</div>' +
        '<div class="ops">' +
          '<button data-act="edit" data-id="' + s.id + '">编辑</button>' +
          '<button data-act="toggle" data-id="' + s.id + '" data-on="' + (s.enabled ? '1' : '0') + '">' + (s.enabled ? '停用' : '启用') + '</button>' +
          '<button class="danger" data-act="del" data-id="' + s.id + '" data-name="' + esc(s.name) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function loadSites() {
    call('/admin/api-sites/list').then(function (res) {
      if (!res.ok) {
        listEl.innerHTML = '<div class="empty">加载失败</div>';
        say(msgEl, res.error || '加载失败', 'err');
        return;
      }
      render(res.sites || []);
    }).catch(function () {
      listEl.innerHTML = '<div class="empty">网络错误</div>';
    });
  }

  loginBtn.addEventListener('click', function () {
    var u = loginUser.value.trim();
    var p = loginPass.value.trim();
    if (!u || !p) {
      say(loginMsg, '请输入账号和密码', 'err');
      return;
    }
    loginBtn.disabled = true;
    say(loginMsg, '登录中…');
    doLogin(u, p).then(function (res) {
      loginBtn.disabled = false;
      if (!res.ok || !res.token) {
        say(loginMsg, res.error || '登录失败', 'err');
        return;
      }
      token = res.token;
      writeStored(token);
      loginPass.value = '';
      say(loginMsg, '');
      showMain();
    }).catch(function () {
      loginBtn.disabled = false;
      say(loginMsg, '网络错误，请稍后重试', 'err');
    });
  });

  loginPass.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loginBtn.click();
  });
  loginUser.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loginPass.focus();
  });

  logoutBtn.addEventListener('click', function () {
    token = '';
    writeStored('');
    allSites = [];
    listEl.innerHTML = '';
    statGrid.innerHTML = '';
    showLogin('已退出登录', false);
  });

  resetBtn.addEventListener('click', function () {
    resetForm();
    say(msgEl, '');
  });

  submitBtn.addEventListener('click', function () {
    var payload = {
      id: fId ? parseInt(fId, 10) : 0,
      name: fName.value.trim(),
      api: fApi.value.trim(),
      detail: fDetail.value.trim(),
      hidden: fHidden.checked,
      key: fKey.value.trim().toLowerCase()
    };
    if (!payload.name || !payload.api) {
      say(msgEl, '名称和 API 地址不能为空', 'err');
      return;
    }
    say(msgEl, '保存中…');
    call('/admin/api-sites/save', payload).then(function (res) {
      if (!res.ok) {
        say(msgEl, res.error || '保存失败', 'err');
        return;
      }
      say(msgEl, '已保存：' + payload.name, 'ok');
      resetForm();
      loadSites();
      loadStatus();
    }).catch(function () {
      say(msgEl, '网络错误', 'err');
    });
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = parseInt(btn.getAttribute('data-id'), 10);

    if (act === 'edit') {
      var found = allSites.filter(function (s) { return s.id === id; })[0];
      if (!found) return;
      fId = String(found.id);
      fName.value = found.name;
      fKey.value = found.key;
      fKey.disabled = true;
      fApi.value = found.api;
      fDetail.value = found.detail || '';
      fHidden.checked = !!found.hidden;
      formTitle.textContent = '编辑数据源：' + found.name;
      say(msgEl, 'key 创建后不可修改；要换 key 请新增一条并删除旧条');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (act === 'toggle') {
      var on = btn.getAttribute('data-on') === '1';
      btn.disabled = true;
      call('/admin/api-sites/toggle', { id: id, enabled: !on }).then(function (res) {
        say(msgEl, res.ok ? (on ? '已停用，前端下次拉取后不再下发' : '已启用') : (res.error || '操作失败'), res.ok ? 'ok' : 'err');
        loadSites();
        loadStatus();
      }).catch(function () {
        btn.disabled = false;
        say(msgEl, '网络错误', 'err');
      });
      return;
    }

    if (act === 'del') {
      if (!window.confirm('确定删除数据源「' + btn.getAttribute('data-name') + '」？删除后无法恢复。')) return;
      btn.disabled = true;
      call('/admin/api-sites/delete', { id: id }).then(function (res) {
        say(msgEl, res.ok ? '已删除' : (res.error || '删除失败'), res.ok ? 'ok' : 'err');
        loadSites();
        loadStatus();
      }).catch(function () {
        btn.disabled = false;
        say(msgEl, '网络错误', 'err');
      });
    }
  });

  // 启动：URL 上的 ?key= 优先（兼容旧书签），否则用本地保存的 token；都没有就显示登录框
  (function boot() {
    var fromUrl = '';
    try { fromUrl = new URLSearchParams(location.search).get('key') || ''; } catch (e) { /* 忽略 */ }

    if (fromUrl) {
      token = fromUrl;
      writeStored(token);
      // 立刻清掉地址栏里的 token，避免它留在浏览器历史与 Referer 中
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* 忽略 */ }
    } else {
      token = readStored();
    }

    if (!token) {
      showLogin('', false);
      return;
    }

    // 有 token 时先验证一次，避免失效 token 卡在空白主面板
    call('/admin/status').then(function (res) {
      if (res.ok) {
        showMain();
        return;
      }
      if (res.status === 401) {
        token = '';
        writeStored('');
        showLogin('登录已失效，请重新登录', true);
        return;
      }
      // 非鉴权类失败（例如表未建）仍进主面板，由页面自己报错
      showMain();
    }).catch(function () {
      showLogin('无法连接 Worker，请稍后重试', true);
    });
  })();
})();
</script>
</body>
</html>`;
}

async function handleApiSitesRequest(request, env, ctx, url) {
  const path = url.pathname;

  try {
    // 公开只读：普通源
    if (path === '/api-sites' && request.method === 'GET') {
      return await serveApiSites(env, ctx, url, false);
    }

    // 私密源：与公开接口同一套读取逻辑，但必须先通过管理员鉴权
    if (path === '/api-sites/hidden' && request.method === 'GET') {
      if (!await verifyAdminRequest(request, env, url)) {
        return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
      }
      return await serveApiSites(env, ctx, url, true);
    }

    // 管理面板页面：页面自带登录视图，所以这里不做服务端鉴权（数据接口仍要求 Bearer）
    if (path === '/admin' && request.method === 'GET') {
      return new Response(apiSitesAdminPage(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    // 登录：账号（ADMINUSER）+ 密码（ADMINKEY）换取 Bearer token
    if (path === '/admin/login') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: '不支持的请求方法' }, 405);
      }
      return await handleAdminLogin(request, env);
    }

    // 其余管理接口：先校验方法与鉴权，再分发
    const allowedMethod = {
      '/admin/status': 'GET',
      '/admin/api-sites/list': 'GET',
      '/admin/api-sites/save': 'POST',
      '/admin/api-sites/delete': 'POST',
      '/admin/api-sites/toggle': 'POST',
    }[path];
    if (allowedMethod) {
      if (request.method !== allowedMethod) {
        return jsonResponse({ ok: false, error: '不支持的请求方法' }, 405);
      }
      if (!await verifyAdminRequest(request, env, url)) {
        return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
      }
      if (path === '/admin/status') return await handleAdminStatus(env);
      if (path === '/admin/api-sites/list') return await handleApiSiteList(env);
      if (path === '/admin/api-sites/save') return await handleApiSiteSave(request, env, url);
      if (path === '/admin/api-sites/delete') return await handleApiSiteDelete(request, env, url);
      return await handleApiSiteToggle(request, env, url);
    }

    return jsonResponse({ ok: false, error: '未找到路由' }, 404);
  } catch (error) {
    console.error('[api-sites] 处理失败:', error && error.message);
    return jsonResponse({ ok: false, error: '服务器错误' }, 500);
  }
}

// ====== Worker 入口（ES Module 格式）======

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      if (path.startsWith('/invite/')) {
        return handleInviteRequest(request, env);
      }
      // 管理接口带 Authorization 头，属于非简单请求，预检必须放行该头
      if (path.startsWith('/api-sites') || path.startsWith('/admin')) {
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
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // /invite/* 路由 → 邀请码 API
    if (path.startsWith('/invite/')) {
      return handleInviteRequest(request, env);
    }

    // /api-sites/* 与 /admin* 路由 → 视频源配置 API
    if (path.startsWith('/api-sites') || path.startsWith('/admin')) {
      return handleApiSitesRequest(request, env, ctx, url);
    }

    // 其他路由 → TMDB API
    return handleTMDBRequest(request, env, ctx);
  }
};
