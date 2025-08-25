// 不使用缓存，直接通过网络获取资源
self.addEventListener('install', event => {
  self.skipWaiting();
});


self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// 网络优先策略，不使用缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
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
});