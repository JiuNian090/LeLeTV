import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';

// better-sqlite3 可选安装，缺失时邀请码功能降级
let Database;
try {
  const mod = await import('better-sqlite3');
  Database = mod.default;
} catch (e) {
  Database = null;
  console.warn('[邀请码] better-sqlite3 未安装，邀请码功能不可用（仅影响本地开发）');
}
import { mkdirSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置对象
const config = {
  port: parseInt(process.env.PORT || '8080'),
  password: process.env.PASSWORD || '',
  adminPassword: process.env.ADMINPASSWORD || '',
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  tmdbWorkerUrl: process.env.TMDB_WORKER_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2'),
  cacheMaxAge: process.env.CACHE_MAX_AGE || '1d',
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  debug: process.env.DEBUG !== 'false'
};

// ====== 本地邀请码数据库（better-sqlite3 模拟 D1）======

const INVITE_DB_PATH = process.env.INVITE_DB_PATH || './data/invite.db';
let inviteDb;

function initInviteDatabase() {
  if (!Database) return;
  const dbDir = path.dirname(INVITE_DB_PATH);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (e) { /* 目录已存在 */ }
  
  inviteDb = new Database(INVITE_DB_PATH);
  inviteDb.pragma('journal_mode = WAL');
  
  inviteDb.exec(`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      max_devices INTEGER NOT NULL DEFAULT 5
    );
    
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_fingerprint TEXT NOT NULL,
      browser TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      first_active_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY (code) REFERENCES invitation_codes(code)
    );
    
    CREATE INDEX IF NOT EXISTS idx_devices_code ON devices(code);
    CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(device_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active_at);
  `);
  // 兼容旧表：添加 remark 列（已存在则忽略）
  try { inviteDb.exec('ALTER TABLE invitation_codes ADD COLUMN remark TEXT DEFAULT "";'); } catch(e) {}
}

// 生成邀请码（与 Worker 端保持一致）
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function segment(len) {
    let s = '';
    const array = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      s += chars[array[i] % chars.length];
    }
    return s;
  }
  return `LELE-${segment(4)}-${segment(4)}`;
}

// 获取浏览器摘要
function getBrowserSummary(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg/')) return 'Edge';
  return 'Unknown';
}

// 验证管理员密码
function validateAdminPassword(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !config.password) return false;
  const expectedHash = crypto.createHash('sha256').update(config.password).digest('hex');
  return token === expectedHash;
}

// 日志记录函数
const log = (...args) => {
  if (config.debug) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
};

// 错误日志函数
const errorLog = (...args) => {
  console.error('[ERROR]', new Date().toISOString(), ...args);
};

const app = express();

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

function sha256Hash(input) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    resolve(hash.digest('hex'));
  });
}

// 读取当前版本号
async function getVersion() {
  try {
    const versionPath = join(__dirname, 'VERSION.txt');
    const version = await fs.readFile(versionPath, 'utf8');
    return version.trim();
  } catch {
    return '0';
  }
}

// 渲染页面并注入密码哈希、Worker URL、版本号
async function renderPage(filePath, password, adminPassword = '') {
  try {
    let content = await fs.readFile(filePath, 'utf8');

    // 注入用户密码
    if (password !== '') {
      const sha256 = await sha256Hash(password);
      content = content.replace('{{PASSWORD}}', sha256);
    } else {
      content = content.replace('{{PASSWORD}}', '');
    }

    // 注入管理员密码
    if (adminPassword !== '') {
      const adminSha256 = await sha256Hash(adminPassword);
      content = content.replace('{{ADMINPASSWORD}}', adminSha256);
    } else {
      content = content.replace('{{ADMINPASSWORD}}', '');
    }

    // 注入 TMDB Worker URL
    content = content.replace('{{TMDB_WORKER_URL}}', config.tmdbWorkerUrl);

    // 注入版本号
    const version = await getVersion();
    content = content.replace('{{LELETV_VERSION}}', version);

    return content;
  } catch (error) {
    errorLog('读取文件失败:', filePath, error);
    throw error;
  }
}

app.get(['/', '/index.html', '/player.html'], async (req, res) => {
  try {
    let filePath;
    switch (req.path) {
      case '/player.html':
        filePath = join(__dirname, 'player.html');
        break;
      default: // '/' 和 '/index.html'
        filePath = join(__dirname, 'index.html');
        break;
    }
    
    const content = await renderPage(filePath, config.password, config.adminPassword);
    res.send(content);
  } catch (error) {
      errorLog('页面渲染错误:', error);
      res.status(500).send('读取静态页面失败');
  }
});

app.get('/s=:keyword', async (req, res) => {
  try {
    const filePath = join(__dirname, 'index.html');
    const content = await renderPage(filePath, config.password, config.adminPassword);
    res.send(content);
  } catch (error) {
    errorLog('搜索页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ['http:', 'https:'];
    
    // 从环境变量获取阻止的主机名列表
    const blockedHostnames = (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(',');
    
    // 从环境变量获取阻止的 IP 前缀
    const blockedPrefixes = (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(',');
    
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (blockedHostnames.includes(parsed.hostname)) return false;
    
    for (const prefix of blockedPrefixes) {
      if (parsed.hostname.startsWith(prefix)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// 验证代理请求的鉴权
function validateProxyAuth(req) {
  const authHash = req.query.auth;
  const timestamp = req.query.t;
  
  // 获取服务器端密码哈希
  const serverPassword = config.password;
  
  // 在开发环境下，如果未设置密码，则允许访问
  if (!serverPassword) {
    console.log('开发环境：未设置 PASSWORD 环境变量，允许代理访问');
    return true;
  }
  
  // 使用 crypto 模块计算 SHA-256 哈希
  const serverPasswordHash = crypto.createHash('sha256').update(serverPassword).digest('hex');
  
  // 在开发环境下，简化鉴权逻辑
  if (config.debug && (!authHash || authHash !== serverPasswordHash)) {
    console.log('开发环境：密码哈希不匹配，但仍允许访问');
    console.log(`期望: ${serverPasswordHash}, 收到: ${authHash || '空'}`);
    return true;
  }
  
  if (!authHash || authHash !== serverPasswordHash) {
    console.warn('代理请求鉴权失败：密码哈希不匹配');
    console.warn(`期望: ${serverPasswordHash}, 收到: ${authHash}`);
    return false;
  }
  
  // 验证时间戳（10分钟有效期）
  if (timestamp) {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟
    if (now - parseInt(timestamp) > maxAge) {
      console.warn('代理请求鉴权失败：时间戳过期');
      return false;
    }
  }
  
  return true;
}

app.get('/proxy/:encodedUrl', async (req, res) => {
  try {
    // 验证鉴权
    if (!validateProxyAuth(req)) {
      return res.status(401).json({
        success: false,
        error: '代理访问未授权：请检查密码配置或鉴权参数'
      });
    }

    const encodedUrl = req.params.encodedUrl;
    const targetUrl = decodeURIComponent(encodedUrl);

    // 安全验证
    if (!isValidUrl(targetUrl)) {
      return res.status(400).send('无效的 URL');
    }

    log(`代理请求: ${targetUrl}`);

    // 添加请求超时和重试逻辑
    const maxRetries = config.maxRetries;
    let retries = 0;
    
    const makeRequest = async () => {
      try {
        return await axios({
          method: 'get',
          url: targetUrl,
          responseType: 'stream',
          timeout: config.timeout,
          headers: {
            'User-Agent': config.userAgent
          }
        });
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          log(`重试请求 (${retries}/${maxRetries}): ${targetUrl}`);
          return makeRequest();
        }
        throw error;
      }
    };

    const response = await makeRequest();

    // 转发响应头（过滤敏感头）
    const headers = { ...response.headers };
    const sensitiveHeaders = (
      process.env.FILTERED_HEADERS || 
      'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin'
    ).split(',');
    
    sensitiveHeaders.forEach(header => delete headers[header]);
    res.set(headers);

    // 管道传输响应流
    response.data.pipe(res);
  } catch (error) {
    errorLog('代理请求错误:', error.message);
    if (error.response) {
      res.status(error.response.status || 500);
      error.response.data.pipe(res);
    } else {
      res.status(500).send(`请求失败: ${error.message}`);
    }
  }
});

// TMDB API 代理
app.get('/api/tmdb', async (req, res) => {
  try {
    const endpoint = req.query.endpoint || '';
    if (!endpoint) {
      return res.status(400).json({ success: false, error: '缺少 TMDB 端点参数' });
    }

    // 如果配置了 Worker URL，则通过 Worker 转发请求
    if (config.tmdbWorkerUrl) {
      const workerUrl = new URL(config.tmdbWorkerUrl);
      for (const [key, value] of Object.entries(req.query)) {
        workerUrl.searchParams.set(key, value);
      }
      log(`TMDB 通过 Worker 代理: ${endpoint}`);

      const workerRes = await axios({
        method: 'get',
        url: workerUrl.toString(),
        timeout: config.timeout,
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'application/json'
        }
      });

      return res.json(workerRes.data);
    }

    // 没有 Worker URL 时，直接调用 TMDB API
    if (!config.tmdbApiKey) {
      return res.status(500).json({ success: false, error: 'TMDB API Key 未配置' });
    }

    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'endpoint') {
        queryParams.set(key, value);
      }
    }
    queryParams.set('api_key', config.tmdbApiKey);
    if (!queryParams.has('language')) {
      queryParams.set('language', 'zh-CN');
    }

    const targetUrl = `https://api.themoviedb.org/3/${endpoint}?${queryParams.toString()}`;
    log(`TMDB 直接代理: ${endpoint}`);

    const response = await axios({
      method: 'get',
      url: targetUrl,
      timeout: config.timeout,
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'application/json'
      }
    });

    if (endpoint === 'configuration' && response.data) {
      response.data.image_base_url = 'https://image.tmdb.org/t/p';
    }

    res.json(response.data);
  } catch (error) {
    errorLog('TMDB 代理请求错误:', error.message);
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        error: `TMDB API 错误: ${error.response.statusText}`,
        details: error.response.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: `TMDB 请求失败: ${error.message}`
      });
    }
  }
});

// 版本号 API
app.get('/api/version', async (req, res) => {
  try {
    const version = await getVersion();
    res.json({
      success: true,
      version,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '无法读取版本号' });
  }
});

// ====== 邀请码 API 路由（本地开发）======
// 数据库不可用时的降级响应
function inviteDbGuard(req, res, next) {
  if (!inviteDb) {
    return res.status(503).json({ ok: false, error: '邀请码数据库未初始化（需安装 better-sqlite3）' });
  }
  next();
}

// POST /api/invite/verify
app.post('/api/invite/verify', express.json(), inviteDbGuard, (req, res) => {
  try {
    const { code, device_name, device_fingerprint } = req.body;
    if (!code || !device_name || !device_fingerprint) {
      return res.status(400).json({ ok: false, error: '缺少必填参数' });
    }
    
    const invite = inviteDb.prepare('SELECT * FROM invitation_codes WHERE code = ?').get(code);
    if (!invite) return res.status(403).json({ ok: false, error: '邀请码无效' });
    if (!invite.is_active) return res.status(403).json({ ok: false, error: '邀请码已被禁用' });
    
    const existingDevice = inviteDb.prepare('SELECT * FROM devices WHERE device_fingerprint = ?').get(device_fingerprint);
    if (existingDevice) {
      inviteDb.prepare('UPDATE devices SET last_active_at = ?, ip_address = ?, browser = ?, device_name = ? WHERE id = ?')
        .run(Date.now(), req.ip, getBrowserSummary(req), device_name, existingDevice.id);
      return res.json({ ok: true, action: 'renewed', message: '欢迎回来' });
    }
    
    const deviceCount = inviteDb.prepare('SELECT COUNT(*) as count FROM devices WHERE code = ?').get(code);
    if (deviceCount.count >= invite.max_devices) {
      const oldest = inviteDb.prepare('SELECT id FROM devices WHERE code = ? ORDER BY last_active_at ASC LIMIT 1').get(code);
      if (oldest) inviteDb.prepare('DELETE FROM devices WHERE id = ?').run(oldest.id);
    }
    
    const now = Date.now();
    inviteDb.prepare('INSERT INTO devices (code, device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(code, device_name, device_fingerprint, getBrowserSummary(req), req.ip, now, now);
    
    const action = deviceCount.count >= invite.max_devices ? 'evicted' : 'registered';
    res.json({ ok: true, action, message: '验证成功' });
  } catch (error) {
    console.error('验证邀请码失败:', error);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// POST /api/invite/heartbeat
app.post('/api/invite/heartbeat', express.json(), inviteDbGuard, (req, res) => {
  try {
    const { device_fingerprint } = req.body;
    if (!device_fingerprint) return res.status(400).json({ ok: false, error: '缺少 device_fingerprint' });
    
    const info = inviteDb.prepare('UPDATE devices SET last_active_at = ? WHERE device_fingerprint = ?').run(Date.now(), device_fingerprint);
    res.json({ ok: true, updated: info.changes > 0 });
  } catch (error) {
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// POST /api/invite/generate
app.post('/api/invite/generate', express.json(), inviteDbGuard, (req, res) => {
  if (!validateAdminPassword(req)) return res.status(401).json({ ok: false, error: '管理员验证失败' });
  
  const remark = (req.body.remark || '').trim();
  
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateInviteCode();
    const existing = inviteDb.prepare('SELECT id FROM invitation_codes WHERE code = ?').get(code);
    if (!existing) break;
    code = null;
  }
  
  if (!code) return res.status(500).json({ ok: false, error: '生成失败' });
  
  inviteDb.prepare('INSERT INTO invitation_codes (code, created_at, remark) VALUES (?, ?, ?)').run(code, Date.now(), remark);
  res.json({ ok: true, code, remark, created_at: Date.now() });
});

// GET /api/invite/list
app.get('/api/invite/list', inviteDbGuard, (req, res) => {
  if (!validateAdminPassword(req)) return res.status(401).json({ ok: false, error: '管理员验证失败' });
  
  const codes = inviteDb.prepare(`SELECT ic.* FROM invitation_codes ic
    LEFT JOIN (SELECT code, MAX(last_active_at) as max_active FROM devices GROUP BY code) d ON ic.code = d.code
    ORDER BY COALESCE(d.max_active, ic.created_at) DESC`).all();
  const result = codes.map(invite => {
    const devices = inviteDb.prepare('SELECT device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at FROM devices WHERE code = ? ORDER BY last_active_at DESC').all(invite.code);
    return {
      code: invite.code,
      created_at: invite.created_at,
      is_active: !!invite.is_active,
      max_devices: invite.max_devices,
      remark: invite.remark || '',
      device_count: devices.length,
      devices
    };
  });
  
  res.json({ ok: true, codes: result });
});

// POST /api/invite/toggle
app.post('/api/invite/toggle', express.json(), inviteDbGuard, (req, res) => {
  if (!validateAdminPassword(req)) return res.status(401).json({ ok: false, error: '管理员验证失败' });
  
  const { code, is_active } = req.body;
  if (!code || typeof is_active !== 'boolean') return res.status(400).json({ ok: false, error: '缺少必填参数' });
  
  const info = inviteDb.prepare('UPDATE invitation_codes SET is_active = ? WHERE code = ?').run(is_active ? 1 : 0, code);
  res.json({ ok: true, updated: info.changes > 0 });
});

// GET /api/invite/stats
app.get('/api/invite/stats', inviteDbGuard, (req, res) => {
  if (!validateAdminPassword(req)) return res.status(401).json({ ok: false, error: '管理员验证失败' });
  
  const totalCodes = inviteDb.prepare('SELECT COUNT(*) as count FROM invitation_codes').get();
  const activeCodes = inviteDb.prepare('SELECT COUNT(*) as count FROM invitation_codes WHERE is_active = 1').get();
  const totalDevices = inviteDb.prepare('SELECT COUNT(*) as count FROM devices').get();
  
  res.json({ ok: true, total_codes: totalCodes.count, active_codes: activeCodes.count, total_devices: totalDevices.count });
});

// POST /api/invite/my-devices - 普通用户查询自己的设备
app.post('/api/invite/my-devices', express.json(), inviteDbGuard, (req, res) => {
  try {
    const { code, device_fingerprint } = req.body;
    if (!code || !device_fingerprint) return res.status(400).json({ ok: false, error: '缺少参数' });
    
    const device = inviteDb.prepare('SELECT id FROM devices WHERE code = ? AND device_fingerprint = ?').get(code, device_fingerprint);
    if (!device) return res.status(403).json({ ok: false, error: '验证失败' });
    
    const invite = inviteDb.prepare('SELECT * FROM invitation_codes WHERE code = ?').get(code);
    const devices = inviteDb.prepare('SELECT device_name, device_fingerprint, browser, ip_address, first_active_at, last_active_at FROM devices WHERE code = ? ORDER BY last_active_at DESC').all(code);
    
    res.json({
      ok: true,
      code: invite.code,
      created_at: invite.created_at,
      is_active: !!invite.is_active,
      max_devices: invite.max_devices,
      device_count: devices.length,
      devices
    });
  } catch (error) {
    console.error('查询设备失败:', error);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// POST /api/invite/remove-device - 删除设备
app.post('/api/invite/remove-device', express.json(), inviteDbGuard, (req, res) => {
  try {
    const { code, device_fingerprint, target_fingerprint } = req.body;
    if (!code || !target_fingerprint) return res.status(400).json({ ok: false, error: '缺少参数' });

    const isAdmin = validateAdminPassword(req);
    if (!isAdmin) {
      const device = inviteDb.prepare('SELECT id FROM devices WHERE code = ? AND device_fingerprint = ?').get(code, device_fingerprint);
      if (!device) return res.status(403).json({ ok: false, error: '无权限' });
    }

    const info = inviteDb.prepare('DELETE FROM devices WHERE code = ? AND device_fingerprint = ?').run(code, target_fingerprint);
    res.json({ ok: true, removed: info.changes > 0 });
  } catch (error) {
    console.error('删除设备失败:', error);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// POST /api/invite/delete-code - 删除邀请码（管理员专属）
app.post('/api/invite/delete-code', express.json(), inviteDbGuard, (req, res) => {
  try {
    if (!validateAdminPassword(req)) return res.status(403).json({ ok: false, error: '无权限' });

    const { code } = req.body;
    if (!code) return res.status(400).json({ ok: false, error: '缺少参数' });

    // 先删除关联设备，再删除邀请码
    inviteDb.prepare('DELETE FROM devices WHERE code = ?').run(code);
    const info = inviteDb.prepare('DELETE FROM invitation_codes WHERE code = ?').run(code);
    res.json({ ok: true, deleted: info.changes > 0 });
  } catch (error) {
    console.error('删除邀请码失败:', error);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// POST /api/invite/set-remark - 设置邀请码备注
app.post('/api/invite/set-remark', express.json(), inviteDbGuard, (req, res) => {
  if (!validateAdminPassword(req)) return res.status(401).json({ ok: false, error: '管理员验证失败' });
  
  const { code, remark } = req.body;
  if (!code) return res.status(400).json({ ok: false, error: '缺少 code' });
  
  inviteDb.prepare('UPDATE invitation_codes SET remark = ? WHERE code = ?').run(remark || '', code);
  res.json({ ok: true });
});

// POST /api/invite/rename-device - 重命名设备（同码用户可操作，仅限当前设备）
app.post('/api/invite/rename-device', express.json(), inviteDbGuard, (req, res) => {
  try {
    const { code, device_fingerprint, new_name } = req.body;
    if (!code || !device_fingerprint || !new_name) {
      return res.status(400).json({ ok: false, error: '缺少参数' });
    }

    // 仅允许操作同邀请码下的本设备
    const device = inviteDb.prepare('SELECT id FROM devices WHERE code = ? AND device_fingerprint = ?').get(code, device_fingerprint);
    if (!device) return res.status(403).json({ ok: false, error: '无权限' });

    const name = new_name.trim().slice(0, 30);
    if (!name) return res.status(400).json({ ok: false, error: '设备名不能为空' });

    inviteDb.prepare('UPDATE devices SET device_name = ? WHERE code = ? AND device_fingerprint = ?').run(name, code, device_fingerprint);
    res.json({ ok: true });
  } catch (error) {
    console.error('重命名设备失败:', error);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

app.use(express.static(join(__dirname), {
  maxAge: config.cacheMaxAge,
  setHeaders: function (res, path) {
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

app.use((err, req, res, next) => {
    errorLog('服务器错误:', err);
    res.status(500).send('服务器内部错误');
  });

app.use((req, res) => {
  res.status(404).send('页面未找到');
});

// 初始化邀请码数据库
initInviteDatabase();

// 启动服务器
app.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
  console.log('密码验证：用户登录密码' + (config.password !== '' ? '已设置' : '未设置'));
  if (config.tmdbWorkerUrl) {
    console.log('TMDB 代理：通过 Worker (' + config.tmdbWorkerUrl + ')');
  } else if (config.tmdbApiKey) {
    console.log('TMDB 代理：本地直连 (已配置 API Key)');
  } else {
    console.log('TMDB 代理：未配置，请设置 TMDB_API_KEY 环境变量');
  }
  if (config.debug) {
    console.log('调试模式已启用');
    console.log('配置:', { ...config, password: config.password ? '******' : '' });
  }
});
