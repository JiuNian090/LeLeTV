// LeLeTV - Hash routing module
// Extracted from index.html inline script
let currentPage = 'home';

function switchPage(a) {
  var h = a === 'home' ? '' : '#' + a;
  if (location.hash !== h) location.hash = h; else showPage(a);
}

function handleHashChange() { showPage(location.hash.slice(1) || 'home'); }

function showPage(n) {
  currentPage = n;
  function _apply() {
    document.querySelectorAll('.page-content').forEach(function(e) { e.classList.remove('active'); });
    var t = document.getElementById('page-' + n);
    if (t) t.classList.add("active");
    var m = document.querySelector('.main-container');
    if (m) m.setAttribute("data-page", n);
    updateNavButtons(n);
    handlePageLoad(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (document.startViewTransition) {
    document.startViewTransition(_apply);
  } else {
    _apply();
  }
}

function updateNavButtons(a) {
  document.querySelectorAll('.nav-btn[data-page]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-page') === a);
  });
}

function handlePageLoad(n) {
  switch(n) {
    case 'category': if (typeof initTmdbCategory === 'function') initTmdbCategory(); break;
    case 'history': if (typeof loadViewingHistory === 'function') loadViewingHistory(); break;
    case 'about': loadAboutPageChangelog(); break;
    case 'readme': loadReadmePage(); break;
  }
}

function loadReadmePage() {
  var content = document.getElementById('readmeContent');
  if (!content || content.getAttribute('data-loaded') === 'true') return;
  content.setAttribute('data-loaded', 'true');

  var loading = document.getElementById('readmeLoading');
  var error = document.getElementById('readmeError');

  loading.classList.remove('hidden');
  content.classList.add('hidden');
  error.classList.add('hidden');

  fetch('https://raw.githubusercontent.com/JiuNian090/LeLeTV/main/README.md')
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function(md) {
      if (typeof marked !== 'undefined') {
        content.innerHTML = marked.parse(md);
      } else {
        content.textContent = md;
      }
      loading.classList.add('hidden');
      content.classList.remove('hidden');
    })
    .catch(function() {
      loading.classList.add('hidden');
      error.classList.remove('hidden');
    });
}

document.addEventListener('click', function(e) {
  var retryBtn = e.target.closest('#retryReadmeBtn');
  if (retryBtn) {
    var content = document.getElementById('readmeContent');
    if (content) content.removeAttribute('data-loaded');
    loadReadmePage();
  }
});

function switchToAbout(s) {
  switchPage('about');
  if (s) setTimeout(function() {
    var el = document.getElementById(s);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function toggleHistory(e) { if (e) e.stopPropagation(); switchPage('history'); }
function toggleSettings(e) { if (e) e.stopPropagation(); switchPage('settings'); }
function focusSearch() { switchPage('home'); setTimeout(function() { var si = document.getElementById('searchInput'); if (si) si.focus(); }, 100); }

function loadAboutPageChangelog() {
  var ct = document.getElementById('aboutChangelogContent');
  if (!ct || ct.getAttribute('data-loaded') === 'true') return;
  ct.setAttribute('data-loaded', 'true');
  fetch('/CHANGELOG.md', { cache: 'no-store' })
    .then(function(r) { if (!r.ok) throw new Error('fail'); return r.text(); })
    .then(function(md) {
      var entries = parseChangelogMarkdown(md);
      ct.innerHTML = '';
      ct.appendChild(renderVersionHistory(entries));
    })
    .catch(function(e) {
      ct.innerHTML = '<div class="bg-red-900/30 border border-red-800/50 rounded-lg p-4 text-center mt-4"><p class="text-red-400 text-sm">\u52a0\u8f7d\u66f4\u65b0\u65e5\u5fd7\u5931\u8d25</p></div>';
    });
}

function parseChangelogMarkdown(md) {
  var entries = [], cur = null;
  md.split('\n').forEach(function(line) {
    if (line.indexOf('### ') === 0) {
      if (cur) entries.push(cur);
      cur = { version: '', date: '', content: '' };
      var m = line.match(/### (v[\d.]+) \(([\d\-:\s]+)\)/);
      if (m) { cur.version = m[1]; cur.date = m[2]; }
    } else if (line.indexOf('- ') === 0 && cur) {
      var t = line.match(/- \[(.*?)\] (.*?)$/);
      if (t) cur.content += '<p class="mb-1"><span class="text-green-400">[' + t[1] + ']</span> ' + t[2] + '</p>';
      else cur.content += '<p class="mb-1">' + line.substring(2) + '</p>';
    } else if (line.trim() !== '' && cur) {
      cur.content += '<p class="text-gray-400 text-sm mt-2">' + line + '</p>';
    }
  });
  if (cur) entries.push(cur);
  return entries;
}

function renderVersionHistory(entries) {
  var html = '<div class="changelog-timeline max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">';
  entries.forEach(function(e, i) {
    var latest = i === 0;
    html += '<div class="changelog-entry"><div class="timeline-marker"><div class="timeline-dot' + (latest ? ' latest' : '') + '"></div><div class="timeline-line"></div></div>';
    html += '<div class="timeline-content"><div class="entry-header"><span class="version-number">' + e.version + '</span>';
    if (latest) html += '<span class="latest-badge">\u6700\u65b0</span>';
    if (e.date) html += '<span class="version-date">' + e.date + '</span>';
    html += '</div><div class="entry-body">' + e.content + '</div></div></div>';
  });
  html += '</div>';
  var d = document.createElement('div');
  d.innerHTML = html;
  var container = d.firstElementChild;
  container.style.scrollbarWidth = 'thin';
  container.style.scrollbarColor = '#4B5563 transparent';
  return container;
}

function openDisclaimerModal() {
  document.getElementById('disclaimerModal').style.display = 'flex';
}

function closeDisclaimerModal() {
  localStorage.setItem('lastAcceptedDisclaimer', Date.now().toString());
  document.getElementById('disclaimerModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  AppInit.register('aurora', AppInit.PHASES.POST, function() {
    initAurora({ selector: '#auroraContainer', colorStops: ['#3A29FF', '#ec4899', '#FFD700'], amplitude: 0.45, blend: 0.6, speed: 0.35 });
  });
  AppInit.register('hash-routing', AppInit.PHASES.POST, function() {
    var initPage = location.hash.slice(1) || 'home';
    showPage(initPage);
    window.addEventListener('hashchange', handleHashChange);
  });
  AppInit.register('email-handler', AppInit.PHASES.POST, function() {
    if (typeof setupEmailClickHandlers === 'function') setupEmailClickHandlers();
  });
  AppInit.run();
});

window.currentPage = currentPage;
window.switchPage = switchPage;
window.handleHashChange = handleHashChange;
window.showPage = showPage;
window.switchToAbout = switchToAbout;
window.toggleHistory = toggleHistory;
window.toggleSettings = toggleSettings;
window.focusSearch = focusSearch;
window.openDisclaimerModal = openDisclaimerModal;
window.closeDisclaimerModal = closeDisclaimerModal;

// ===================== 移动端滑动手势 =====================
(function() {
  var startX, startY, startTime;
  var SWIPE_THRESHOLD = 60;    // px
  var VERTICAL_LIMIT = 30;     // px - 垂直偏移超过此值不触发水平滑动
  var MAX_TIME = 300;          // ms - 超过此时间不触发

  var pages = ['home', 'category', 'history', 'settings', 'about'];

  document.addEventListener('touchstart', function(e) {
    // 不在播放器页面或搜索输入框内触发
    if (e.target.closest('#player') || e.target.closest('#searchInput') || 
        e.target.closest('.art-controls') || e.target.closest('input, textarea, select')) {
      startX = null;
      return;
    }
    var t = e.changedTouches[0];
    startX = t.screenX;
    startY = t.screenY;
    startTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (startX === null) return;
    var t = e.changedTouches[0];
    var dx = t.screenX - startX;
    var dy = t.screenY - startY;
    var dt = Date.now() - startTime;

    // 垂直滑动太多或太慢，忽略
    if (Math.abs(dy) > VERTICAL_LIMIT || dt > MAX_TIME) {
      startX = null;
      return;
    }

    // 水平滑动距离不够
    if (Math.abs(dx) < SWIPE_THRESHOLD) {
      startX = null;
      return;
    }

    var curIdx = pages.indexOf(currentPage);
    if (curIdx === -1) { startX = null; return; }

    if (dx > 0) {
      // 右滑 → 上一页
      if (curIdx > 0) switchPage(pages[curIdx - 1]);
    } else {
      // 左滑 → 下一页
      if (curIdx < pages.length - 1) switchPage(pages[curIdx + 1]);
    }

    startX = null;
  }, { passive: true });
})();


// ===================== 全局错误边界 =====================
(function() {
  var reportedErrors = {};
  
  window.addEventListener("error", function(e) {
    // 过滤常见无害错误
    if (e.message && (
      e.message.indexOf("ResizeObserver") >= 0 ||
      e.message.indexOf("NetworkError") >= 0 ||
      e.message.indexOf("AbortError") >= 0 ||
      e.message.indexOf("Failed to fetch") >= 0
    )) return;
    
    var key = e.message + ":" + (e.filename || "");
    if (reportedErrors[key]) return;
    reportedErrors[key] = true;
    
    console.warn("[LeLeTV] 捕获错误:", e.message, e.filename, e.lineno);
  });
  
  window.addEventListener("unhandledrejection", function(e) {
    var msg = e.reason ? (e.reason.message || String(e.reason)) : "Unknown";
    console.warn("[LeLeTV] 未处理的 Promise 错误:", msg);
  });
})();
