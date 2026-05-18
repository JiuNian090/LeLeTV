const VERSION_CHECK_INTERVAL = 30 * 60 * 1000;
const LAST_VERSION_KEY = 'leletv_last_version';
const UPDATING_KEY = 'leletv_updating';

let currentVersion = window.__LELETV_VERSION__ || '0';
let lastKnownVersion = localStorage.getItem(LAST_VERSION_KEY) || currentVersion;

function isNewVersion() {
  return currentVersion && currentVersion !== '0' && currentVersion !== lastKnownVersion;
}

async function clearAllCaches() {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (e) {
      // 缓存清理失败时继续执行
    }
  }
}

async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => {
        reg.unregister();
        return true;
      }));
    } catch (e) {
      // 注销失败时继续
    }
  }
}

async function sendClearCacheMessage() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), 3000);
      const handler = event => {
        if (event.data && event.data.type === 'CACHES_CLEARED') {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve(true);
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
    });
  }
  return false;
}

async function performUpdate() {
  if (localStorage.getItem(UPDATING_KEY) === 'true') return;
  localStorage.setItem(UPDATING_KEY, 'true');

  if (typeof showToast === 'function') {
    showToast('发现新版本，正在更新...', 'info');
  }

  localStorage.setItem(LAST_VERSION_KEY, currentVersion);

  await sendClearCacheMessage();
  await clearAllCaches();
  await unregisterServiceWorker();

  setTimeout(() => {
    localStorage.removeItem(UPDATING_KEY);
    window.location.reload();
  }, 800);
}

function checkVersionOnPageLoad() {
  if (isNewVersion()) {
    performUpdate();
  } else {
    localStorage.setItem(LAST_VERSION_KEY, currentVersion);
  }
}

async function checkVersionFromApi() {
  try {
    const resp = await fetch('/api/version?_t=' + Date.now(), {
      method: 'GET',
      cache: 'no-store'
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.success && data.version && data.version !== lastKnownVersion) {
      currentVersion = data.version;
      performUpdate();
    }
  } catch (e) {
    // 网络不可用时忽略
  }
}

function startPeriodicCheck() {
  setInterval(() => {
    checkVersionFromApi();
  }, VERSION_CHECK_INTERVAL);
}

function manualCheckUpdate() {
  checkVersionFromApi().then(() => {
    if (!isNewVersion() && typeof showToast === 'function') {
      showToast('已是最新版本', 'success');
    }
  });
}

window.checkLeLeTVUpdate = manualCheckUpdate;

document.addEventListener('DOMContentLoaded', () => {
  checkVersionOnPageLoad();
  startPeriodicCheck();
});