/**
 * 版本号显示 + 检查更新模块
 *
 * 在页脚显示当前版本号，检测 VERSION.txt 是否有新版本。
 * 若有新版本，显示"立即更新"按钮，点击后清缓存 + 刷新。
 */

const LAST_VERSION_KEY = 'leletv_last_version';
const UPDATING_KEY = 'leletv_updating';

let hasNewVersion = false;
let latestChangelogVersion: string | null = null;

function formatDisplayVersion(rawVersion: string): string {
  if (!rawVersion || rawVersion === '0') return '';
  if (rawVersion.startsWith('{{')) return '';
  if (rawVersion.startsWith('v')) return rawVersion;
  return `v${rawVersion}`;
}

async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch { /* 静默 */ }
  }
}

async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch { /* 静默 */ }
  }
}

async function sendClearCacheMessage(): Promise<boolean> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const swController = navigator.serviceWorker.controller;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      const handler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'CACHES_CLEARED') {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve(true);
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      swController.postMessage({ type: 'CLEAR_ALL_CACHES' });
    });
  }
  return false;
}

async function performUpdate(): Promise<void> {
  if (localStorage.getItem(UPDATING_KEY) === 'true') return;
  localStorage.setItem(UPDATING_KEY, 'true');

  updateFooterBtn('更新中...');

  if (latestChangelogVersion) {
    localStorage.setItem(LAST_VERSION_KEY, latestChangelogVersion);
  }

  await sendClearCacheMessage();
  await clearAllCaches();
  await unregisterServiceWorker();

  setTimeout(() => {
    localStorage.removeItem(UPDATING_KEY);
    window.location.href = '/?_=' + Date.now();
  }, 800);
}

function updateFooterBtn(text: string): void {
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

function setStatusDot(color: string): void {
  const dot = document.getElementById('statusDot');
  if (!dot) return;
  dot.className = 'status-dot status-dot-' + color;
}

/** 从 VERSION.txt 获取最新版本号 */
async function getChangelogVersion(): Promise<string | null> {
  try {
    const resp = await fetch('/VERSION.txt', { cache: 'no-store' });
    if (!resp.ok) return null;
    const text = await resp.text();
    const rawVersion = text.trim();
    if (!rawVersion) return null;
    return formatDisplayVersion(rawVersion);
  } catch {
    return null;
  }
}

/** 对比 VERSION.txt 版本与 localStorage 记录 */
async function checkForUpdates(): Promise<boolean> {
  const changelogVersion = await getChangelogVersion();
  if (!changelogVersion) {
    updateFooterBtn('检查失败');
    setStatusDot('red');
    return false;
  }

  latestChangelogVersion = changelogVersion;
  const lastVersion = localStorage.getItem(LAST_VERSION_KEY);

  if (!lastVersion) {
    localStorage.setItem(LAST_VERSION_KEY, changelogVersion);
    hasNewVersion = false;
    updateFooterBtn('最新版本');
    setStatusDot('green');
    return false;
  }

  if (changelogVersion !== lastVersion) {
    hasNewVersion = true;
    updateFooterBtn('立即更新');
    setStatusDot('red');
    return true;
  }

  hasNewVersion = false;
  updateFooterBtn('最新版本');
  setStatusDot('green');
  return false;
}

export function initFooterVersion(): void {
  const displayEl = document.getElementById('footerVersionDisplay');
  if (!displayEl) return;

  // 版本号文字
  const versionSpan = document.createElement('span');
  versionSpan.id = 'footerVersionText';
  versionSpan.className = 'mr-1';
  const storedVersion = localStorage.getItem(LAST_VERSION_KEY);
  if (storedVersion) {
    versionSpan.textContent = storedVersion;
  } else {
    const versionText = formatDisplayVersion((window as any).__LELETV_VERSION__ || '');
    if (versionText) {
      versionSpan.textContent = versionText;
    }
  }
  displayEl.appendChild(versionSpan);

  // 检查更新按钮
  const btn = document.createElement('button');
  btn.id = 'checkUpdateBtn';
  btn.className =
    'text-gray-400 hover:text-white text-sm transition-colors bg-transparent border-0 cursor-pointer max-sm:text-xs';
  btn.textContent = '检测中...';
  displayEl.appendChild(btn);

  // 状态圆点
  const dot = document.createElement('span');
  dot.id = 'statusDot';
  dot.className = 'status-dot status-dot-red';
  displayEl.appendChild(dot);

  // 点击事件
  btn.addEventListener('click', () => {
    if (hasNewVersion) {
      performUpdate();
    } else {
      btn.textContent = '检测中...';
      checkForUpdates().then((found) => {
        if (found) performUpdate();
      });
    }
  });

  // 开始检测
  checkForUpdates();
}

function setupSwUpdateListener(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_UPDATED' && !hasNewVersion) {
        hasNewVersion = true;
        updateFooterBtn('立即更新');
        setStatusDot('red');
      }
    });
  }
}

// 暴露全局检查更新函数（供第三方调用）
(window as any).checkLeLeTVUpdate = function (): void {
  updateFooterBtn('检测中...');
  checkForUpdates().then((found) => {
    if (found) performUpdate();
  });
};

// DOMContentLoaded 后初始化
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initFooterVersion();
      setupSwUpdateListener();
    });
  } else {
    initFooterVersion();
    setupSwUpdateListener();
  }
}
