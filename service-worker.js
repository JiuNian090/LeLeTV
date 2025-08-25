// Service Worker 版本
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `leletv-cache-${CACHE_VERSION}`;

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
  '/js/pwa-register.js'
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
          if (cacheName !== CACHE_NAME) {
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
        // 如果网络请求失败，可以选择返回一个占位符或提示
        return new Response('网络请求失败，请检查您的网络连接', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
    );
  }
});

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