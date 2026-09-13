const LAST_VERSION_KEY = 'leletv_last_version';
const UPDATING_KEY = 'leletv_updating';

var hasNewVersion = false;
var latestChangelogVersion = null;

function formatDisplayVersion(rawVersion) {
  if (!rawVersion || rawVersion === '0') return '';
  if (rawVersion.startsWith('{{')) return '';
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

/** 从 VERSION.txt 获取最新版本号 */
async function getChangelogVersion() {
  try {
    var resp = await fetch('/VERSION.txt', { cache: 'no-store' });
    if (!resp.ok) return null;
    var text = await resp.text();
    var rawVersion = text.trim();
    if (!rawVersion) return null;
    return formatDisplayVersion(rawVersion);
  } catch (e) {
    return null;
  }
}

/** 核心：对比 VERSION.txt 版本与 localStorage 记录 */
async function checkForUpdates() {
  var changelogVersion = await getChangelogVersion();
  if (!changelogVersion) {
    updateFooterBtn('检查失败');
    setStatusDot('red');
    return false;
  }

  latestChangelogVersion = changelogVersion;
  var lastVersion = localStorage.getItem(LAST_VERSION_KEY);

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

function initFooterBtn() {
  var displayEl = document.getElementById('footerVersionDisplay');
  if (!displayEl) return;

  var versionSpan = document.createElement('span');
  versionSpan.id = 'footerVersionText';
  versionSpan.className = 'mr-1';
  var storedVersion = localStorage.getItem(LAST_VERSION_KEY);
  if (storedVersion) {
    versionSpan.textContent = storedVersion;
  } else {
    var versionText = formatDisplayVersion(window.__LELETV_VERSION__);
    if (versionText) {
      versionSpan.textContent = versionText;
    }
  }
  displayEl.appendChild(versionSpan);

  var btn = document.createElement('button');
  btn.id = 'checkUpdateBtn';
  btn.className = 'text-gray-400 hover:text-white text-sm transition-colors bg-transparent border-0 cursor-pointer max-sm:text-xs';
  btn.textContent = '检测中...';
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
      checkForUpdates().then(function(found) {
        if (found) performUpdate();
      });
    }
  });

  checkForUpdates();
}

function setupSwUpdateListener() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'SW_UPDATED' && !hasNewVersion) {
        hasNewVersion = true;
        updateFooterBtn('立即更新');
        setStatusDot('red');
      }
    });
  }
}

window.checkLeLeTVUpdate = function() {
  updateFooterBtn('检测中...');
  checkForUpdates().then(function(found) {
    if (found) performUpdate();
  });
};

document.addEventListener('DOMContentLoaded', function() {
  initFooterBtn();
  setupSwUpdateListener();
});

/* ==================== 版本更新弹窗 ==================== */

var _updateModalBound = false;

/** 拉取并解析 CHANGELOG.md（复用 app-routing.js 的解析器，同一 bundle 内） */
async function fetchChangelogEntries() {
  try {
    var resp = await fetch('/CHANGELOG.md', { cache: 'no-store' });
    if (!resp.ok) return [];
    var md = await resp.text();
    if (typeof parseChangelogMarkdown !== 'function') return [];
    return parseChangelogMarkdown(md) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 取「当前版本 → 新版本」之间的所有条目：CHANGELOG 为新→旧排列，
 * 因此返回的列表天然是新版本在第一个。
 * 边界取上次进站记录的版本号，命中的那条本身不列出（其内容用户已见过）。
 */
function pickNewEntries(entries, lastVersion) {
  if (!entries || !entries.length) return [];

  if (lastVersion) {
    // ① 常规：localStorage 记录的是版本号（如 v3.4.0），命中即返回它之前的全部条目
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].version === lastVersion) return entries.slice(0, i);
    }

    // ② 遗留格式兜底：早期版本号形如时间戳（YYYYMMDDHHmm），按发布日期切分
    var digits = String(lastVersion).replace(/[^0-9]/g, '');
    if (digits.length >= 8) {
      var cutoff = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6, 8);
      var newer = entries.filter(function (e) {
        return e.date && e.date.slice(0, 10) >= cutoff;
      });
      if (newer.length && newer.length < entries.length) return newer;
    }
  }

  // ③ 兜底：边界无法识别时给出最近若干条，而不是只给一条
  return entries.slice(0, 3);
}

/** 渲染新版本日志（卡片内的版本条目） */
function renderUpdateLog(entries) {
  var html = '';
  entries.forEach(function (e) {
    html += '<div class="update-log-entry">';
    html += '<div class="update-log-head"><span class="update-log-version">' + e.version + '</span>';
    if (e.date) html += '<span class="update-log-date">' + e.date + '</span>';
    html += '</div><div class="update-log-body">' + e.content + '</div></div>';
  });
  return html;
}

/** 绑定「更新版本」按钮（只绑一次）；有更新时必须点更新进入网站，遮罩不提供关闭 */
function bindUpdateModal() {
  if (_updateModalBound) return;
  var modal = document.getElementById('updateModal');
  if (!modal) return;
  _updateModalBound = true;

  var btn = document.getElementById('updateModalBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = '更新中...';
      performUpdate();
    });
  }
}

/** 等启动占位（#bootSplash，z-index 9999）退场后再显示弹窗，避免卡片入场动画被盖在下面空放 */
function whenBootSplashGone(cb) {
  var splash = document.getElementById('bootSplash');
  if (!splash || splash.classList.contains('boot-splash--done')) { cb(); return; }

  var fired = false;
  var fire = function () {
    if (fired) return;
    fired = true;
    splash.removeEventListener('transitionend', onEnd);
    cb();
  };
  var onEnd = function (e) {
    if (e.propertyName === 'opacity') fire();
  };
  splash.addEventListener('transitionend', onEnd);
  setTimeout(fire, 6000); // 兜底：启动引擎异常时也不至于永不弹窗
}

/** 邀请码验证通过之前一直挂起；已登录（localStorage 有 auth）则立即回调 */
function whenAuthed(cb) {
  if (window.INVITE_AUTH && typeof window.INVITE_AUTH.isVerified === 'function' && window.INVITE_AUTH.isVerified()) {
    cb();
    return;
  }

  var onAuthed = function () {
    document.removeEventListener('inviteVerified', onAuthed);
    document.removeEventListener('passwordVerified', onAuthed);
    cb();
  };
  document.addEventListener('inviteVerified', onAuthed);
  document.addEventListener('passwordVerified', onAuthed);
}

/**
 * 进入网站的最早时刻：邀请码验证通过 + 启动占位（#bootSplash）退场。
 * 邀请码登录优先于任何弹窗 —— 未登录时后续的隐私政策、更新弹窗都不会出现。
 */
function whenEnteringSite(cb) {
  whenAuthed(function () { whenBootSplashGone(cb); });
}

/**
 * 更新弹窗的显示时机：进入网站（见 whenEnteringSite）之后，
 * 再等本次要确认的隐私政策点过「我已知晓」（等 disclaimerAccepted；无需确认则直接通过）
 */
function whenHomeReady(cb) {
  var fired = false;
  var disclaimerOk = !(window.LELETV_DISCLAIMER && window.LELETV_DISCLAIMER.pending && !window.LELETV_DISCLAIMER.handled);

  var maybeFire = function () {
    if (fired || !disclaimerOk) return;
    fired = true;
    document.removeEventListener('disclaimerAccepted', onDisclaimerAccepted);
    cb();
  };
  var onDisclaimerAccepted = function () { disclaimerOk = true; maybeFire(); };

  if (!disclaimerOk) {
    document.addEventListener('disclaimerAccepted', onDisclaimerAccepted);
  }
  whenEnteringSite(maybeFire);
}

/** 弹出更新弹窗：卡片先出现，新版本日志异步填充 */
async function showUpdateModal(newVersion, oldVersion) {
  var modal = document.getElementById('updateModal');
  if (!modal) return; // 播放页等没有弹窗的环境直接跳过

  var versionEl = document.getElementById('updateModalVersion');
  var logEl = document.getElementById('updateModalLog');

  if (versionEl) versionEl.textContent = oldVersion ? oldVersion + ' → ' + newVersion : newVersion;
  if (logEl) logEl.innerHTML = '<p>正在加载更新内容…</p>';

  bindUpdateModal();
  whenHomeReady(function () { modal.style.display = 'flex'; });

  var entries = await fetchChangelogEntries();
  var list = pickNewEntries(entries, oldVersion);

  // 新版本恒定排第一个：CHANGELOG 尚未收录该版本时补一条占位，避免首条是次新版本
  if (newVersion && (list.length === 0 || list[0].version !== newVersion)) {
    list = [{ version: newVersion, date: '', content: '<p>详细说明见站内「关于 → 更新日志」。</p>' }].concat(list);
  }

  if (logEl) {
    logEl.innerHTML = list.length
      ? renderUpdateLog(list)
      : '<p>' + newVersion + ' 已发布，更新后可获得最新体验。</p>';
  }
}

/** 进站检测：VERSION.txt 与本地记录不一致时弹窗（首次访问不打扰） */
async function checkAndPromptUpdate() {
  if (!document.getElementById('updateModal')) return; // 无弹窗的环境（如播放页）不参与检测

  var latest = await getChangelogVersion();
  if (!latest) return;

  var lastVersion = localStorage.getItem(LAST_VERSION_KEY);
  if (!lastVersion || lastVersion === latest) return;

  latestChangelogVersion = latest;
  hasNewVersion = true;
  showUpdateModal(latest, lastVersion);
}

document.addEventListener('DOMContentLoaded', function() {
  checkAndPromptUpdate();
});
