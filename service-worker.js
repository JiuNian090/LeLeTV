// Service Worker 版本
const CACHE_VERSION = 'v2.7.3';
const CACHE_NAME = `leletv-cache-${CACHE_VERSION}`;
const CACHE_API = `leletv-api-${CACHE_VERSION}`;
const CACHE_IMAGES = `leletv-images-${CACHE_VERSION}`;

const CURRENT_CACHE_NAMES = [CACHE_NAME, CACHE_API, CACHE_IMAGES];

// 需要缓存的关键静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/player.html',
  '/manifest.json',
  '/image/logo-black.png',
  '/image/logo.png',
  '/css/output.css',
  '/css/styles.css',

  '/css/player.css',
  '/js/config.js',
  '/js/api-config.js',
  '/js/proxy-auth.js',
  '/js/loadBalancer.js',
  '/js/ui.js',
  '/js/api.js',
  '/js/password.js',
  '/js/search.js',
  '/js/tmdb.js',
  '/js/player-bridge.js',
  '/js/app.js',
  '/js/player.js',
  '/js/version-utils.js',
  '/js/version-updater.js',
  '/js/cache-manager.js'
];

// 最大缓存条目数限制
const MAX_CACHE_ITEMS = {
  [CACHE_API]: 50,      // API 代理响应最多缓存 50 条
  [CACHE_IMAGES]: 100   // 图片最多缓存 100 张
};

// 安装事件 - 预缓存关键静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存并通知客户端
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!CURRENT_CACHE_NAMES.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// 网络优先策略，自动缓存成功响应
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    // 只缓存成功的响应
    if (response.ok || response.type === 'opaqueredirect') {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      // 缓存前检查并清理
      await trimCache(cacheName, MAX_CACHE_ITEMS[cacheName] || 50);
      cache.put(request, clone);
    }
    return response;
  } catch (err) {
    // 网络失败时从缓存读取
    const cached = await caches.match(request);
    if (cached) return cached;
    // 没有缓存，返回离线提示
    return new Response(
      JSON.stringify({ success: false, error: '网络不可用，请检查连接后重试' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 缓存优先策略（用于图片等变化不频繁的资源）
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      await trimCache(cacheName, MAX_CACHE_ITEMS[cacheName] || 100);
      cache.put(request, clone);
    }
    return response;
  } catch (err) {
    // 图片加载失败时返回透明占位
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect fill="#1a1a1a" width="300" height="450"/><text fill="#555" font-size="14" text-anchor="middle" x="150" y="225">加载失败</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// 限制缓存条目数量 - 移除最旧的条目
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // 删除最旧的条目，直到低于上限
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

// 判断请求是否应该被缓存
function isCacheableRequest(request) {
  // 只缓存 GET 请求
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  // 不缓存 Chrome 扩展等内部请求
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return true;
}

// 拦截 fetch 请求
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 只处理同源请求（外域图片、API 等通过代理走同源）
  // 代理请求：网络优先策略，缓存代理响应
  if (pathname.startsWith('/proxy/')) {
    if (isCacheableRequest(request)) {
      event.respondWith(networkFirstWithCache(request, CACHE_API));
    }
    return;
  }

  // 外部图片（通过代理加载的图片）
  if (pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/i)) {
    if (isCacheableRequest(request)) {
      event.respondWith(cacheFirst(request, CACHE_IMAGES));
    }
    return;
  }

  // 静态资源：网络优先，缓存后备
  if (isStaticAsset(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // 更新缓存中的静态资源
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => {
          // 如果缓存也没有，返回自定义离线页
          return cached || new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LeLeTV - 离线</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#000;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;text-align:center;padding:20px}h1{font-size:2rem;margin-bottom:1rem}p{color:#999;line-height:1.6}</style></head><body><div><h1>📡 网络已断开</h1><p>LeLeTV 需要网络连接才能搜索和播放视频<br>请检查网络后刷新页面</p></div></body></html>`,
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }))
    );
    return;
  }

  // 其他请求：正常网络请求
  event.respondWith(
    fetch(request).catch(() => {
      // 尝试从缓存中匹配
      return caches.match(request).then(cached => {
        if (cached) return cached;
        // 如果是 HTML 页面请求，返回缓存中的首页作为离线页
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('/').then(homePage => {
            return homePage || new Response('网络请求失败', { status: 503 });
          });
        }
        return new Response('网络请求失败', { status: 503 });
      });
    })
  );
});

// 判断是否为静态资源
function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 检查是否为预定义的静态资源
  if (STATIC_ASSETS.some(asset => {
    const assetPath = new URL(asset, self.location).pathname;
    return pathname === assetPath;
  })) return true;

  // 检查文件扩展名
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?|ttf|eot)$/)) return true;

  return false;
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }).then(() => {
        if (event.source && event.source.postMessage) {
          event.source.postMessage({
            type: 'CACHES_CLEARED'
          });
        }
      })
    );
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
