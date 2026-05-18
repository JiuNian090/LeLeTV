import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';

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
