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
  }
}

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
