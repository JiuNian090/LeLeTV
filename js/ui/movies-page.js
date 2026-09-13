// LeLeTV — 影片结果页（搜索 / 类别统一入口）
// 桌面端/横屏：左侧源列表（全部 + 各源，按负载均衡快慢排序）+ 右侧结果网格
// 移动端/竖屏：源列表降级为横向滑动 chips
// 类别入口采用混合策略：先按影片名关键词搜索，全部无结果时按分类拉取兜底

// 页面状态（app-search.js 也会读取）
let _moviesState = {
  keyword: '',
  results: [],
  activeSource: 'all',
  from: 'home',            // home | category —— 决定返回按钮去向
  fallbackGenres: [],      // 类别入口携带的 TMDB 类型（用于分类兜底）
  mode: 'empty',           // loading | search | fallback | empty
  loading: false
};

// 并发纪元：搜索与类别入口共用同一结果页，后发起者作废仍在途的旧加载管道
// （例如：搜索 A 尚未完成时从类别进入 B，A 的迟到结果不得覆盖 B）
let _moviesEpoch = 0;

// TMDB 类型名 → 各采集站常见分类别名（分类兜底时按序尝试）
const GENRE_CLASS_ALIASES = {
  '动作':   ['动作片', '动作'],
  '冒险':   ['冒险片', '冒险'],
  '动画':   ['动漫', '动画片', '动画'],
  '喜剧':   ['喜剧片', '喜剧'],
  '犯罪':   ['犯罪片', '犯罪'],
  '剧情':   ['剧情片', '剧情'],
  '奇幻':   ['奇幻片', '奇幻'],
  '恐怖':   ['恐怖片', '恐怖'],
  '爱情':   ['爱情片', '爱情'],
  '科幻':   ['科幻片', '科幻'],
  '惊悚':   ['惊悚片', '惊悚'],
  '战争':   ['战争片', '战争'],
  '悬疑':   ['悬疑片', '悬疑'],
  '纪录':   ['纪录片', '纪录'],
  '家庭':   ['家庭片', '家庭'],
  '音乐':   ['音乐片', '音乐'],
  '历史':   ['历史片', '历史'],
  '西部':   ['西部片', '西部'],
  '真人秀': ['综艺', '真人秀'],
  '脱口秀': ['综艺', '脱口秀']
};

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _isValidSource(id) {
  if (id.indexOf('custom_') === 0) {
    var i = parseInt(id.replace('custom_', ''), 10);
    return i >= 0 && i < customAPIs.length;
  }
  return !!API_SITES[id];
}

// 源排序规则：与搜索页一致 —— 负载均衡平均响应时间短的（快源）在前
function _orderSourcesByLoad(ids) {
  var stats = window.loadBalancer ? window.loadBalancer.apiStats : null;
  return ids.slice().sort(function (a, b) {
    var sa = stats && stats.get(a) ? (stats.get(a).averageResponseTime || 9999) : 9999;
    var sb = stats && stats.get(b) ? (stats.get(b).averageResponseTime || 9999) : 9999;
    return sa - sb;
  });
}

// 结果排序统一到 search-cards.js 的 _sortResultsByLatencyThenName：
// 源本次搜索延迟升序 → 片名(去季/部/集) → 季序 → 源名

function _getSourceCounts(results) {
  var counts = {};
  results.forEach(function (r) {
    counts[r.source_code] = (counts[r.source_code] || 0) + 1;
  });
  return counts;
}

// ===================== 顶部栏 =====================

function renderMoviesPageHeader() {
  var t = document.getElementById('moviesTitle');
  var s = document.getElementById('moviesSubtitle');
  if (t) t.textContent = _moviesState.keyword || '';
  if (!s) return;
  var n = _moviesState.results.length;
  var srcCount = 0;
  if (n > 0) {
    var seen = {};
    _moviesState.results.forEach(function (r) { seen[r.source_code] = 1; });
    srcCount = Object.keys(seen).length;
  }
  switch (_moviesState.mode) {
    case 'loading': s.textContent = '正在搜索…'; break;
    case 'fallback': s.textContent = '关键词未找到，正在按分类查找…'; break;
    case 'empty': s.textContent = '未找到相关内容'; break;
    default: s.textContent = n > 0 ? ('共 ' + n + ' 个结果 · 命中 ' + srcCount + ' 个源') : '未找到相关内容';
  }
  // 状态点：加载(粉脉冲) / 分类兜底(琥珀脉冲) / 空(红) / 有结果(绿)
  var dot = document.getElementById('moviesStatusDot');
  if (dot) dot.setAttribute('data-mode', _moviesState.mode);
}

// ===================== 左侧源列表 =====================

// 标签样式：HarmonyOS 深色主题标签（与类别页一致），源名 + 数量（选中粉色高亮）
function _moviesSourceItem(code, label, count) {
  var active = _moviesState.activeSource === code;
  return '<button type="button" class="movies-source-item' + (active ? ' active' : '') + '" data-source="' + _escapeHtml(code) + '">' +
    '<span class="movies-source-name">' + _escapeHtml(label) + '</span>' +
    '<span class="movies-source-count">' + count + '</span>' +
    '</button>';
}

function renderMoviesSidebar() {
  var list = document.getElementById('moviesSourcesList');
  if (!list) return;
  var results = _moviesState.results || [];
  var counts = _getSourceCounts(results);
  // 「全部」始终显示
  var h = _moviesSourceItem('all', '全部', results.length);
  // 源列表顺序：本次搜索最快在前；无本次延迟数据的源退回负载均衡历史平均
  var ids = _orderSourcesByLatency((selectedAPIs || []).filter(_isValidSource), _sourceFastestLatency(results), _orderSourcesByLoad);
  ids.forEach(function (id) {
    var c = counts[id] || 0;
    if (c === 0) return; // 只显示有结果的源
    h += _moviesSourceItem(id, _getSourceLabel(id, results), c);
  });
  list.innerHTML = h;
}

// ===================== 右侧结果网格 =====================

function _moviesEmptyHtml() {
  return '<div class="movies-empty">' +
    '<svg class="movies-empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
    '<h3 class="movies-empty-title">没有找到相关内容</h3>' +
    '<p class="movies-empty-desc">请尝试更换关键词，或检查数据源设置</p>' +
    '<button type="button" class="movies-empty-btn" data-action="movies-back">返回</button>' +
    '</div>';
}

function renderMoviesGrid() {
  var grid = document.getElementById('moviesResults');
  if (!grid) return;
  if (_moviesState.mode === 'loading' || _moviesState.mode === 'fallback') {
    grid.innerHTML = generateSkeletonCards();
    return;
  }
  var items = _moviesState.activeSource === 'all'
    ? _moviesState.results
    : _moviesState.results.filter(function (r) { return r.source_code === _moviesState.activeSource; });
  if (!items || items.length === 0) {
    grid.innerHTML = _moviesEmptyHtml();
    return;
  }
  grid.innerHTML = _buildSearchCardsHtml(items);
  animateCardEntrance('#moviesResults');
}

function renderMoviesEmpty() {
  _moviesState.mode = 'empty';
  _moviesState.loading = false;
  _moviesState.keyword = _moviesState.keyword || '';
  _moviesState.results = [];
  renderMoviesPageHeader();
  var list = document.getElementById('moviesSourcesList');
  if (list) list.innerHTML = '';
  renderMoviesGrid();
}

// ===================== 对外入口 =====================

// 搜索结果完成后统一进入结果页（search() 调用）
function showMoviesResults(keyword, results, opts) {
  opts = opts || {};
  // 作为一次新的结果页渲染，作废仍在途的旧加载管道
  _moviesEpoch++;
  _moviesState = {
    keyword: keyword,
    results: results || [],
    activeSource: 'all',
    from: opts.from || 'home',
    fallbackGenres: opts.fallbackGenres || [],
    mode: (results && results.length) ? 'search' : ((opts.fallbackGenres && opts.fallbackGenres.length) ? 'fallback' : 'empty'),
    loading: false,
    epoch: _moviesEpoch
  };
  // 搜索框保持为空：避免残留关键词在下次打开搜索页/切换页面时被重复搜索
  clearSearchInput();
  renderMoviesPageHeader();
  renderMoviesSidebar();
  renderMoviesGrid();
  switchPage('movies');
  // 关键词全部无结果且类别入口携带类型 → 混合兜底：按分类拉取
  if (_moviesState.mode === 'fallback') {
    _runCategoryFallback(_orderSourcesByLoad((selectedAPIs || []).filter(_isValidSource)));
  }
}

// 类别入口（tmdb.js 调用）：直接进入结果页并独立发起搜索
function openMoviesPage(keyword, opts) {
  opts = opts || {};
  // 新入口发起：作废仍在途的旧搜索/旧加载管道（后发起者优先）
  _moviesEpoch++;
  _moviesState = {
    keyword: keyword,
    results: [],
    activeSource: 'all',
    from: opts.from || 'home',
    fallbackGenres: opts.fallbackGenres || [],
    mode: 'loading',
    loading: true,
    epoch: _moviesEpoch
  };
  // 搜索框保持为空：避免残留关键词在下次打开搜索页/切换页面时被重复搜索
  clearSearchInput();
  renderMoviesPageHeader();
  renderMoviesSidebar();
  renderMoviesGrid();
  switchPage('movies');
  loadMoviesResults();
}

// ===================== 渐进搜索（类别入口独立使用） =====================

async function loadMoviesResults() {
  if (!_moviesState || !_moviesState.keyword) return;
  var keyword = _moviesState.keyword;
  var epoch = _moviesState.epoch || 0;
  _moviesState.mode = 'loading';
  _moviesState.loading = true;
  _moviesState.results = [];

  renderMoviesPageHeader();
  renderMoviesSidebar();
  renderMoviesGrid();

  var hiddenFilterEnabled = !isHiddenContentMode();
  var ordered = _orderSourcesByLoad((selectedAPIs || []).filter(_isValidSource));
  var deadline = Date.now() + 12000;
  var grid = document.getElementById('moviesResults');
  var allResults = [];
  var firstResultRendered = false;

  for (var i = 0; i < ordered.length; i++) {
    if (Date.now() > deadline) break;
    // 期间有更新的搜索/入口发起，作废本次加载
    if (epoch !== _moviesEpoch) return;
    var apiId = ordered[i];
    try {
      var results = await searchByAPIAndKeyWord(apiId, keyword);
      if (epoch !== _moviesEpoch) return;
      if (hiddenFilterEnabled) results = await applyFilter(results);
      if (!results || results.length === 0) continue;
      allResults = allResults.concat(results);
      _moviesState.results = allResults.slice();
      // 第一个结果到达时，清空骨架屏占位
      if (!firstResultRendered && grid) {
        grid.innerHTML = '';
        firstResultRendered = true;
      }
      if (grid) grid.insertAdjacentHTML('beforeend', _buildSearchCardsHtml(results));
      renderMoviesSidebar();
    } catch (e) {
      console.warn('[结果页] 源 ' + apiId + ' 搜索失败:', e);
    }
  }

  if (epoch !== _moviesEpoch) return;

  if (allResults.length === 0) {
    _moviesState.results = [];
    if (_moviesState.fallbackGenres && _moviesState.fallbackGenres.length) {
      await _runCategoryFallback(ordered);
      return;
    }
    _moviesState.mode = 'empty';
    _moviesState.loading = false;
    renderMoviesPageHeader();
    renderMoviesSidebar();
    renderMoviesGrid();
    return;
  }

  _moviesState.results = _sortResultsByLatencyThenName(allResults);
  _moviesState.mode = 'search';
  _moviesState.loading = false;
  _lastAllResults = _moviesState.results; // 供播放缓存兜底
  renderMoviesPageHeader();
  renderMoviesSidebar();
  renderMoviesGrid();
}

// ===================== 混合兜底：按分类拉取 =====================

async function _runCategoryFallback(ordered) {
  var genre = (_moviesState.fallbackGenres && _moviesState.fallbackGenres[0]) || '';
  var aliases = GENRE_CLASS_ALIASES[genre] || (genre ? [genre] : []);
  var epoch = _moviesState.epoch || 0;
  _moviesState.mode = 'fallback';
  _moviesState.loading = true;
  _moviesState.results = [];

  var grid = document.getElementById('moviesResults');
  if (grid) {
    grid.innerHTML = '<div class="movies-fallback-tip">关键词未找到，正在按「' + _escapeHtml(genre) + '」分类查找…</div>' + generateSkeletonCards();
  }
  renderMoviesPageHeader();
  renderMoviesSidebar();

  var allResults = [];
  if (ordered && ordered.length) {
    for (var i = 0; i < ordered.length; i++) {
      if (epoch !== _moviesEpoch) return;
      var apiId = ordered[i];
      var got = false;
      for (var a = 0; a < aliases.length && !got; a++) {
        var page1 = await searchByCategory(apiId, aliases[a], 1);
        if (epoch !== _moviesEpoch) return;
        if (page1 && page1.length) {
          got = true;
          allResults = allResults.concat(page1);
          var page2 = await searchByCategory(apiId, aliases[a], 2);
          if (epoch !== _moviesEpoch) return;
          if (page2 && page2.length) allResults = allResults.concat(page2);
          break;
        }
      }
    }
  }

  if (epoch !== _moviesEpoch) return;

  if (allResults.length > 0) {
    _moviesState.results = _sortResultsByLatencyThenName(allResults);
    _moviesState.mode = 'search';
    _moviesState.loading = false;
    _lastAllResults = _moviesState.results;
    renderMoviesPageHeader();
    renderMoviesSidebar();
    renderMoviesGrid();
  } else {
    _moviesState.mode = 'empty';
    _moviesState.loading = false;
    renderMoviesPageHeader();
    renderMoviesSidebar();
    renderMoviesGrid();
  }
}

// ===================== 播放页返回恢复 =====================

function restoreMoviesFromCache(cached) {
  if (!cached || !cached.keyword || !Array.isArray(cached.results) || cached.results.length === 0) return false;
  _moviesState = {
    keyword: cached.keyword,
    results: cached.results,
    activeSource: cached.activeFilter || 'all',
    from: cached.from || 'home',
    fallbackGenres: [],
    mode: 'search',
    loading: false
  };
  // 搜索框保持为空：避免残留关键词在下次打开搜索页/切换页面时被重复搜索
  clearSearchInput();
  renderMoviesPageHeader();
  renderMoviesSidebar();
  renderMoviesGrid();
  return true;
}

function restoreMoviesFromCacheFromStorage() {
  try {
    var raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return false;
    var cached = JSON.parse(raw);
    if (!cached || cached.sourcePage !== 'movies') return false;
    sessionStorage.removeItem(SEARCH_CACHE_KEY);
    return restoreMoviesFromCache(cached);
  } catch (e) {
    return false;
  }
}

// 进入结果页时初始化：优先恢复缓存（从播放页返回秒开），否则按当前状态渲染，最后才尝试直链 /s= 自动搜索
function initMoviesPage() {
  if (restoreMoviesFromCacheFromStorage()) return;
  if (_moviesState && _moviesState.keyword) {
    // 已有状态（正在加载或已渲染）：保持现状，避免重复发起搜索
    renderMoviesPageHeader();
    renderMoviesSidebar();
    renderMoviesGrid();
    return;
  }
  // 直链进入（如 /s=关键词#movies）：自动按关键词搜索
  var kw = '';
  try {
    var p = window.location.pathname || '';
    if (p.indexOf('/s=') === 0) {
      kw = decodeURIComponent(p.substring(3));
    } else if ((window.location.search || '').indexOf('?s=') === 0) {
      kw = new URLSearchParams(window.location.search).get('s') || '';
    }
  } catch (e) { /* 忽略 */ }
  if (kw) {
    openMoviesPage(kw, { from: 'home' });
    return;
  }
  renderMoviesEmpty();
}

// 返回来源页（类别 / 首页）
function moviesPageBack() {
  var from = (_moviesState && _moviesState.from) || 'home';
  switchPage(from === 'category' ? 'category' : 'home');
}

// ===================== 事件绑定 =====================

document.addEventListener('DOMContentLoaded', function () {
  var panel = document.getElementById('moviesSourcesList');
  if (!panel) return;
  panel.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-source]');
    if (!btn) return;
    var code = btn.dataset.source;
    if (code === _moviesState.activeSource) return;
    _moviesState.activeSource = code;
    renderMoviesSidebar();
    renderMoviesGrid();
    var ra = document.getElementById('moviesResults');
    if (ra) ra.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
});

// ===================== 导出 =====================

// 用 getter 导出，确保外部始终读到最新状态（内部 _moviesState 会被整体重新赋值）
Object.defineProperty(window, '_moviesState', {
  configurable: true,
  get: function () { return _moviesState; }
});
window.openMoviesPage = openMoviesPage;
window.showMoviesResults = showMoviesResults;
window.loadMoviesResults = loadMoviesResults;
window.initMoviesPage = initMoviesPage;
window.moviesPageBack = moviesPageBack;
window.restoreMoviesFromCache = restoreMoviesFromCache;
