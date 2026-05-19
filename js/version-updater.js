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
    const h = parseInt(rawVersion.substring(8, 10));
    const vYear = Math.max(1, (parseInt(y) - 2025) + 1);
    return `v${vYear}.${m}.${d}.${h}`;
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
  if (!btn) return;
  btn.textContent = text;
  if (text === '立即更新') {
    btn.classList.add('text-blue-400', 'hover:text-blue-300');
    btn.classList.remove('text-gray-400', 'hover:text-white');
  } else {
    btn.classList.remove('text-blue-400', 'hover:text-blue-300');
    btn.classList.add('text-gray-400', 'hover:text-white');
  }
}

function setStatusDot(color) {
  var dot = document.getElementById('statusDot');
  if (!dot) return;
  dot.className = 'status-dot status-dot-' + color;
}

async function checkUpdateFromApi() {
  try {
    const resp = await fetch('/api/version?_t=' + Date.now(), {
      method: 'GET',
      cache: 'no-store'
    });
    if (!resp.ok) {
      updateFooterBtn('检查失败');
      setStatusDot('red');
      return false;
    }
    const data = await resp.json();
    if (data.success && data.version && data.version !== '0') {
      const loadedVersion = window.__LELETV_VERSION__ || '0';
      if (data.version !== loadedVersion) {
        currentVersion = data.version;
        hasNewVersion = true;
        updateFooterBtn('立即更新');
        setStatusDot('red');
        return true;
      }
    }
    hasNewVersion = false;
    updateFooterBtn('最新版本');
    setStatusDot('green');
    return false;
  } catch (e) {
    updateFooterBtn('检查失败');
    setStatusDot('red');
    return false;
  }
}

function initFooterBtn() {
  var displayEl = document.getElementById('footerVersionDisplay');
  if (!displayEl) return;

  var versionSpan = document.createElement('span');
  versionSpan.id = 'footerVersionText';
  versionSpan.className = 'mr-1';
  var versionText = formatDisplayVersion(window.__LELETV_VERSION__);
  if (versionText) {
    versionSpan.textContent = versionText;
  }
  displayEl.appendChild(versionSpan);

  if (typeof window.versionUtils !== 'undefined' && typeof window.versionUtils.getLatestVersionFromChangelog === 'function') {
    window.versionUtils.getLatestVersionFromChangelog().then(function(semanticVersion) {
      if (semanticVersion) {
        versionSpan.textContent = semanticVersion;
      }
    });
  }

  var btn = document.createElement('button');
  btn.id = 'checkUpdateBtn';
  btn.className = 'text-gray-400 hover:text-white text-sm transition-colors bg-transparent border-0 cursor-pointer max-sm:text-xs';
  btn.textContent = hasNewVersion ? '立即更新' : '检测中...';
  displayEl.appendChild(btn);

  var dot = document.createElement('span');
  dot.id = 'statusDot';
  dot.className = 'status-dot status-dot-red';
  displayEl.appendChild(dot);

  btn.addEventListener('click', function() {
    if (hasNewVersion) {
      performUpdate();
    } else {
      btn.textContent = '检测中...';
      checkUpdateFromApi().then(function(found) {
        if (found) performUpdate();
      });
    }
  });

  checkUpdateFromApi();
}

function setupSwUpdateListener() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'SW_UPDATED' && !hasNewVersion) {
        currentVersion = event.data.version;
        hasNewVersion = true;
        updateFooterBtn('立即更新');
        setStatusDot('red');
      }
    });
  }
}

window.checkLeLeTVUpdate = function() {
  updateFooterBtn('检测中...');
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
