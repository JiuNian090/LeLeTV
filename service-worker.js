// Service Worker 版本
const CACHE_VERSION = 'v1.2.0';
const CACHE_NAME = `leletv-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `leletv-runtime-cache-${CACHE_VERSION}`;

// 需要缓存的关键静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/player.html',
  '/watch.html',
  '/about.html',
  '/manifest.json',
  '/image/logo-black.png',
  '/image/logo.png',
  '/css/styles.css',
  '/css/index.css',
  '/css/player.css',
  '/css/watch.css',
  '/js/app.js',
  '/js/player.js',
  '/js/search.js',
  '/js/password.js',
  '/js/pwa-register.js',
  '/js/lazy-loading.js',
  '/js/loadBalancer.js',
  '/js/cache-manager.js',
  '/js/multi-level-cache.js',
  '/js/video-preloader.js'
];

// 关键资源使用缓存优先策略
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/image/logo-black.png',
  '/image/logo.png'
];

// 安装事件 - 预缓存关键静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 删除非当前版本的缓存
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 网络优先策略，但对静态资源使用缓存作为后备
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 对于API请求，使用缓存优先策略并设置较短的过期时间
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      handleApiRequest(request)
    );
    return;
  }
  
  // 对于关键资源，使用缓存优先策略
  if (isCriticalAsset(request)) {
    event.respondWith(
      handleCriticalAssetRequest(request)
    );
    return;
  }
  
  // 对于静态资源，使用缓存作为后备
  if (isStaticAsset(request)) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request);
      })
    );
  } else {
    // 对于其他资源，保持网络优先策略
    event.respondWith(
      fetch(request).catch(() => {
        // 检查运行时缓存
        return caches.open(RUNTIME_CACHE_NAME).then(cache => {
          return cache.match(request);
        });
      })
    );
  }
});

// 处理关键资源请求 - 缓存优先策略
async function handleCriticalAssetRequest(request) {
  // 首先检查缓存
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // 后台更新缓存
    event.waitUntil(
      fetch(request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          return cache.put(request, networkResponse.clone());
        });
      })
    );
    
    return cachedResponse;
  }
  
  // 缓存中没有则从网络获取
  try {
    const networkResponse = await fetch(request);
    
    // 缓存响应
    const responseToCache = networkResponse.clone();
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.put(request, responseToCache);
      })
    );
    
    return networkResponse;
  } catch (error) {
    // 网络请求失败，返回错误响应
    return new Response('网络请求失败，请检查您的网络连接', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// 处理API请求 - 使用缓存优先策略
async function handleApiRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  
  // 检查缓存中是否有请求结果
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // 检查缓存是否过期（5分钟）
    const cacheTime = cachedResponse.headers.get('sw-cache-time');
    if (cacheTime && (Date.now() - parseInt(cacheTime)) < 5 * 60 * 1000) {
      return cachedResponse;
    }
  }
  
  try {
    // 发起网络请求
    const networkResponse = await fetch(request);
    
    // 克隆响应以供缓存使用
    const responseToCache = networkResponse.clone();
    
    // 添加缓存时间戳
    const responseHeaders = new Headers(responseToCache.headers);
    responseHeaders.append('sw-cache-time', Date.now().toString());
    
    const cachedResponseWithHeaders = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers: responseHeaders
    });
    
    // 缓存响应
    cache.put(request, cachedResponseWithHeaders);
    
    return networkResponse;
  } catch (error) {
    // 网络请求失败，返回缓存的响应（即使过期）
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果没有缓存，返回错误响应
    return new Response('网络请求失败，请检查您的网络连接', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// 判断是否为关键资源
function isCriticalAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  return CRITICAL_ASSETS.some(asset => {
    const assetPath = new URL(asset, self.location).pathname;
    return pathname === assetPath;
  });
}

// 判断是否为静态资源
function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 检查是否为预定义的静态资源
  return STATIC_ASSETS.some(asset => {
    // 处理带查询参数的URL
    const assetPath = new URL(asset, self.location).pathname;
    return pathname === assetPath;
  }) || 
  // 或者检查文件扩展名
  pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/);
}