const LAST_VERSION_KEY = 'leletv_last_version';
const UPDATING_KEY = 'leletv_updating';

let currentVersion = window.__LELETV_VERSION__ || '0';
let lastKnownVersion = localStorage.getItem(LAST_VERSION_KEY) || '0';
let hasNewVersion = currentVersion !== '0' && currentVersion !== lastKnownVersion;

function formatDisplayVersion(rawVersion) {
  if (!rawVersion || rawVersion === '0') return '';
  if (rawVersion.length >= 12) {
    const y = rawVersion.substring(0, 4);
    const m = parseInt(rawVersion.substring(4, 6));
    const d = parseInt(rawVersion.substring(6, 8));
    const vYear = Math.max(1, (parseInt(y) - 2025) + 1);
    return `v${vYear}.${m}.${d}`;
  }
  if (rawVersion.startsWith('v')) return rawVersion;
  return `v${rawVersion}`;
}

async function clearAllCaches() {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (e) {}
  }
}

async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    } catch (e) {}
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

  updateFooterBtn('更新中...');

  localStorage.setItem(LAST_VERSION_KEY, currentVersion);

  await sendClearCacheMessage();
  await clearAllCaches();
  await unregisterServiceWorker();

  setTimeout(() => {
    localStorage.removeItem(UPDATING_KEY);
    window.location.reload();
  }, 800);
}

function updateFooterBtn(text) {
  const btn = document.getElementById('checkUpdateBtn');
  if (btn) btn.textContent = text;
}

async function checkUpdateFromApi() {
  try {
    const resp = await fetch('/api/version?_t=' + Date.now(), {
      method: 'GET',
      cache: 'no-store'
    });
    if (!resp.ok) {
      updateFooterBtn('检查失败');
      return false;
    }
    const data = await resp.json();
    if (data.success && data.version && data.version !== lastKnownVersion && data.version !== '0') {
      currentVersion = data.version;
      hasNewVersion = true;
      updateFooterBtn('点击更新');
      return true;
    }
    hasNewVersion = false;
    updateFooterBtn('已是最新');
    return false;
  } catch (e) {
    updateFooterBtn('检查失败');
    return false;
  }
}

function initFooterBtn() {
  var linkEl = document.getElementById('footer-changelog-link');
  if (!linkEl) return;

  if (hasNewVersion) {
    linkEl.insertAdjacentHTML('beforebegin',
      '<button id="checkUpdateBtn" class="text-blue-400 hover:text-blue-300 text-sm transition-colors bg-transparent border-0 cursor-pointer">点击更新</button>'
    );
  } else if (lastKnownVersion && lastKnownVersion !== '0') {
    linkEl.insertAdjacentHTML('beforebegin',
      '<button id="checkUpdateBtn" class="text-gray-400 hover:text-white text-sm transition-colors bg-transparent border-0 cursor-pointer">已是最新</button>'
    );
  } else {
    linkEl.insertAdjacentHTML('beforebegin',
      '<button id="checkUpdateBtn" class="text-gray-400 hover:text-white text-sm transition-colors bg-transparent border-0 cursor-pointer">检查更新</button>'
    );
  }

  var btn = document.getElementById('checkUpdateBtn');
  if (!btn) return;

  btn.addEventListener('click', function() {
    updateFooterBtn('检查中...');
    if (hasNewVersion) {
      performUpdate();
    } else {
      checkUpdateFromApi().then(function(found) {
        if (found) {
          performUpdate();
        }
      });
    }
  });
}

function setupSwUpdateListener() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'SW_UPDATED' && !hasNewVersion) {
        currentVersion = event.data.version;
        hasNewVersion = true;
        updateFooterBtn('点击更新');
      }
    });
  }
}

window.checkLeLeTVUpdate = function() {
  updateFooterBtn('检查中...');
  checkUpdateFromApi().then(function(found) {
    if (found) {
      performUpdate();
    }
  });
};

document.addEventListener('DOMContentLoaded', function() {
  initFooterBtn();
  setupSwUpdateListener();
});