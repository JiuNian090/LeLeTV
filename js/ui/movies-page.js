// LeLeTV — 影片结果页（搜索 / 类别统一入口）
// 结构：顶栏（返回 + 常驻搜索框 + 计数）→ 筛选一行（按类型分段 + 来源与延迟）
//       → 最佳匹配（海报取色背景、季切换、播放 / 线路）→ 分组货架（其他版本 / 衍生短剧 / 相关影片）
// 选中单个片源时不合并，平铺该片源的结果
// 类别入口采用混合策略：先按影片名关键词搜索，全部无结果时按分类拉取兜底

// 页面状态（app-search.js 也会读取）
let _moviesState = {
  keyword: '',
  results: [],
  activeSource: 'all',
  segment: 'all',          // all | main | version | short | related —— 按类型分段
  season: 0,               // 最佳匹配里选中的季
  seasonPicked: false,     // 用户手选过季 / 版本（没选过时默认显示线路最多的版本）
  linesOpen: false,        // 最佳匹配的线路列表是否展开
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

// 片名去掉关键词后剩下的部分若只由这些词组成，就算同一部片的「其他版本」
const VERSION_TOKENS = [
  '特别版', '特别篇', '剧场版', '电影版', '动画版', '真人版', '粤语版', '粤语', '国语版', '国语', '英语版', '英语',
  '日语版', '日语', '台配', '港版', '美版', '韩版', '日版', '泰版', '预告片', '预告', '花絮', '特辑', '番外篇', '番外',
  '彩蛋', '幕后', '纪录片', 'ova', 'oad', 'sp', 'tv版', '完整版', '加长版', '导演剪辑版', '导演版', '未删减版', '未删减',
  '删减版', '修复版', '重制版', '高清版', '高清', '4k版', '4k', 'hd', '蓝光', '独播版', 'dvd版', '精编版', '精华版',
  '合集', '全集', '上部', '下部', '上', '下', '前传', '后传', '终章', '大结局', '先行版', '抢先版', '抢先看', '点映版',
  '中字', '中文字幕', '字幕版', '配音版', '原声版', '双语版', '纯享版', '加更版', '会员版', 'plus版', 'plus'
];

const SEGMENT_DEFS = [
  { key: 'all', label: '全部' },
  { key: 'main', label: '正片' },
  { key: 'version', label: '其他版本' },
  { key: 'short', label: '衍生作品' },
  { key: 'related', label: '相关影片' }
];

const SHELF_DEFS = [
  { key: 'version', title: '其他版本', note: '' },
  { key: 'short', title: '衍生作品', note: '同名外传、短剧等，非原著正片' },
  { key: 'related', title: '相关影片', note: '片名与关键词相近' }
];

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _plainText(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
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

// ===================== 结果分组：最佳匹配 / 其他版本 / 衍生短剧 / 相关影片 =====================

function _cnNum(s) {
  s = String(s || '');
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  var digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  var pos = s.indexOf('十');
  if (pos < 0) return digits[s] || 0;
  var tens = pos === 0 ? 1 : (digits[s[0]] || 0);
  var ones = pos === s.length - 1 ? 0 : (digits[s[s.length - 1]] || 0);
  return tens * 10 + ones;
}

/** 片名里的季序：「第二季 / 第2部 / S2 / Season 2」，base 是去掉季序后的片名 */
function _seasonOf(name) {
  name = String(name || '').trim();
  var m = name.match(/第\s*([0-9一二三四五六七八九十两]+)\s*[季部]/);
  if (m) return { base: name.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), season: _cnNum(m[1]) };
  var s = name.match(/(?:^|[\s\-_·])S(\d{1,2})(?=$|[\s\-_·])/i) || name.match(/season\s*(\d{1,2})/i);
  if (s) return { base: name.replace(s[0], ' ').replace(/\s+/g, ' ').trim(), season: parseInt(s[1], 10) };
  return { base: name, season: null };
}

function _seasonLabel(n) {
  var cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return '第' + (n >= 1 && n <= 10 ? cn[n - 1] : n) + '季';
}

/** 去掉关键词后剩下的片段是否只由版本词组成（前面还允许带一个季序） */
function _isVersionRest(rest) {
  rest = String(rest || '').replace(/^(第?[0-9一二三四五六七八九十两]+[季部集话]|s\d{1,2})/, '');
  var guard = 0;
  while (rest && guard++ < 8) {
    var hit = null;
    for (var i = 0; i < VERSION_TOKENS.length; i++) {
      if (rest.indexOf(VERSION_TOKENS[i]) === 0) { hit = VERSION_TOKENS[i]; break; }
    }
    if (!hit) return false;
    rest = rest.slice(hit.length);
  }
  return !rest;
}

function _isShortDrama(item) {
  return /短剧|微剧|微短剧|竖屏/.test(String(item.type_name || ''));
}

/** 展示用片名：去掉资源站接在后面的别名（「片名$别名」） */
function _displayName(name) {
  return String(name || '').split('$')[0].trim();
}

/**
 * 衍生作品：关键词后面紧跟「之」或标点再接别的名字（庆余年之大赵逍遥王、庆余年，全世界都以为……），
 * 或者分类本身就是短剧
 */
function _isDerivative(name, keyword, item) {
  var kwEsc = String(keyword || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!kwEsc) return false;
  if (new RegExp('^' + kwEsc + '\\s*[之：:，,、·\\-—~～（(【\\[]').test(name)) return true;
  return _isShortDrama(item) && _normTitle(name).indexOf(_normTitle(keyword)) >= 0;
}

function _firstPic(items) {
  for (var i = 0; i < items.length; i++) {
    var pic = items[i].vod_pic;
    if (pic && /^https?:\/\//.test(pic)) return pic;
  }
  return '';
}

function _bySeason(a, b) {
  var sa = a.season === null ? 0 : a.season;
  var sb = b.season === null ? 0 : b.season;
  if (sa !== sb) return sa - sb;
  return String(a.year || '').localeCompare(String(b.year || ''));
}

/**
 * 把合并后的同名组按与关键词的关系分类：
 *   main     片名（去掉季序）与关键词一致 → 最佳匹配，各季合成一组
 *   version  关键词后只跟版本词（粤语版、预告片、特别版……）→ 其他版本
 *   short    关键词后接「之」或标点再接别的名字，或分类是短剧 → 衍生作品
 *   related  其余（片名相近、简介命中等）
 * 没有精确命中时，片源最多的那组顶上当最佳匹配
 */
function _groupMoviesResults(results, keyword) {
  var groups = _mergeResultsByTitle(results);
  var kw = _normTitle(keyword);
  var out = { all: groups, main: [], version: [], short: [], related: [], hero: null };
  groups.forEach(function (g) {
    var name = _displayName(g.lead.vod_name);
    var se = _seasonOf(name);
    g.name = name;
    g.base = se.base;
    g.season = se.season;
    g.remarks = _plainText(g.lead.vod_remarks);
    g.pic = _firstPic(g.items);
    var n = _normTitle(name);
    var nb = _normTitle(se.base);
    var kind;
    if (!kw) kind = 'related';
    else if (n === kw || nb === kw) kind = 'main';
    else if (nb.indexOf(kw) === 0 && _isVersionRest(nb.slice(kw.length))) kind = 'version';
    else if (n.indexOf(kw) === 0 && _isVersionRest(n.slice(kw.length))) kind = 'version';
    else if (_isDerivative(name, keyword, g.lead)) kind = 'short';
    else kind = 'related';
    g.kind = kind;
    out[kind].push(g);
  });
  if (out.main.length) {
    out.hero = { groups: out.main.slice().sort(_bySeason), exact: true };
  } else if (groups.length) {
    var best = groups.slice().sort(function (a, b) { return b.items.length - a.items.length; })[0];
    out.hero = { groups: [best], exact: false };
    // 顶上来的这组从货架里挪走，不重复出现
    out[best.kind] = out[best.kind].filter(function (g) { return g !== best; });
  }
  return out;
}

/** 分组结果缓存：结果数组或关键词变了才重新分组 */
function _moviesGroups() {
  var st = _moviesState;
  var cache = st._groups;
  if (cache && cache.results === st.results && cache.keyword === st.keyword) return cache.data;
  var data = _groupMoviesResults(st.results || [], st.keyword);
  st._groups = { results: st.results, keyword: st.keyword, data: data };
  return data;
}

// ===================== 顶部栏 =====================

function renderMoviesPageHeader() {
  var keyword = _moviesState.keyword || '';
  var t = document.getElementById('moviesTitle');
  if (t) t.textContent = keyword ? '「' + keyword + '」的检索结果' : '检索结果';
  var form = document.getElementById('moviesResearchForm');
  var input = document.getElementById('moviesResearchInput');
  // 搜索框常驻关键词，用户正在改词时不打断
  if (input && document.activeElement !== input) {
    input.value = keyword;
    if (form) form.classList.toggle('has-text', !!keyword);
  }
  var s = document.getElementById('moviesSubtitle');
  if (!s) return;
  var n = _moviesState.results.length;
  var srcCount = 0;
  if (n > 0) {
    var seen = {};
    _moviesState.results.forEach(function (r) { seen[r.source_code] = 1; });
    srcCount = Object.keys(seen).length;
  }
  var titles = n > 0 ? _moviesGroups().all.length : 0;
  switch (_moviesState.mode) {
    case 'loading': s.textContent = n > 0 ? ('正在检索 · 已找到 ' + titles + ' 部') : '正在检索各片源'; break;
    case 'fallback': s.textContent = '未找到同名影片，正在按分类查找'; break;
    case 'empty': s.textContent = '没有找到结果'; break;
    default: s.textContent = n > 0 ? (titles + ' 部 · ' + srcCount + ' 个片源') : '没有找到结果';
  }
  // 状态点：加载(主色脉冲) / 分类兜底(琥珀脉冲) / 空(红) / 有结果(绿)
  var dot = document.getElementById('moviesStatusDot');
  if (dot) dot.setAttribute('data-mode', _moviesState.mode);
}

// ===================== 筛选一行：分段 + 来源 =====================

function renderMoviesSegments(data) {
  var box = document.getElementById('moviesSegs');
  if (!box) return;
  if (!data) { box.innerHTML = ''; return; }
  var counts = { all: data.all.length, main: data.main.length, version: data.version.length, short: data.short.length, related: data.related.length };
  // 当前分段已经没有内容（结果边搜边变）：退回全部
  if (_moviesState.segment !== 'all' && !counts[_moviesState.segment]) _moviesState.segment = 'all';
  var seg = _moviesState.segment || 'all';
  box.innerHTML = SEGMENT_DEFS.filter(function (d) { return d.key === 'all' || counts[d.key] > 0; }).map(function (d) {
    var on = seg === d.key;
    return '<button type="button" class="movies-seg-btn' + (on ? ' is-active' : '') + '" role="tab" aria-selected="' + on + '" data-segment="' + d.key + '">' +
      d.label + '<span>' + counts[d.key] + '</span></button>';
  }).join('');
}

// 片源筛选条目：状态点 + 名称 + 本次响应（没有延迟数据时显示条目数）
function _moviesSourceItem(code, label, count, latency) {
  var active = _moviesState.activeSource === code;
  var lvl = typeof _latencyLevel === 'function' ? _latencyLevel(latency) : '';
  var latText = lvl ? _latencyText(latency) : '';
  var tip = count + ' 条结果' + (latText ? ' · 本次响应 ' + latText : '');
  return '<button type="button" class="movies-chip' + (active ? ' is-active' : '') + '" data-source="' + _escapeHtml(code) + '" aria-pressed="' + active + '" title="' + _escapeHtml(tip) + '">' +
    (lvl ? '<i class="movies-chip-dot is-' + lvl + '" aria-hidden="true"></i>' : '') +
    '<span class="movies-chip-name">' + _escapeHtml(label) + '</span>' +
    '<em>' + (latText ? _escapeHtml(latText) : count) + '</em>' +
    '</button>';
}

function renderMoviesSidebar() {
  var list = document.getElementById('moviesSourcesList');
  if (!list) return;
  var results = _moviesState.results || [];
  var counts = _getSourceCounts(results);
  if (!results.length) { list.innerHTML = ''; return; }
  // 「全部」按合并后的影片数计
  var h = '<span class="movies-sources-label">来源</span>' + _moviesSourceItem('all', '全部', _moviesGroups().all.length);
  // 源列表顺序：本次搜索最快在前；无本次延迟数据的源退回负载均衡历史平均
  var fastest = _sourceFastestLatency(results);
  var ids = _orderSourcesByLatency((selectedAPIs || []).filter(_isValidSource), fastest, _orderSourcesByLoad);
  ids.forEach(function (id) {
    var c = counts[id] || 0;
    if (c === 0) return; // 只显示有结果的源
    h += _moviesSourceItem(id, _getSourceLabel(id, results), c, fastest[id]);
  });
  list.innerHTML = h;
}

// ===================== 最佳匹配 =====================

function _playAttrs(item) {
  var sid = (item.vod_id || '').toString().replace(/[^\w-]/g, '');
  var au = item.api_url ? ' data-api-url="' + _escapeHtml(item.api_url) + '"' : '';
  return 'data-action="play-directly" data-id="' + sid + '" data-name="' + _escapeHtml(String(item.vod_name || '').trim()) + '" data-source="' + _escapeHtml(item.source_code || '') + '"' + au;
}

/** 预检判死的线路挪到最后（其余顺序不变）：播放按钮永远指向第一条没判死的 */
function _sortDeadLast(items) {
  if (!window.LeLeLineProbe || !items || items.length < 2) return items;
  var alive = [], dead = [];
  items.forEach(function (it) {
    (LeLeLineProbe.cached(String(it.source_code), String(it.vod_id), 0) === false ? dead : alive).push(it);
  });
  return dead.length ? alive.concat(dead) : items;
}

/** 起播前预检：最佳匹配一渲染就并行探前 3 条线路；判死的正好是播放按钮指向的那条，就重绘换到下一条（重绘会接着探新的前 3 条）。
 *  只有一条线路也探：判死的结论进缓存，播放页一进来就直接换线，不用等清单超时 */
function _probeHeroLine(g) {
  if (!window.LeLeLineProbe || !g || !g.items || !g.items.length) return;
  var keyword = _moviesState.keyword;
  g.items.slice(0, 3).forEach(function (it) {
    if (!it.vod_id || !it.source_code) return;
    var source = String(it.source_code), vodId = String(it.vod_id);
    if (LeLeLineProbe.cached(source, vodId, 0) !== undefined) return;
    LeLeLineProbe.check(source, vodId, 0).then(function (ok) {
      if (ok || _moviesState.keyword !== keyword) return;
      var hero = document.getElementById('moviesHero');
      var btn = hero && !hero.hidden ? hero.querySelector('.movies-play') : null;
      if (btn && btn.dataset.source === source && btn.dataset.id === vodId.replace(/[^\w-]/g, '')) renderMoviesHero(_moviesGroups());
    });
  });
}

function _cssUrl(url) {
  return 'url(&quot;' + _escapeHtml(String(url).replace(/["\\\n\r]/g, '')) + '&quot;)';
}

function renderMoviesHero(data) {
  var el = document.getElementById('moviesHero');
  if (!el) return;
  var st = _moviesState;
  var hero = data && data.hero;
  var seg = st.segment || 'all';
  if (!hero || (seg !== 'all' && seg !== 'main')) { el.hidden = true; return; }

  var groups = hero.groups;
  var idx;
  if (!st.seasonPicked && groups.length > 1 && groups.every(function (x) { return x.season === null; })) {
    // 不是真正的分季、用户也没手选：默认显示线路最多的那个版本，起播更稳
    idx = 0;
    groups.forEach(function (x, i) { if (x.items.length > groups[idx].items.length) idx = i; });
  } else {
    idx = Math.min(Math.max(0, st.season || 0), groups.length - 1);
  }
  st.season = idx;
  var g = groups[idx];
  g.items = _sortDeadLast(g.items);
  var lead = g.items[0];
  var pic = g.pic || _firstPic(groups.reduce(function (acc, x) { return acc.concat(x.items); }, []));
  var years = groups.map(function (x) { return String(x.year || '').trim(); }).filter(Boolean).sort();
  var yearText = years.length ? (years[0] === years[years.length - 1] ? years[0] : years[0] + ' – ' + years[years.length - 1]) : '';
  var seen = {};
  groups.forEach(function (x) { x.items.forEach(function (it) { seen[it.source_code] = 1; }); });
  var srcCount = Object.keys(seen).length;
  var multiNull = groups.filter(function (x) { return x.season === null; }).length > 1;
  var title = hero.exact ? (groups[0].base || g.name) : g.name;
  var meta = [_plainText(lead.type_name), yearText, groups.length > 1 ? groups.length + ' 季' : '', srcCount + ' 个片源'].filter(Boolean).join(' · ');
  var desc = _plainText(lead.vod_content || lead.vod_blurb || '');

  var h = '';
  if (pic) {
    h += '<div class="movies-hero-bg" style="--poster:' + _cssUrl(pic) + '" aria-hidden="true"></div>';
    h += '<div class="movies-hero-poster" style="--poster:' + _cssUrl(pic) + '" role="img" aria-label="' + _escapeHtml(title) + ' 海报"></div>';
  } else {
    h += '<div class="movies-hero-poster is-empty" aria-hidden="true"><b>' + _escapeHtml(title.slice(0, 1)) + '</b></div>';
  }
  h += '<div class="movies-hero-info">';
  h += '<p class="movies-eyebrow"><i></i>' + (hero.exact ? '最佳匹配' : '最相近的结果') + '</p>';
  h += '<h2>' + _escapeHtml(title) + '</h2>';
  if (meta) h += '<p class="movies-hero-meta">' + _escapeHtml(meta) + '</p>';
  if (groups.length > 1) {
    h += '<div class="movies-seasons" role="tablist" aria-label="选季">';
    groups.forEach(function (x, i) {
      var label = x.season !== null ? _seasonLabel(x.season) : (multiNull ? (x.year ? x.year + ' 版' : x.name) : '正片');
      var sub = [x.year, x.remarks, x.items.length + ' 条线路'].filter(Boolean).join(' · ');
      h += '<button type="button" class="movies-season' + (i === idx ? ' is-active' : '') + '" role="tab" aria-selected="' + (i === idx) + '" data-season="' + i + '">' +
        '<b>' + _escapeHtml(label) + '</b><span>' + _escapeHtml(sub) + '</span></button>';
    });
    h += '</div>';
  }
  if (desc) h += '<p class="movies-hero-desc">' + _escapeHtml(desc) + '</p>';
  h += '<div class="movies-hero-actions">';
  h += '<button type="button" class="v2-btn v2-btn--primary movies-play" ' + _playAttrs(lead) + '>' +
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>播放' +
    (g.remarks && groups.length === 1 && !g.season ? '' : '') + '</button>';
  h += '<button type="button" class="v2-btn v2-btn--secondary" data-role="toggle-lines" aria-expanded="' + !!st.linesOpen + '">' +
    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>' + g.items.length + ' 条线路</button>';
  if (g.remarks) h += '<span class="movies-hero-remarks">' + _escapeHtml(g.remarks) + '</span>';
  h += '</div>';
  h += '<div class="movies-lines"' + (st.linesOpen ? '' : ' hidden') + '>';
  g.items.forEach(function (it) {
    var dead = !!window.LeLeLineProbe && LeLeLineProbe.cached(String(it.source_code), String(it.vod_id), 0) === false;
    var lvl = dead ? 'bad' : (typeof _latencyLevel === 'function' ? _latencyLevel(it.source_latency) : '');
    var lat = dead ? '不可用' : (lvl ? _latencyText(it.source_latency) : '');
    var note = _plainText(it.vod_remarks);
    h += '<button type="button" class="movies-line' + (dead ? ' is-dead' : '') + '" ' + _playAttrs(it) + '>' +
      (lvl ? '<i class="movies-chip-dot is-' + lvl + '" aria-hidden="true"></i>' : '') +
      _escapeHtml(it.source_name || it.source_code || '') +
      (lat ? '<em>' + _escapeHtml(lat) + '</em>' : '') +
      (note ? '<span>' + _escapeHtml(note) + '</span>' : '') +
      '</button>';
  });
  h += '</div>';
  h += '</div>';
  el.innerHTML = h;
  el.hidden = false;
  _probeHeroLine(g);
}

// ===================== 卡片与货架 =====================

// 一张卡：2:3 海报，右上角源数（多个片源合并时），左下角集数备注；片名 + 年份·类型。点击播放最快的片源
function _buildGroupCard(g) {
  g.items = _sortDeadLast(g.items);
  var item = g.items[0];
  var nameRaw = String(g.name || item.vod_name || '').trim();
  var sn = _escapeHtml(nameRaw);
  var cover = item.vod_pic && /^https?:\/\//.test(item.vod_pic) ? item.vod_pic : (g.pic || '');
  var remarks = g.remarks !== undefined ? g.remarks : _plainText(item.vod_remarks);
  var meta = [item.vod_year, item.type_name].filter(Boolean).map(function (v) { return _escapeHtml(_plainText(v)); }).join(' · ');
  var srcNames = g.items.map(function (o) { return o.source_name; }).filter(Boolean).join('、');

  var h = '<article class="v2-pcard v2-rcard search-result-card card-hover" role="button" tabindex="0" ' + _playAttrs(item) + ' aria-label="播放 ' + sn + '">';
  // 片名首字占位垫在最下层：资源站的图床普遍偏慢，图片到之前卡片也不是一块黑
  h += '<div class="v2-poster"><div class="v2-poster-empty"><b>' + _escapeHtml(nameRaw.slice(0, 1) || '·') + '</b><span>' + sn + '</span></div>';
  if (cover) {
    h += '<img src="' + _escapeHtml(cover) + '" alt="" data-title="' + sn + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="_posterLoaded(this)" onerror="_cardImgFallback(this)">';
  }
  if (g.items.length > 1) h += '<span class="v2-badge v2-badge--srcs" title="' + _escapeHtml('可用片源：' + srcNames) + '">' + g.items.length + ' 源</span>';
  if (remarks) h += '<span class="v2-scrim-note"><span>' + _escapeHtml(remarks) + '</span></span>';
  h += '</div>';
  h += '<h3 title="' + sn + '">' + sn + '</h3>';
  h += '<p>' + (meta || '&nbsp;') + '</p>';
  h += '</article>';
  return h;
}

function _shelfHtml(def, groups) {
  if (!groups || !groups.length) return '';
  return '<section class="movies-shelf" data-kind="' + def.key + '">' +
    '<div class="movies-shelf-head"><h3>' + def.title + '</h3><span>' + groups.length + '</span>' + (def.note ? '<p>' + def.note + '</p>' : '') + '</div>' +
    '<div class="movies-results-grid">' + groups.map(_buildGroupCard).join('') + '</div>' +
    '</section>';
}

function _moviesEmptyHtml() {
  return '<div class="v2-state">' +
    '<span class="v2-state-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8.5 11h5"/></svg></span>' +
    '<h3>没有找到结果</h3>' +
    '<p>换个关键词试试，或在「设置 › 数据源」中启用更多片源。</p>' +
    '<button type="button" class="v2-btn v2-btn--secondary v2-btn--sm" data-action="movies-back">返回</button>' +
    '</div>';
}

/**
 * 边搜边出会反复重建卡片：封面已经在缓存里的直接标成加载完成，不再从占位淡入一遍；
 * 入场动画也只在这个关键词第一次出结果时做
 */
function _settleCachedPosters(root) {
  if (!root) return;
  Array.prototype.forEach.call(root.querySelectorAll('.v2-poster > img:not(.loaded)'), function (img) {
    if (img.complete && img.naturalWidth > 0 && typeof _posterLoaded === 'function') _posterLoaded(img);
  });
}

var _prefetchedPlayer = false;
/** 结果一出来就把播放页的脚本预取到缓存，点卡片时播放页秒开 */
function _prefetchPlayerAssets() {
  if (_prefetchedPlayer) return;
  _prefetchedPlayer = true;
  var meta = document.querySelector('meta[name="leletv-player-bundle"]');
  var version = '';
  try { version = (document.querySelector('script[src*="dist/leletv-core"]') || {}).src.split('?v=')[1] || ''; } catch (e) { /* 忽略 */ }
  var v = version ? '?v=' + version : '';
  var list = ['player.html', 'libs/hls.min.js' + v, 'libs/artplayer.min.js' + v];
  if (meta && meta.content) list.push(meta.content + v);
  var run = function () {
    list.forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      if (/\.js/.test(href)) link.as = 'script';
      document.head.appendChild(link);
    });
  };
  if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 300);
}

function renderMoviesGrid() {
  var grid = document.getElementById('moviesResults');
  var heroEl = document.getElementById('moviesHero');
  var filters = document.getElementById('moviesFilters');
  if (!grid) return;
  var st = _moviesState;
  var results = st.results || [];
  var loading = st.mode === 'loading' || st.mode === 'fallback';

  // 还在加载且一条结果都没有：骨架占位；有结果就边搜边出
  if (loading && !results.length) {
    if (heroEl) heroEl.hidden = true;
    if (filters) filters.hidden = true;
    grid.innerHTML = '<div class="movies-results-grid">' + generateSkeletonCards() + '</div>';
    return;
  }
  if (!results.length) {
    if (heroEl) heroEl.hidden = true;
    if (filters) filters.hidden = true;
    renderMoviesSegments(null);
    grid.innerHTML = _moviesEmptyHtml();
    return;
  }
  if (filters) filters.hidden = false;

  // 单个片源：不合并，平铺
  if (st.activeSource !== 'all') {
    var items = results.filter(function (r) { return r.source_code === st.activeSource; });
    if (heroEl) heroEl.hidden = true;
    renderMoviesSegments(null);
    grid.innerHTML = items.length
      ? '<div class="movies-results-grid">' + items.map(function (it) {
          return _buildGroupCard({ lead: it, items: [it], name: _displayName(it.vod_name), pic: '', remarks: _plainText(it.vod_remarks) });
        }).join('') + '</div>'
      : _moviesEmptyHtml();
    _settleCachedPosters(grid);
    if (!st.loading) animateCardEntrance('#moviesResults');
    return;
  }

  var data = _moviesGroups();
  renderMoviesSegments(data);
  renderMoviesHero(data);
  var seg = st.segment || 'all';
  var h = '';
  if (seg === 'all') {
    SHELF_DEFS.forEach(function (def) { h += _shelfHtml(def, data[def.key]); });
  } else if (seg !== 'main') {
    var def = SHELF_DEFS.filter(function (d) { return d.key === seg; })[0];
    h = def ? _shelfHtml(def, data[seg]) : '';
  }
  grid.innerHTML = h;
  _settleCachedPosters(grid);
  _prefetchPlayerAssets();
  // 入场动画只做一次：后续片源陆续返回时的重绘不再整体飞入
  if (h && !st._animated) {
    st._animated = true;
    animateCardEntrance('#moviesResults');
  }
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

// 丢弃残留的结果页缓存（sessionStorage: leletv_search_cache）。
// 该缓存只服务于「点卡片进播放页 → 返回结果页秒开」；而类别页发起的搜索在播放页返回时
// 会被跳过（见 player-bridge.js 的 buildPlayerBackUrl：returnTo=category → 直达类别页），
// 缓存因此不会被消费而残留在会话里。若不清掉，下一次进入结果页时 initMoviesPage 会拿它恢复，
// 把新入口的关键词换成上一部影片（标题错、卡片随后被新搜索结果覆盖）。
// 所以任何新入口（首页搜索 / 类别入口）都先丢掉旧缓存，只保留本次搜索的结果。
function _discardStaleSearchCache() {
  try { sessionStorage.removeItem(SEARCH_CACHE_KEY); } catch (e) { /* 隐私模式等场景忽略 */ }
}

function _freshState(keyword, results, opts, mode, loading) {
  return {
    keyword: keyword,
    results: results || [],
    activeSource: 'all',
    segment: 'all',
    season: 0,
    seasonPicked: false,
    linesOpen: false,
    from: opts.from || 'home',
    fallbackGenres: opts.fallbackGenres || [],
    mode: mode,
    loading: loading,
    epoch: _moviesEpoch
  };
}

// 搜索结果完成后统一进入结果页（search() 调用）
function showMoviesResults(keyword, results, opts) {
  opts = opts || {};
  _discardStaleSearchCache();
  // 作为一次新的结果页渲染，作废仍在途的旧加载管道
  _moviesEpoch++;
  var mode = (results && results.length) ? 'search' : ((opts.fallbackGenres && opts.fallbackGenres.length) ? 'fallback' : 'empty');
  _moviesState = _freshState(keyword, results, opts, mode, false);
  // 首页搜索框保持为空：避免残留关键词在下次打开搜索页/切换页面时被重复搜索
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
  _discardStaleSearchCache();
  // 新入口发起：作废仍在途的旧搜索/旧加载管道（后发起者优先）
  _moviesEpoch++;
  _moviesState = _freshState(keyword, [], opts, 'loading', true);
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
  var DEADLINE_MS = 12000;
  var startedAt = Date.now();
  var allResults = [];
  var renderQueued = false;

  // 多个片源几乎同时返回时合并成一帧重绘
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      if (epoch !== _moviesEpoch) return;
      _moviesState.results = _sortResultsByLatencyThenName(allResults);
      renderMoviesPageHeader();
      renderMoviesSidebar();
      renderMoviesGrid();
    });
  }

  var tasks = ordered.map(function (apiId) {
    return (async function () {
      try {
        if (window.loadBalancer && typeof window.loadBalancer.isApiOverloaded === 'function' && window.loadBalancer.isApiOverloaded(apiId)) return;
        var results = await searchByAPIAndKeyWord(apiId, keyword);
        if (epoch !== _moviesEpoch || Date.now() - startedAt > DEADLINE_MS) return;
        if (hiddenFilterEnabled) results = await applyFilter(results);
        if (!results || results.length === 0) return;
        allResults = allResults.concat(results);
        queueRender();
      } catch (e) {
        console.warn('[结果页] 源 ' + apiId + ' 搜索失败:', e);
      }
    })();
  });

  // 等全部片源返回，最多等到截止时间（慢源的请求会继续跑完并写入搜索缓存）
  await Promise.race([
    Promise.allSettled(tasks),
    new Promise(function (resolve) { setTimeout(resolve, DEADLINE_MS); })
  ]);

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
  var heroEl = document.getElementById('moviesHero');
  if (heroEl) heroEl.hidden = true;
  if (grid) {
    grid.innerHTML = '<div class="movies-fallback-tip">未找到同名影片，正在按「' + _escapeHtml(genre) + '」分类查找</div>' +
      '<div class="movies-results-grid">' + generateSkeletonCards() + '</div>';
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
  } else {
    _moviesState.mode = 'empty';
    _moviesState.loading = false;
  }
  renderMoviesPageHeader();
  renderMoviesSidebar();
  renderMoviesGrid();
}

// ===================== 播放页返回恢复 =====================

function restoreMoviesFromCache(cached) {
  if (!cached || !cached.keyword || !Array.isArray(cached.results) || cached.results.length === 0) return false;
  _moviesState = _freshState(cached.keyword, cached.results, { from: cached.from || 'home' }, 'search', false);
  _moviesState.activeSource = cached.activeFilter || 'all';
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
  // 顶栏搜索框：沿用首页的搜索流程（写入搜索历史、更新地址栏）
  var researchForm = document.getElementById('moviesResearchForm');
  var researchInput = document.getElementById('moviesResearchInput');
  if (researchForm && researchInput) {
    researchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = researchInput.value.trim();
      if (!q) return;
      if (q === _moviesState.keyword && _moviesState.results.length) { researchInput.blur(); return; }
      var main = document.getElementById('searchInput');
      if (main) main.value = q;
      researchInput.blur();
      search();
    });
    researchInput.addEventListener('input', function () {
      researchForm.classList.toggle('has-text', !!researchInput.value);
    });
    var clearBtn = researchForm.querySelector('[data-role="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        researchInput.value = '';
        researchForm.classList.remove('has-text');
        researchInput.focus();
      });
    }
  }

  // 按类型分段
  var segs = document.getElementById('moviesSegs');
  if (segs) {
    segs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-segment]');
      if (!btn) return;
      var key = btn.dataset.segment;
      if (key === _moviesState.segment) return;
      _moviesState.segment = key;
      renderMoviesGrid();
    });
  }

  // 最佳匹配：选季、展开线路
  var hero = document.getElementById('moviesHero');
  if (hero) {
    hero.addEventListener('click', function (e) {
      var season = e.target.closest('[data-season]');
      if (season) {
        var i = parseInt(season.dataset.season, 10) || 0;
        if (i === _moviesState.season) return;
        _moviesState.season = i;
        _moviesState.seasonPicked = true;
        renderMoviesHero(_moviesGroups());
        return;
      }
      var toggle = e.target.closest('[data-role="toggle-lines"]');
      if (toggle) {
        _moviesState.linesOpen = !_moviesState.linesOpen;
        var lines = hero.querySelector('.movies-lines');
        if (lines) lines.hidden = !_moviesState.linesOpen;
        toggle.setAttribute('aria-expanded', String(_moviesState.linesOpen));
      }
    });
  }

  // 按片源筛选
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
