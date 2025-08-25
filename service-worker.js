const CACHE_NAME = 'leletv-cache-v1.0.4';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/password.js',
  '/js/search.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/douban.js',
  '/js/config.js',
  '/js/lazy-loading.js',
  '/js/loadBalancer.js',
  '/js/loadBalancerUI.js',
  '/js/proxy-auth.js',
  '/js/customer_site.js',
  '/js/version-check.js',
  '/js/index-page.js',
  '/js/pwa-register.js',
  '/manifest.json',
  '/image/logo.png',
  '/image/logo-black.png'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('缓存添加失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
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

// 网络优先策略
self.addEventListener('fetch', event => {
  // 对于API请求，使用网络优先策略
  if (event.request.url.includes('/proxy/') || 
      event.request.url.includes('api.php') ||
      event.request.url.includes('provide/vod')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 如果网络请求成功，更新缓存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // 如果网络请求失败，尝试从缓存获取
          return caches.match(event.request);
        })
    );
    return;
  }

  // 对于其他静态资源，使用缓存优先策略
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有，直接返回
        if (response) {
          return response;
        }
        // 否则发起网络请求
        return fetch(event.request);
      })
  );
});