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
// GET  /api-sites/hidden        隐私模式读取（HIDDENKEY 或管理员 token），返回启用的私密源（18+）
// GET  /admin                   管理面板页面（自带登录框，页面本身不鉴权）
// POST /admin/login             账号（ADMINUSER）+ 密码（ADMINKEY）换取 Bearer token
// GET  /admin/status            运行状态（TMDB 配置、D1 就绪、源数量），需管理员鉴权
// GET  /admin/api-sites/list    全量列表（含停用与私密），需管理员鉴权
// POST /admin/api-sites/save | /delete | /toggle，需管理员鉴权
// POST /admin/api-sites/import   导入 LibreTV / TVBOX 源列表（按 key / URL 合并），需管理员鉴权
// GET  /admin/api-sites/export   全量 JSON 导出（含停用/私密），需管理员鉴权
// POST /admin/api-sites/share    生成普通 / 私密 / 全部源的分享链接，需管理员鉴权
// GET  /sources.json             分享 / 导入地址（scope=public|hidden|all；私密范围需隐私凭证）
//
// 环境变量：
// - TMDB_API_KEY (secret)
// - ADMINUSER + ADMINKEY：管理员鉴权（Bearer = 其 SHA-256）；HIDDENKEY 不再具备管理员权限
// - HIDDENKEY (secret)：隐私模式密码，只用于 /api-sites/hidden 读取私密源
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
      'Cache-Control': 'no-store',
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

/**
 * 管理员专属鉴权：只认 ADMINKEY::ADMINUSER 换来的 token。
 * 绝不接受 HIDDENKEY —— 它的 hash 会被注入到每个访客页面，等同于公开值。
 * 面板页面在地址栏打开时带不了 Authorization，因此额外允许 ?key=<同一个 token>。
 */
async function verifyAdminOnly(request, env, url) {
  const expectedToken = await adminToken(env);
  if (!expectedToken) return false;

  const authHeader = request.headers.get('Authorization') || '';
  let token = authHeader.replace('Bearer ', '').trim();
  if (!token && url) token = url.searchParams.get('key') || '';
  return token === expectedToken;
}

/**
 * 隐私模式读鉴权：只给 /api-sites/hidden 使用。
 * 接受隐私模式密码（HIDDENKEY 的 SHA-256）或管理员 token；不具备任何管理写权限。
 */
async function verifyPrivateModeRead(request, env, url) {
  if (await verifyAdminOnly(request, env, url)) return true;
  if (!env.HIDDENKEY) return false;

  const expected = await sha256Hex(env.HIDDENKEY);
  const authHeader = request.headers.get('Authorization') || '';
  let token = authHeader.replace('Bearer ', '').trim();
  if (!token && url) token = url.searchParams.get('key') || '';
  return token === expected;
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
    // 普通续期客户端可能不再上传软指纹：只在本次确实带了签名时才更新，
    // 否则会把之前用于「设备 ID 丢失找回」的签名覆盖成空串
    const updateSignature = withSignature && signature;
    if (updateSignature) renewArgs.push(signature);
    renewArgs.push(existingDevice.id);
    await env.INVITE_DB.prepare(
      'UPDATE devices SET last_active_at = ?, ip_address = ?, browser = ?, device_name = ?'
      + (updateSignature ? ', device_signature = ?' : '')
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
  // 新设备才需要软指纹（供以后本机 ID 丢失时找回）；空签名不写库
  const insertSignature = withSignature && signature;
  if (insertSignature) insertArgs.push(signature);
  await env.INVITE_DB.prepare(
    'INSERT INTO devices (code, device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at'
    + (insertSignature ? ', device_signature' : '')
    + ') VALUES (?, ?, ?, ?, ?, ?, ?' + (insertSignature ? ', ?' : '') + ')'
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
  const isAdmin = await verifyAdminOnly(request, env);
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
  const isAdmin = await verifyAdminOnly(request, env);
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
  const isAdmin = await verifyAdminOnly(request, env);
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
  const isAdmin = await verifyAdminOnly(request, env);
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
  const isAdmin = await verifyAdminOnly(request, env);
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
  const isAdmin = await verifyAdminOnly(request, env);
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
  const { code, device_fingerprint, new_name, new_signature } = body;
  
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
  
  // 设备名已叠加进软指纹：改名时同步更新签名，否则设备 ID 丢失后无法找回
  const signature = String(new_signature || '').trim();
  const withSignature = signature && await hasSignatureColumn(env);

  if (withSignature) {
    await env.INVITE_DB.prepare(
      'UPDATE devices SET device_name = ?, device_signature = ? WHERE code = ? AND device_fingerprint = ?'
    ).bind(name, signature, code, device_fingerprint).run();
  } else {
    await env.INVITE_DB.prepare(
      'UPDATE devices SET device_name = ? WHERE code = ? AND device_fingerprint = ?'
    ).bind(name, code, device_fingerprint).run();
  }
  
  return jsonResponse({ ok: true });
}

// POST /invite/delete-code - 删除邀请码（管理员专属）
async function handleDeleteCode(request, env) {
  const isAdmin = await verifyAdminOnly(request, env);
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
// 鉴权：管理写/读接口只认 verifyAdminOnly（ADMINKEY::ADMINUSER 的 SHA-256）；
// 隐私模式读取私密源走 /api-sites/hidden 的 verifyPrivateModeRead，HIDDENKEY 不参与任何管理操作。
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

/**
 * 数据库行 → 前端 API_SITES 的条目结构。
 * detail 始终输出（空串代表「明确清空」）：前端按字段级合并，只有远端明确给出的字段才覆盖内置源。
 * hidden 只在不为空时输出，避免远端普通源把内置私密源的 hidden 冲掉。
 */
function apiSiteRowToEntry(row) {
  const entry = { api: row.api, name: row.name, detail: row.detail || '' };
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

/**
 * 管理接口鉴权：只认「登录换来的 token」（ADMINKEY::ADMINUSER 的 SHA-256）。
 *
 * 页面上公开的 window.__ENV__.HIDDENKEY 不再具备任何管理权限：
 * 它被 functions/_middleware.js 注入到每个访客的 HTML 里，等同于公开值。
 * HIDDENKEY 只保留给 /api-sites/hidden 的隐私模式读取（verifyPrivateModeRead）。
 */

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

// ====== LibreTV 源列表导入（/admin/api-sites/import）======
//
// 解析规则与前端 src/services/sources/port.ts 保持一致：
//   1. LibreTV-SourceList：{ sources: [{ name, url, detail?, isAdult? }] }
//   2. 裸数组：[{ name, url }]
//   3. TVBOX：{ sites: [{ type: 1, api, name }] }，只取 Apple CMS 直连源
//   4. 旧版映射：{ api_site: {...} } / { apiSites: {...} } / { API_SITES: {...} } / 直接映射
// 导入按 API 地址合并：已存在只更新名称与 detail，不重复新增。
// 所有地址都过 sanitizeApiSiteUrl（含内网/SSRF 校验），订阅 URL 的重定向逐跳校验。

const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const IMPORT_MAX_SOURCES = 100;
const IMPORT_MAX_ERRORS = 10;
const IMPORT_FETCH_TIMEOUT_MS = 8000;
const IMPORT_MAX_REDIRECTS = 3;

/** 规范化导入地址：只接受 http(s)，去掉末尾斜杠用于去重 */
function normalizeImportUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    new URL(trimmed);
  } catch {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
}

function importHostname(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

/** 旧版键值映射 → 条目数组 */
function sourceMapToImportEntries(map) {
  return Object.keys(map).map((key) => {
    const item = map[key];
    if (!item || typeof item !== 'object') return null;
    return Object.assign({}, item, {
      name: item.name || key,
      url: item.url || item.api,
    });
  }).filter(Boolean);
}

function looksLikeImportSourceMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).some((key) => {
    const item = value[key];
    return item && typeof item === 'object'
      && typeof (item.url || item.api) === 'string';
  });
}

/** 从受支持的 JSON 结构中取出待解析的源条目数组 */
function extractRawImportList(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return null;

  if (Array.isArray(json.sources)) return json.sources;

  // TVBOX：只取 type=1（Apple CMS 直连接口），Spider / XML 无法在本站运行
  if (Array.isArray(json.sites)) {
    return json.sites.filter((site) =>
      site && (site.type === 1 || site.type === '1') && typeof site.api === 'string'
    );
  }

  const maps = [json.api_site, json.apiSites, json.API_SITES];
  for (const map of maps) {
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      return sourceMapToImportEntries(map);
    }
  }
  if (looksLikeImportSourceMap(json)) return sourceMapToImportEntries(json);
  return null;
}

/** 单条原始条目 → 标准源；无效地址返回 null */
function normalizeImportEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const url = normalizeImportUrl(raw.url || raw.api);
  if (!url) return null;

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const rawKey = typeof raw.key === 'string' ? raw.key.trim().toLowerCase() : '';
  const key = /^[a-z0-9][a-z0-9_]{0,31}$/.test(rawKey) && !rawKey.startsWith('custom') ? rawKey : '';
  const hasDetail = Object.prototype.hasOwnProperty.call(raw, 'detail')
    || Object.prototype.hasOwnProperty.call(raw, 'detailUrl');
  const hasEnabled = Object.prototype.hasOwnProperty.call(raw, 'enabled');
  const hasHidden = Object.prototype.hasOwnProperty.call(raw, 'hidden');

  const entry = {
    key,
    name: (name || importHostname(url)).slice(0, API_SITE_MAX_NAME_LEN),
    url,
    hasDetail,
    // null = JSON 没写 enabled，更新时保留原状态；新建时默认启用
    enabled: hasEnabled ? ((raw.enabled === false || raw.enabled === 0 || raw.enabled === '0') ? 0 : 1) : null,
    // null = JSON 没写 hidden，更新时保留原私密状态；显式 false 才降级为普通源
    hidden: hasHidden ? raw.hidden === true : null,
  };

  const detail = normalizeImportUrl(raw.detail || raw.detailUrl);
  if (detail) entry.detail = detail;
  if (raw.isAdult === true || raw.hidden === true) entry.isAdult = true;
  return entry;
}

/** 解析 JSON → 去重、限制数量，并给出统计 */
function parseImportPayload(json) {
  const rawList = extractRawImportList(json);
  if (!rawList) {
    return { error: '未识别到源列表（支持 LibreTV 源列表、TVBOX sites 或旧版源配置）' };
  }

  const sources = [];
  const seen = new Set();
  let invalid = 0;
  let duplicates = 0;
  let truncated = 0;

  for (const raw of rawList) {
    const entry = normalizeImportEntry(raw);
    if (!entry) {
      invalid++;
      continue;
    }
    if (seen.has(entry.url)) {
      duplicates++;
      continue;
    }
    seen.add(entry.url);

    if (sources.length >= IMPORT_MAX_SOURCES) {
      truncated++;
      continue;
    }
    sources.push(entry);
  }

  return {
    sources,
    stats: { total: rawList.length, invalid, duplicates, truncated },
  };
}

/** 拉取订阅地址：超时、大小限制、逐跳校验重定向目标（避免 SSRF） */
async function fetchImportSourceText(rawUrl) {
  let current = String(rawUrl || '').trim();

  for (let i = 0; i <= IMPORT_MAX_REDIRECTS; i++) {
    const check = sanitizeApiSiteUrl(current, '订阅地址');
    if (check.error) return { error: check.error };
    current = check.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMPORT_FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'LeLeTV-Worker-Import/1.0',
          'Accept': 'application/json,text/plain,*/*',
        },
      });
    } catch (error) {
      return { error: error && error.name === 'AbortError' ? '订阅地址请求超时' : '订阅地址请求失败' };
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) return { error: '订阅地址返回了空重定向' };
      try {
        current = new URL(location, current).toString();
      } catch {
        return { error: '订阅地址重定向格式不正确' };
      }
      continue;
    }

    if (!response.ok) return { error: `订阅地址返回 HTTP ${response.status}` };

    const declared = parseInt(response.headers.get('Content-Length') || '0', 10);
    if (declared > IMPORT_MAX_BYTES) return { error: '订阅内容超过 2MB' };
    const text = await response.text();
    if (text.length > IMPORT_MAX_BYTES) return { error: '订阅内容超过 2MB' };
    return { text };
  }

  return { error: '订阅地址重定向次数过多' };
}

async function handleApiSiteImport(request, env, url) {
  const declaredLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declaredLength > IMPORT_MAX_BYTES + 64 * 1024) {
    return jsonResponse({ ok: false, error: '导入内容超过 2MB' }, 413);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonResponse({ ok: false, error: '请求体不是合法 JSON' }, 400);
  }

  let text = '';
  if (typeof body.text === 'string' && body.text.trim()) {
    text = body.text;
  } else if (typeof body.url === 'string' && body.url.trim()) {
    const fetched = await fetchImportSourceText(body.url);
    if (fetched.error) return jsonResponse({ ok: false, error: fetched.error }, 400);
    text = fetched.text;
  } else {
    return jsonResponse({ ok: false, error: '请提供 JSON 文本或订阅地址' }, 400);
  }

  if (text.length > IMPORT_MAX_BYTES) {
    return jsonResponse({ ok: false, error: '导入内容超过 2MB' }, 413);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return jsonResponse({ ok: false, error: '内容不是合法的 JSON' }, 400);
  }

  const parsed = parseImportPayload(json);
  if (parsed.error) return jsonResponse({ ok: false, error: parsed.error }, 400);
  if (!parsed.sources.length) {
    return jsonResponse({ ok: false, error: '没有可导入的有效源', stats: parsed.stats }, 400);
  }

  const hiddenFlag = body.hidden ? 1 : 0;
  const now = Date.now();

  try {
    const existingResult = await env.INVITE_DB.prepare(
      'SELECT id, source_key, name, api, detail, hidden, enabled, sort_order, updated_at FROM api_sites'
    ).all();
    const rows = (existingResult && existingResult.results) || [];

    const byKey = new Map();
    const byUrl = new Map();
    const usedKeys = new Set();
    let nextSort = 0;
    for (const row of rows) {
      if (row.source_key) {
        byKey.set(row.source_key, row);
        usedKeys.add(row.source_key);
      }
      const urlKey = normalizeImportUrl(row.api);
      if (urlKey && !byUrl.has(urlKey)) byUrl.set(urlKey, row);
      const sort = Number(row.sort_order) || 0;
      if (sort > nextSort) nextSort = sort;
    }

    const statements = [];
    const errors = [];
    let imported = 0;
    let updated = 0;

    for (const source of parsed.sources) {
      const existing = (source.key && byKey.get(source.key)) || byUrl.get(source.url);
      // null = 条目没写 hidden，更新时保留原状态；显式 false 才降级为普通源
      const wantHidden = hiddenFlag
        ? 1
        : (source.isAdult || source.hidden === true ? 1 : (source.hidden === false ? 0 : null));

      if (existing) {
        const apiCheck = sanitizeApiSiteUrl(source.url, 'API 地址');
        if (apiCheck.error) {
          errors.push(`${source.name || source.url}：${apiCheck.error}`);
          continue;
        }

        let detail = existing.detail || '';
        if (source.hasDetail) {
          if (!source.detail) {
            detail = '';
          } else {
            const detailCheck = sanitizeApiSiteUrl(source.detail, 'detail 地址');
            if (detailCheck.value) detail = detailCheck.value;
            else errors.push(`${source.name || source.url}：${detailCheck.error}`);
          }
        }

        const nextHidden = wantHidden === null ? (existing.hidden ? 1 : 0) : wantHidden;
        const nextEnabled = source.enabled === null ? (existing.enabled ? 1 : 0) : source.enabled;

        statements.push(env.INVITE_DB.prepare(
          'UPDATE api_sites SET name = ?, api = ?, detail = ?, hidden = ?, enabled = ?, updated_at = ? WHERE id = ?'
        ).bind(
          (source.name || existing.name || '').slice(0, API_SITE_MAX_NAME_LEN),
          apiCheck.value,
          detail,
          nextHidden,
          nextEnabled,
          now,
          existing.id
        ));
        updated++;
        continue;
      }

      // 最终入库前再校验一次，避免解析阶段放过了异常地址
      const apiCheck = sanitizeApiSiteUrl(source.url, 'API 地址');
      if (apiCheck.error) {
        errors.push(`${source.name || source.url}：${apiCheck.error}`);
        continue;
      }

      let detail = '';
      if (source.detail) {
        const detailCheck = sanitizeApiSiteUrl(source.detail, 'detail 地址');
        if (detailCheck.value) detail = detailCheck.value;
      }

      let key = source.key;
      if (!key || usedKeys.has(key)) {
        key = generateApiSiteKey();
        while (usedKeys.has(key)) key = generateApiSiteKey();
      }
      usedKeys.add(key);
      nextSort += 1;

      statements.push(env.INVITE_DB.prepare(
        'INSERT INTO api_sites (source_key, name, api, detail, hidden, enabled, sort_order, created_at, updated_at)'
        + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        key,
        (source.name || importHostname(source.url)).slice(0, API_SITE_MAX_NAME_LEN),
        apiCheck.value,
        detail,
        wantHidden === null ? 0 : wantHidden,
        source.enabled === null ? 1 : source.enabled,
        nextSort,
        now,
        now
      ));
      imported++;
    }

    if (!statements.length) {
      return jsonResponse({
        ok: false,
        error: errors.length ? '没有可导入的有效源' : '没有需要导入的源',
        stats: Object.assign({}, parsed.stats, { imported: 0, updated: 0 }),
        errors: errors.slice(0, IMPORT_MAX_ERRORS),
      }, 400);
    }

    await env.INVITE_DB.batch(statements);
    await purgeApiSitesCache(url);

    return jsonResponse({
      ok: true,
      stats: Object.assign({}, parsed.stats, { imported, updated }),
      errors: errors.slice(0, IMPORT_MAX_ERRORS),
    }, 200);
  } catch (error) {
    console.error('[api-sites] 导入失败:', error && error.message);
    return jsonResponse({ ok: false, error: '导入失败：请确认已执行 migrations/004_add_api_sites.sql' }, 500);
  }
}

// ====== 数据源导出（/sources.json、/admin/api-sites/export）======

/** D1 行 → LibreTV SourceList；key/enabled 供面板 JSON 编辑与再次导入 */
function buildSourceListPayload(rows) {
  return {
    name: 'LeLeTV-SourceList',
    version: 2,
    exportedAt: Date.now(),
    sources: (rows || []).map((row) => ({
      key: row.source_key,
      name: row.name,
      url: row.api,
      detail: row.detail || '',
      hidden: !!row.hidden,
      enabled: !!row.enabled,
    })),
  };
}

/**
 * GET /sources.json —— 分享 / 导入地址。
 * scope=public：启用的普通源（默认，公开）
 * scope=hidden：只返回启用的私密源，需要隐私凭证
 * scope=all：普通 + 私密源，需要隐私凭证
 * 兼容旧参数 ?hidden=1（等价 scope=all）。
 */
function resolveSourceScope(url) {
  const scope = (url.searchParams.get('scope') || '').toLowerCase();
  if (scope === 'public' || scope === 'hidden' || scope === 'all') return scope;
  return url.searchParams.get('hidden') === '1' ? 'all' : 'public';
}

async function handleSourceListExport(request, env, url) {
  const scope = resolveSourceScope(url);
  if (scope !== 'public') {
    const authed = await verifyPrivateModeRead(request, env, url);
    if (!authed) {
      return jsonResponse({ ok: false, error: '隐私模式验证失败' }, 401);
    }
  }

  try {
    const where = scope === 'hidden'
      ? 'enabled = 1 AND hidden = 1'
      : (scope === 'all' ? 'enabled = 1' : 'enabled = 1 AND hidden = 0');
    const result = await env.INVITE_DB.prepare(
      'SELECT source_key, name, api, detail, hidden, enabled FROM api_sites'
      + ' WHERE ' + where + ' ORDER BY sort_order ASC, id ASC'
    ).all();
    const payload = buildSourceListPayload((result && result.results) || []);
    payload.scope = scope;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    console.error('[api-sites] 导出失败:', error && error.message);
    return jsonResponse({ ok: false, error: '导出失败：请确认已执行 migrations/004_add_api_sites.sql' }, 500);
  }
}

/** POST /admin/api-sites/share —— 生成分享链接；私密范围可显式附带隐私凭证 */
async function handleApiSiteShare(request, env, url) {
  const body = await request.json().catch(() => null);
  const includeToken = !!(body && body.includeToken);
  let token = '';
  if (includeToken) {
    if (!env.HIDDENKEY) {
      return jsonResponse({ ok: false, error: '未配置 HIDDENKEY，无法生成带凭证的私密分享链接' }, 400);
    }
    token = await sha256Hex(env.HIDDENKEY);
  }

  const base = new URL('/sources.json', url.origin);
  const urls = {};
  for (const scope of ['public', 'hidden', 'all']) {
    const link = new URL(base.toString());
    link.searchParams.set('scope', scope);
    if (token && scope !== 'public') link.searchParams.set('key', token);
    urls[scope] = link.toString();
  }

  return jsonResponse({
    ok: true,
    urls,
    has_hidden_key: !!env.HIDDENKEY,
  }, 200);
}

/** GET /admin/api-sites/export —— 管理面板 JSON 编辑器用，含停用与私密源 */
async function handleApiSiteExport(env) {
  try {
    const result = await env.INVITE_DB.prepare(
      'SELECT source_key, name, api, detail, hidden, enabled FROM api_sites ORDER BY sort_order ASC, id ASC'
    ).all();
    return jsonResponse({
      ok: true,
      list: buildSourceListPayload((result && result.results) || []),
    }, 200);
  } catch (error) {
    console.error('[api-sites] 管理导出失败:', error && error.message);
    return jsonResponse({ ok: false, error: '导出失败：请确认已执行 migrations/004_add_api_sites.sql' }, 500);
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
h2{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
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
.count{margin-left:auto;font-size:11px;color:#555;font-weight:400;letter-spacing:0;text-transform:none}
.icon-btn{width:26px;height:26px;padding:0;border-radius:50%;font-size:17px;line-height:1;display:inline-flex;align-items:center;justify-content:center;background:#ec4899;border:1px solid #ec4899;color:#fff}
.icon-btn:hover{background:#db2777;border-color:#db2777;color:#fff}
.modal{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:20px}
.modal.hidden{display:none}
.modal-mask{position:absolute;inset:0;background:rgba(0,0,0,.66)}
.modal-card{position:relative;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;background:#16161a;border:1px solid #2a2a30;border-radius:12px;padding:26px 24px;box-shadow:0 18px 48px rgba(0,0,0,.55)}
.modal-card h2{margin-bottom:18px}
.footer{margin-top:22px;text-align:center;font-size:11px;color:#444}
/* 导入弹窗与代码工作风细节：key/URL 用等宽字体，保持与 Worker 状态页一致的深色克制风格 */
textarea{width:100%;min-height:150px;resize:vertical;background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px;color:#e0e0e0;padding:10px 12px;font-size:12px;line-height:1.7;font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace;transition:border-color .2s}
textarea:focus{outline:none;border-color:#ec4899}
input[type=file]{width:100%;font-size:12px;color:#888}
input[type=file]::file-selector-button{background:#1e1e24;border:1px solid #2a2a30;border-radius:6px;color:#aaa;font-size:12px;padding:6px 12px;margin-right:10px;cursor:pointer;font-family:inherit}
input[type=file]::file-selector-button:hover{background:#2a2a30;color:#e0e0e0}
.import-btn{margin-left:0;padding:4px 12px;font-size:11px;border-color:#831843;color:#ec4899}
.import-btn:hover{background:#1f1419;border-color:#ec4899;color:#f9a8d4}
.tabs{display:flex;gap:6px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #2a2a30}
.tab{background:transparent;border:1px solid transparent;border-radius:6px;padding:6px 10px;font-size:12px;color:#777}
.tab:hover{background:#1e1e24;color:#bbb}
.tab.active{background:#1f1419;border-color:#831843;color:#ec4899}
.import-pane{margin-bottom:14px}
.hint{font-size:11px;color:#555;line-height:1.7;margin-top:6px}
.item .meta{font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace}
.import-result{margin-top:14px;padding:12px 14px;background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px;font-size:12px;line-height:1.8}
.import-result .ok{color:#4ade80}
.import-result .warn{color:#fbbf24;margin-top:8px}
.import-result ul{margin:6px 0 0 16px;color:#aaa}
.import-result li{word-break:break-all}
#jsonText{min-height:300px}
.json-toolbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}
.share-list{display:flex;flex-direction:column;gap:8px;margin:14px 0}
.share-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px}
.share-info{flex:1;min-width:0}
.share-name{display:flex;align-items:center;gap:6px;font-size:13px;color:#e0e0e0}
.share-url{margin-top:4px;color:#666;font-size:11px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace}
.share-row button{flex:none}
.hint.warn{color:#fbbf24}
@media (max-width:560px){
  body{padding:18px 10px}
  .container{padding:24px 18px}
  .item{flex-direction:column;align-items:flex-start}
  .item .ops{width:100%;justify-content:flex-end;flex-wrap:wrap}
  .stat{min-width:100%}
  .modal-card{padding:22px 18px}
  .tabs{flex-wrap:wrap}
}
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

<!-- 数据源统一板块：统计 / 列表 / 状态消息都在这里，新增与编辑走弹窗 -->
<div class="block">
<h2>数据源管理<span class="count" id="siteCount"></span><button type="button" class="mini import-btn" id="shareBtn" title="分享数据源链接">分享</button><button type="button" class="mini import-btn" id="jsonBtn" title="查看 / 编辑数据源 JSON">JSON</button><button type="button" class="mini import-btn" id="importBtn" title="导入 LibreTV 源列表">导入</button><button class="icon-btn" id="addSiteBtn" title="新增数据源" aria-label="新增数据源">+</button></h2>
<div id="list"><div class="empty">加载中…</div></div>
<div class="msg" id="msg"></div>
</div>
</div>

<div class="footer">Powered by Cloudflare Workers · D1</div>
</div>

<!-- 新增 / 编辑数据源弹窗 -->
<div class="modal hidden" id="siteModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
<div class="modal-mask" data-close="1"></div>
<div class="modal-card">
<h2 id="modalTitle">新增数据源</h2>
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
<button id="modalCancel">取消</button>
<button class="primary" id="modalSave">保存</button>
</div>
<div class="msg" id="modalMsg"></div>
</div>
</div>

<!-- 导入数据源弹窗：粘贴 / 文件 / 订阅 URL 三种入口，服务端按 API 地址合并 -->
<div class="modal hidden" id="importModal" role="dialog" aria-modal="true" aria-labelledby="importTitle">
<div class="modal-mask" data-import-close="1"></div>
<div class="modal-card">
<h2 id="importTitle">导入数据源</h2>
<div class="tabs" role="tablist">
<button type="button" class="tab active" data-import-tab="text" role="tab">粘贴 JSON</button>
<button type="button" class="tab" data-import-tab="file" role="tab">上传文件</button>
<button type="button" class="tab" data-import-tab="url" role="tab">订阅 URL</button>
</div>
<div class="import-pane" data-import-pane="text">
<textarea id="importText" rows="8" placeholder="支持 LibreTV SourceList、TVBOX sites、旧版源配置"></textarea>
<div class="hint">{ "sources": [{ "name": "...", "url": "https://..." }] } 或 { "sites": [{ "type": 1, "api": "https://...", "name": "..." }] }</div>
</div>
<div class="import-pane hidden" data-import-pane="file">
<input type="file" id="importFile" accept=".json,application/json">
<div class="hint" id="importFileHint">选择 .json 文件，最大 2MB</div>
</div>
<div class="import-pane hidden" data-import-pane="url">
<input type="text" id="importUrl" placeholder="https://example.com/sources.json">
<div class="hint">由 Worker 拉取，需为可公开访问的 JSON 地址；会校验内网地址与重定向。</div>
</div>
<label class="check"><input type="checkbox" id="importHidden"> 作为私密源导入（18+，仅隐藏内容模式可见）</label>
<div class="hint">按 API 地址合并：已存在的源只更新名称与 detail，不重复新增。</div>
<div class="actions">
<button type="button" id="importCancel">取消</button>
<button type="button" class="primary" id="importConfirm">导入</button>
</div>
<div class="msg" id="importMsg"></div>
<div id="importResult" class="hidden"></div>
</div>
</div>

<!-- 数据源 JSON 工作台：直接编辑 LibreTV 格式，保存时只增改，不删除未列出的源 -->
<div class="modal hidden" id="jsonModal" role="dialog" aria-modal="true" aria-labelledby="jsonTitle">
<div class="modal-mask" data-json-close="1"></div>
<div class="modal-card">
<h2 id="jsonTitle">数据源 JSON</h2>
<div class="hint">直接编辑下面的 LibreTV 格式；保存时只新增和更新，不删除未列出的源。</div>
<textarea id="jsonText" rows="16" spellcheck="false"></textarea>
<div class="json-toolbar">
<button type="button" id="jsonCopyUrl">复制导入地址</button>
<button type="button" id="jsonDownload">下载备份</button>
<button type="button" class="primary" id="jsonSave">保存（只增改）</button>
</div>
<div class="msg" id="jsonMsg"></div>
<div class="hint" id="jsonUrlHint"></div>
</div>
</div>

<!-- 分享数据源：普通 / 私密 / 全部，链接由 Worker 的 /sources.json 生成 -->
<div class="modal hidden" id="shareModal" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
<div class="modal-mask" data-share-close="1"></div>
<div class="modal-card">
<h2 id="shareTitle">分享数据源</h2>
<div class="hint">把链接发给其他用户，在设置页「导入视频源 → 从 URL 导入」使用。</div>
<div class="share-list">
<div class="share-row">
<div class="share-info">
<div class="share-name">普通源</div>
<div class="share-url" id="shareUrlPublic">—</div>
</div>
<button type="button" data-share-copy="public">复制</button>
</div>
<div class="share-row">
<div class="share-info">
<div class="share-name">私密源 <span class="tag priv">18+</span></div>
<div class="share-url" id="shareUrlHidden">—</div>
</div>
<button type="button" data-share-copy="hidden">复制</button>
</div>
<div class="share-row">
<div class="share-info">
<div class="share-name">普通 + 私密源</div>
<div class="share-url" id="shareUrlAll">—</div>
</div>
<button type="button" data-share-copy="all">复制</button>
</div>
</div>
<label class="check"><input type="checkbox" id="shareIncludeToken"> 链接包含私密访问凭证（拿到链接即可导入私密源）</label>
<div class="hint warn" id="shareTokenHint">默认不带凭证：接收方需在私密模式下导入。开启后链接泄露会暴露私密源，请只分享给信任的人。</div>
<div class="msg" id="shareMsg"></div>
</div>
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
  var fName = document.getElementById('fName');
  var fKey = document.getElementById('fKey');
  var fApi = document.getElementById('fApi');
  var fDetail = document.getElementById('fDetail');
  var fHidden = document.getElementById('fHidden');
  var siteCount = document.getElementById('siteCount');
  var addSiteBtn = document.getElementById('addSiteBtn');
  var modalEl = document.getElementById('siteModal');
  var modalTitle = document.getElementById('modalTitle');
  var modalMsg = document.getElementById('modalMsg');
  var modalSave = document.getElementById('modalSave');
  var modalCancel = document.getElementById('modalCancel');
  var allSites = [];
  var token = '';
  var editingId = 0;
  var saving = false;
  var lastFocus = null;
  var importBtn = document.getElementById('importBtn');
  var importModal = document.getElementById('importModal');
  var importText = document.getElementById('importText');
  var importFile = document.getElementById('importFile');
  var importFileHint = document.getElementById('importFileHint');
  var importUrl = document.getElementById('importUrl');
  var importHidden = document.getElementById('importHidden');
  var importMsg = document.getElementById('importMsg');
  var importResult = document.getElementById('importResult');
  var importConfirm = document.getElementById('importConfirm');
  var importCancel = document.getElementById('importCancel');
  var importMode = 'text';
  var importFileText = '';
  var importing = false;
  var jsonBtn = document.getElementById('jsonBtn');
  var jsonModal = document.getElementById('jsonModal');
  var jsonText = document.getElementById('jsonText');
  var jsonMsg = document.getElementById('jsonMsg');
  var jsonSave = document.getElementById('jsonSave');
  var jsonDownload = document.getElementById('jsonDownload');
  var jsonCopyUrl = document.getElementById('jsonCopyUrl');
  var jsonUrlHint = document.getElementById('jsonUrlHint');
  var savingJson = false;
  var shareBtn = document.getElementById('shareBtn');
  var shareModal = document.getElementById('shareModal');
  var shareIncludeToken = document.getElementById('shareIncludeToken');
  var shareMsg = document.getElementById('shareMsg');
  var shareUrlPublic = document.getElementById('shareUrlPublic');
  var shareUrlHidden = document.getElementById('shareUrlHidden');
  var shareUrlAll = document.getElementById('shareUrlAll');
  var shareTokenHint = document.getElementById('shareTokenHint');
  var shareUrls = {};
  var shareLoading = false;

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

  // ===== 导入弹窗 =====

  function isImportOpen() {
    return importModal.className.indexOf('hidden') === -1;
  }

  function switchImportTab(mode) {
    importMode = mode;
    var tabs = document.querySelectorAll('[data-import-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-import-tab') === mode);
    }
    var panes = document.querySelectorAll('[data-import-pane]');
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle('hidden', panes[j].getAttribute('data-import-pane') !== mode);
    }
  }

  function resetImportForm() {
    importText.value = '';
    importFile.value = '';
    importFileText = '';
    importFileHint.textContent = '选择 .json 文件，最大 2MB';
    importUrl.value = '';
    importHidden.checked = false;
    importing = false;
    importConfirm.disabled = false;
    say(importMsg, '');
    importResult.className = 'hidden';
    importResult.innerHTML = '';
    switchImportTab('text');
  }

  function openImportModal() {
    resetImportForm();
    lastFocus = document.activeElement;
    importModal.className = 'modal';
    setTimeout(function () { importText.focus(); }, 60);
  }

  function closeImportModal() {
    if (!isImportOpen() || importing) return;
    importModal.className = 'modal hidden';
    say(importMsg, '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function readImportFile() {
    var file = importFile.files && importFile.files[0];
    importFileText = '';
    if (!file) {
      importFileHint.textContent = '选择 .json 文件，最大 2MB';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      importFile.value = '';
      importFileHint.textContent = '选择 .json 文件，最大 2MB';
      say(importMsg, '文件超过 2MB，请换一个文件', 'err');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      importFileText = String(reader.result || '');
      importFileHint.textContent = file.name + ' · ' + (file.size / 1024).toFixed(1) + ' KB';
      say(importMsg, '');
    };
    reader.onerror = function () {
      importFileText = '';
      say(importMsg, '文件读取失败', 'err');
    };
    reader.readAsText(file);
  }

  function renderImportResult(stats, errors) {
    stats = stats || {};
    var parts = [];
    if (stats.total) parts.push('识别 ' + stats.total + ' 条');
    if (stats.imported) parts.push('新增 ' + stats.imported);
    if (stats.updated) parts.push('更新 ' + stats.updated);
    if (stats.invalid) parts.push('无效 ' + stats.invalid);
    if (stats.duplicates) parts.push('重复 ' + stats.duplicates);
    if (stats.truncated) parts.push('超限丢弃 ' + stats.truncated);

    var changed = !!(stats.imported || stats.updated);
    var html = '<div class="' + (changed ? 'ok' : 'warn') + '">'
      + esc(parts.join(' · ') || '没有变化') + '</div>';
    if (errors && errors.length) {
      html += '<div class="warn">部分条目未导入：</div><ul>';
      for (var i = 0; i < errors.length; i++) {
        html += '<li>' + esc(errors[i]) + '</li>';
      }
      html += '</ul>';
    }
    importResult.innerHTML = html;
    importResult.className = 'import-result';
  }

  function doImport() {
    if (importing) return;

    var payload = { hidden: importHidden.checked };
    if (importMode === 'url') {
      payload.url = importUrl.value.trim();
      if (!payload.url) {
        say(importMsg, '请输入订阅 URL', 'err');
        return;
      }
    } else if (importMode === 'file') {
      if (!importFileText) {
        say(importMsg, '请先选择 JSON 文件', 'err');
        return;
      }
      payload.text = importFileText;
    } else {
      payload.text = importText.value.trim();
      if (!payload.text) {
        say(importMsg, '请粘贴 JSON 内容', 'err');
        return;
      }
    }

    importing = true;
    importConfirm.disabled = true;
    importResult.className = 'hidden';
    say(importMsg, '导入中…');

    call('/admin/api-sites/import', payload).then(function (res) {
      importing = false;
      importConfirm.disabled = false;
      if (!res.ok) {
        say(importMsg, res.error || '导入失败', 'err');
        if (res.stats) renderImportResult(res.stats, res.errors || []);
        return;
      }
      say(importMsg, '');
      renderImportResult(res.stats || {}, res.errors || []);
      loadSites();
      loadStatus();
    }).catch(function () {
      importing = false;
      importConfirm.disabled = false;
      say(importMsg, '网络错误', 'err');
    });
  }

  // ===== JSON 工作台 =====

  function isJsonOpen() {
    return jsonModal.className.indexOf('hidden') === -1;
  }

  function openJsonModal() {
    if (isJsonOpen()) return;
    jsonText.value = '';
    jsonUrlHint.textContent = '';
    say(jsonMsg, '正在读取…');
    lastFocus = document.activeElement;
    jsonModal.className = 'modal';
    call('/admin/api-sites/export').then(function (res) {
      if (!res.ok) {
        say(jsonMsg, res.error || '读取失败', 'err');
        return;
      }
      jsonText.value = JSON.stringify(res.list || {}, null, 2);
      say(jsonMsg, '');
      jsonUrlHint.textContent = '导入地址：' + location.origin + '/sources.json';
    }).catch(function () {
      say(jsonMsg, '网络错误', 'err');
    });
  }

  function closeJsonModal() {
    if (!isJsonOpen() || savingJson) return;
    jsonModal.className = 'modal hidden';
    say(jsonMsg, '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function saveJson() {
    if (savingJson) return;
    var text = jsonText.value.trim();
    if (!text) {
      say(jsonMsg, 'JSON 不能为空', 'err');
      return;
    }
    try {
      JSON.parse(text);
    } catch (e) {
      say(jsonMsg, '不是合法的 JSON', 'err');
      return;
    }

    savingJson = true;
    jsonSave.disabled = true;
    say(jsonMsg, '保存中…');
    call('/admin/api-sites/import', { text: text }).then(function (res) {
      savingJson = false;
      jsonSave.disabled = false;
      if (!res.ok) {
        say(jsonMsg, res.error || '保存失败', 'err');
        return;
      }
      var stats = res.stats || {};
      var parts = [];
      if (stats.imported) parts.push('新增 ' + stats.imported);
      if (stats.updated) parts.push('更新 ' + stats.updated);
      var skipped = (stats.invalid || 0) + (stats.duplicates || 0) + (stats.truncated || 0);
      if (skipped) parts.push('跳过 ' + skipped);
      say(jsonMsg, '已保存：' + (parts.join(' · ') || '没有变化'), 'ok');
      loadSites();
      loadStatus();
    }).catch(function () {
      savingJson = false;
      jsonSave.disabled = false;
      say(jsonMsg, '网络错误', 'err');
    });
  }

  function downloadJson() {
    var text = jsonText.value.trim();
    if (!text) return;
    var blob = new Blob([text], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'leletv-worker-sources-' + Date.now() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function copyImportUrl() {
    var url = location.origin + '/sources.json';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        say(jsonMsg, '已复制导入地址', 'ok');
      }).catch(function () {
        say(jsonMsg, '复制失败，请手动复制：' + url, 'err');
      });
      return;
    }
    say(jsonMsg, '导入地址：' + url);
  }

  // ===== 分享弹窗 =====

  function isShareOpen() {
    return shareModal.className.indexOf('hidden') === -1;
  }

  function setShareUrls(urls) {
    shareUrls = urls || {};
    shareUrlPublic.textContent = shareUrls.public || '—';
    shareUrlHidden.textContent = shareUrls.hidden || '—';
    shareUrlAll.textContent = shareUrls.all || '—';
  }

  function loadShareLinks(includeToken) {
    if (shareLoading) return;
    shareLoading = true;
    say(shareMsg, '正在生成链接…');
    call('/admin/api-sites/share', { includeToken: !!includeToken }).then(function (res) {
      shareLoading = false;
      if (!res.ok) {
        say(shareMsg, res.error || '生成失败', 'err');
        return;
      }
      setShareUrls(res.urls);
      shareIncludeToken.disabled = !res.has_hidden_key;
      if (!res.has_hidden_key) {
        shareIncludeToken.checked = false;
        shareTokenHint.textContent = '未配置 HIDDENKEY，私密源链接无法被验证；请先在 Worker 环境变量中配置。';
      } else if (includeToken) {
        shareTokenHint.textContent = '链接已包含访问凭证，拿到链接即可导入私密源；链接泄露会暴露私密源，请只分享给信任的人。';
      } else {
        shareTokenHint.textContent = '默认不带凭证：接收方需在私密模式下导入。开启后链接泄露会暴露私密源，请只分享给信任的人。';
      }
      say(shareMsg, '');
    }).catch(function () {
      shareLoading = false;
      say(shareMsg, '网络错误', 'err');
    });
  }

  function openShareModal() {
    if (isShareOpen()) return;
    shareIncludeToken.checked = false;
    shareIncludeToken.disabled = false;
    setShareUrls({});
    say(shareMsg, '');
    lastFocus = document.activeElement;
    shareModal.className = 'modal';
    loadShareLinks(false);
  }

  function closeShareModal() {
    if (!isShareOpen() || shareLoading) return;
    shareModal.className = 'modal hidden';
    say(shareMsg, '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function copyShareLink(scope) {
    var url = shareUrls[scope] || '';
    if (!url) {
      say(shareMsg, '链接还没生成', 'err');
      return;
    }
    var label = scope === 'public' ? '普通源' : (scope === 'hidden' ? '私密源' : '普通 + 私密源');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        say(shareMsg, '已复制' + label + '链接', 'ok');
      }).catch(function () {
        say(shareMsg, '复制失败，请手动复制：' + url, 'err');
      });
      return;
    }
    say(shareMsg, '分享链接：' + url);
  }

  // ===== 新增 / 编辑弹窗 =====

  function isModalOpen() {
    return modalEl.className.indexOf('hidden') === -1;
  }

  function openModal(site) {
    editingId = site ? site.id : 0;
    fName.value = site ? site.name : '';
    fKey.value = site ? site.key : '';
    fKey.disabled = !!site;
    fApi.value = site ? site.api : '';
    fDetail.value = (site && site.detail) ? site.detail : '';
    fHidden.checked = !!(site && site.hidden);
    modalTitle.textContent = site ? '编辑数据源' : '新增数据源';
    saving = false;
    modalSave.disabled = false;
    say(modalMsg, site ? 'key 创建后不可修改；要换 key 请新增一条并删除旧条' : '');
    lastFocus = document.activeElement;
    modalEl.className = 'modal';
    if (!site) setTimeout(function () { fName.focus(); }, 60);
  }

  function closeModal() {
    if (!isModalOpen()) return;
    modalEl.className = 'modal hidden';
    say(modalMsg, '');
    // 关闭后把焦点还给触发按钮，键盘操作不至于丢失位置
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function saveSite() {
    if (saving) return;
    var payload = {
      id: editingId || 0,
      name: fName.value.trim(),
      api: fApi.value.trim(),
      detail: fDetail.value.trim(),
      hidden: fHidden.checked,
      key: fKey.value.trim().toLowerCase()
    };
    if (!payload.name || !payload.api) {
      say(modalMsg, '名称和 API 地址不能为空', 'err');
      return;
    }
    saving = true;
    modalSave.disabled = true;
    say(modalMsg, '保存中…');
    call('/admin/api-sites/save', payload).then(function (res) {
      saving = false;
      modalSave.disabled = false;
      if (!res.ok) {
        say(modalMsg, res.error || '保存失败', 'err');
        return;
      }
      closeModal();
      say(msgEl, '已保存：' + payload.name, 'ok');
      loadSites();
      loadStatus();
    }).catch(function () {
      saving = false;
      modalSave.disabled = false;
      say(modalMsg, '网络错误', 'err');
    });
  }

  function showLogin(message, isError) {
    closeModal();
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

  function formatTime(ts) {
    var d = new Date(Number(ts) || 0);
    if (!d.getTime()) return '';
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function render(sites) {
    allSites = sites;
    var enabledCount = sites.filter(function (s) { return s.enabled; }).length;
    siteCount.textContent = sites.length ? ('共 ' + sites.length + ' 个 · ' + enabledCount + ' 启用') : '';
    if (!sites.length) {
      listEl.innerHTML = '<div class="empty">还没有配置数据源，点右上角「导入」或「+」添加</div>';
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
          (s.updated_at ? '<div class="meta">更新于 ' + esc(formatTime(s.updated_at)) + '</div>' : '') +
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
    siteCount.textContent = '';
    showLogin('已退出登录', false);
  });

  // 「+」打开新增弹窗；列表里的「编辑」复用同一个弹窗
  addSiteBtn.addEventListener('click', function () {
    openModal(null);
  });

  // 导入弹窗：按钮、入口切换、文件读取、三种来源共用一个提交
  importBtn.addEventListener('click', openImportModal);
  jsonBtn.addEventListener('click', openJsonModal);
  jsonSave.addEventListener('click', saveJson);
  jsonDownload.addEventListener('click', downloadJson);
  jsonCopyUrl.addEventListener('click', copyImportUrl);
  jsonModal.addEventListener('click', function (e) {
    if (e.target && e.target.getAttribute('data-json-close') === '1') closeJsonModal();
  });
  shareBtn.addEventListener('click', openShareModal);
  shareIncludeToken.addEventListener('change', function () {
    loadShareLinks(shareIncludeToken.checked);
  });
  shareModal.addEventListener('click', function (e) {
    if (e.target && e.target.getAttribute('data-share-close') === '1') closeShareModal();
  });
  var shareCopyBtns = document.querySelectorAll('[data-share-copy]');
  for (var sc = 0; sc < shareCopyBtns.length; sc++) {
    shareCopyBtns[sc].addEventListener('click', function () {
      copyShareLink(this.getAttribute('data-share-copy'));
    });
  }
  importCancel.addEventListener('click', closeImportModal);
  importConfirm.addEventListener('click', doImport);
  importFile.addEventListener('change', readImportFile);
  importUrl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doImport();
  });
  importModal.addEventListener('click', function (e) {
    if (e.target && e.target.getAttribute('data-import-close') === '1') closeImportModal();
  });
  var importTabs = document.querySelectorAll('[data-import-tab]');
  for (var ti = 0; ti < importTabs.length; ti++) {
    importTabs[ti].addEventListener('click', function () {
      switchImportTab(this.getAttribute('data-import-tab'));
    });
  }
  modalCancel.addEventListener('click', closeModal);
  modalSave.addEventListener('click', saveSite);

  // 点遮罩关闭（遮罩带 data-close，卡片内部点击不会冒泡到这里关闭）
  modalEl.addEventListener('click', function (e) {
    if (e.target && e.target.getAttribute('data-close') === '1') closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeShareModal();
      closeJsonModal();
      closeImportModal();
      closeModal();
    }
  });

  fName.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') fApi.focus();
  });
  fApi.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveSite();
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = parseInt(btn.getAttribute('data-id'), 10);

    if (act === 'edit') {
      var found = allSites.filter(function (s) { return s.id === id; })[0];
      if (!found) return;
      openModal(found);
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
    // 公开导入地址：设置页「从 URL 导入」可直接填写它
    if (path === '/sources.json' && request.method === 'GET') {
      return await handleSourceListExport(request, env, url);
    }

    // 公开只读：普通源
    if (path === '/api-sites' && request.method === 'GET') {
      return await serveApiSites(env, ctx, url, false);
    }

    // 私密源：与公开接口同一套读取逻辑，但必须先通过管理员鉴权
    if (path === '/api-sites/hidden' && request.method === 'GET') {
      if (!await verifyPrivateModeRead(request, env, url)) {
        return jsonResponse({ ok: false, error: '隐私模式验证失败' }, 401);
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
      '/admin/api-sites/import': 'POST',
      '/admin/api-sites/export': 'GET',
      '/admin/api-sites/share': 'POST',
    }[path];
    if (allowedMethod) {
      if (request.method !== allowedMethod) {
        return jsonResponse({ ok: false, error: '不支持的请求方法' }, 405);
      }
      // 管理接口只认登录换来的 token；HIDDENKEY 只能读私密源，不能进管理接口
      const authed = await verifyAdminOnly(request, env, url);
      if (!authed) {
        return jsonResponse({ ok: false, error: '管理员验证失败' }, 401);
      }
      if (path === '/admin/status') return await handleAdminStatus(env);
      if (path === '/admin/api-sites/list') return await handleApiSiteList(env);
      if (path === '/admin/api-sites/export') return await handleApiSiteExport(env);
      if (path === '/admin/api-sites/share') return await handleApiSiteShare(request, env, url);
      if (path === '/admin/api-sites/save') return await handleApiSiteSave(request, env, url);
      if (path === '/admin/api-sites/delete') return await handleApiSiteDelete(request, env, url);
      if (path === '/admin/api-sites/import') return await handleApiSiteImport(request, env, url);
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
      if (path.startsWith('/api-sites') || path.startsWith('/admin') || path === '/sources.json') {
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
    if (path.startsWith('/api-sites') || path.startsWith('/admin') || path === '/sources.json') {
      return handleApiSitesRequest(request, env, ctx, url);
    }

    // 其他路由 → TMDB API
    return handleTMDBRequest(request, env, ctx);
  }
};
