// LeLeTV — 搜索结果卡片渲染模块
// 从 app-search.js 拆分

// 封面加载失败：去掉图片，露出下面的片名首字占位（没有占位层的卡片现补一个）
function _cardImgFallback(img) {
  img.onerror = null;
  var box = img.parentElement;
  if (!box) return;
  if (!box.querySelector('.v2-poster-empty')) {
    var title = (img.getAttribute('data-title') || '').trim();
    var empty = document.createElement('div');
    empty.className = 'v2-poster-empty';
    var mark = document.createElement('b');
    mark.textContent = title.slice(0, 1) || '·';
    var name = document.createElement('span');
    name.textContent = title;
    empty.append(mark, name);
    box.insertBefore(empty, box.firstChild);
  }
  img.remove();
}

// 封面加载完成：明显不是竖版 2:3 的（横版、方图）改成完整居中 + 同图模糊垫底
function _posterLoaded(img) {
  img.classList.add('loaded');
  var w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h || w / h <= 0.8) return;
  var box = img.parentElement;
  if (!box) return;
  box.classList.add('is-wide');
  box.style.setProperty('--poster', 'url("' + (img.currentSrc || img.src).replace(/["\\\n\r]/g, '') + '")');
}

function _escAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 片源速度分档：<1s 快 / 1-2s 中 / ≥2s 慢（与播放页线路列表同一口径）
function _latencyLevel(lat) {
  if (typeof lat !== 'number' || lat <= 0) return '';
  return lat < 1000 ? 'fast' : (lat < 2000 ? 'mid' : 'slow');
}

function _latencyText(lat) {
  if (typeof lat !== 'number' || lat <= 0) return '';
  // 秒数向下取整到 0.1s，避免 1999ms 与 2000ms 显示成同一个 "2.0s"
  return lat < 1000 ? (lat + 'ms') : ((Math.floor(lat / 100) / 10).toFixed(1) + 's');
}

// 合并用的片名：去掉空白、标点和大小写差异
function _normTitle(name) {
  return String(name || '').toLowerCase()
    .replace(/[\s　·•・:：,，.。!！?？'"“”‘’()（）【】\[\]《》<>\-—_~～]/g, '');
}

/**
 * 合并用的键：有的资源站把别名接在片名后面（「片名$别名」或「片名（别名）」），
 * 去掉别名再规范化，同一部片在各站的写法才对得上
 */
function _mergeKey(name) {
  var main = String(name || '').split('$')[0].trim().replace(/[（(【\[][^）)】\]]*[）)】\]]\s*$/, '');
  return _normTitle(main);
}

/**
 * 同名影片合并：片名规范化后相同、年份相同（或缺年份）的条目归为一组。
 * 传入的列表已按片源速度排好序，组内第一条就是最快的片源，点卡片即播放它；
 * 其余片源在播放页的「线路切换」里可以换。
 */
function _mergeResultsByTitle(items) {
  var groups = [];
  var byName = {};
  (items || []).forEach(function(item) {
    var key = _mergeKey(item.vod_name);
    if (!key) { groups.push({ lead: item, items: [item] }); return; }
    var year = String(item.vod_year || '').trim();
    var bucket = byName[key] || (byName[key] = []);
    var hit = null;
    for (var i = 0; i < bucket.length; i++) {
      var gy = bucket[i].year;
      if (!year || !gy || gy === year) { hit = bucket[i]; break; }
    }
    if (hit) {
      hit.items.push(item);
      if (!hit.year && year) hit.year = year;
    } else {
      var g = { lead: item, items: [item], year: year };
      bucket.push(g);
      groups.push(g);
    }
  });
  return groups;
}

// 单张结果卡片：2:3 海报 + 片名 + 年份类型；左下角标最快片源与速度，合并了多个片源时标 +N
function _buildResultCard(item, sameTitle) {
  var sid = (item.vod_id || '').toString().replace(/[^\w-]/g, '');
  var nameRaw = (item.vod_name || '').toString().trim();
  var sn = _escAttr(nameRaw);
  var sc = _escAttr(item.source_code || '');
  var au = item.api_url ? ' data-api-url="' + _escAttr(item.api_url) + '"' : '';
  var cover = item.vod_pic && /^https?:\/\//.test(item.vod_pic) ? item.vod_pic : '';
  var remarks = _escAttr((item.vod_remarks || '').toString().replace(/<[^>]+>/g, '').trim());
  var meta = [item.vod_year, item.type_name].filter(Boolean).map(function(v) { return _escAttr(String(v).trim()); }).join(' · ');
  var others = (sameTitle || []).slice(1);
  var lvl = _latencyLevel(item.source_latency);
  var latText = _latencyText(item.source_latency);
  var srcTitle = [item.source_name + (latText ? '（' + latText + '）' : '')].concat(others.map(function(o) { return o.source_name; })).filter(Boolean).join('、');

  var h = '<article class="v2-pcard v2-rcard search-result-card card-hover" role="button" tabindex="0" data-action="play-directly" data-id="' + sid + '" data-name="' + sn + '" data-source="' + sc + '"' + au + ' aria-label="播放 ' + sn + '">';
  // 片名首字占位垫在最下层：资源站的图床普遍偏慢，图片到之前卡片也不是一块黑
  h += '<div class="v2-poster"><div class="v2-poster-empty"><b>' + _escAttr(nameRaw.slice(0, 1) || '·') + '</b><span>' + sn + '</span></div>';
  if (cover) {
    h += '<img src="' + _escAttr(cover) + '" alt="" data-title="' + sn + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="_posterLoaded(this)" onerror="_cardImgFallback(this)">';
  }
  if (remarks) h += '<span class="v2-badge v2-badge--note">' + remarks + '</span>';
  if (item.source_name) {
    h += '<span class="v2-rcard-src" title="' + _escAttr('可用片源：' + srcTitle) + '">' + (lvl ? '<i class="lat-' + lvl + '"></i>' : '') + '<span>' + _escAttr(item.source_name) + '</span>' + (others.length ? '<em>+' + others.length + '</em>' : '') + '</span>';
  }
  h += '</div>';
  h += '<h3 title="' + sn + '">' + sn + '</h3>';
  h += '<p>' + (meta || '&nbsp;') + '</p>';
  var shareUrl = item.vod_id ? window.location.origin + '/player.html?id=' + encodeURIComponent(item.vod_id) + '&source=' + encodeURIComponent(item.source_code || '') + '&title=' + encodeURIComponent(nameRaw) : '';
  h += '<button type="button" class="v2-rcard-share card-share-btn" data-title="' + sn + '" data-url="' + _escAttr(shareUrl) + '" onclick="event.stopPropagation();_shareVideo(this.dataset.title, this.dataset.url)" aria-label="分享 ' + sn + '">';
  h += '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></button>';
  h += '</article>';
  return h;
}

/** 结果卡片列表。opts.merge 为 true 时先按片名合并（「全部」视图），单个片源的视图不合并 */
function _buildSearchCardsHtml(items, opts) {
  opts = opts || {};
  if (opts.merge) {
    return _mergeResultsByTitle(items).map(function(g) { return _buildResultCard(g.lead, g.items); }).join('');
  }
  return (items || []).map(function(item) { return _buildResultCard(item, null); }).join('');
}

// 卡片是 role="button" 的 <article>（里面还有分享按钮，不能用 <button> 嵌套），键盘回车 / 空格也要能触发
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var card = e.target && e.target.classList && e.target.classList.contains('search-result-card') ? e.target : null;
  if (!card) return;
  e.preventDefault();
  card.click();
});

function _chineseToNumber(str) {
  var n = {零:0, 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10, 百:100, 千:1000};
  if (/^d+$/.test(str)) return parseInt(str, 10);
  var r = 0, t = 0;
  for (var i = 0; i < str.length; i++) {
    var v = n[str[i]];
    if (v === undefined) continue;
    if (v >= 10) { r += (t || 1) * v; t = 0; } else { t = v; }
  }
  return r + t;
}

function _extractSeasonInfo(title) {
  var m = title.match(/第([一二三四五六七八九十百千d]+)(季|部|集)/);
  if (m) return { base: title.replace(m[0], "").replace(/s+$/, ""), season: _chineseToNumber(m[1]) };
  var sm = title.match(/S(d+)/i);
  if (sm) return { base: title.replace(sm[0], "").replace(/s+$/, ""), season: parseInt(sm[1], 10) };
  return { base: title, season: null };
}

// ===================== 延迟优先排序（搜索页与结果页共用唯一实现） =====================
// 依据：本次搜索的实时耗时 source_latency（与卡片上「快/中/慢」标签同一数据源）

/** 每个源本次搜索的最快耗时。同源结果通常共享同一次请求的耗时，取最小以兼容逐条计时的源 */
function _sourceFastestLatency(results) {
  var fastest = {};
  (results || []).forEach(function(item) {
    var code = item.source_code;
    var lat = item.source_latency;
    if (!code || typeof lat !== 'number' || lat <= 0) return;
    if (fastest[code] === undefined || lat < fastest[code]) fastest[code] = lat;
  });
  return fastest;
}

/** 源顺序：本次延迟升序；无本次延迟数据的源交给 fallbackSort 兜底（缺省保持原序） */
function _orderSourcesByLatency(codes, fastest, fallbackSort) {
  var known = [], unknown = [];
  (codes || []).forEach(function(c) {
    if (fastest && typeof fastest[c] === 'number') known.push(c); else unknown.push(c);
  });
  known.sort(function(a, b) { return fastest[a] - fastest[b]; });
  return known.concat(fallbackSort ? fallbackSort(unknown) : unknown);
}

/**
 * 统一结果排序：源本次延迟升序 → 片名(去季/部/集) → 季序 → 源名。
 * 无 source_latency 的结果（类别兜底、传统搜索）没有可比延迟，沉到末尾后按片名排序。
 * 注意不用 Infinity 参与减法（Infinity - Infinity 为 NaN 会破坏比较器）。
 */
function _sortResultsByLatencyThenName(list) {
  var arr = (list || []).slice();
  var fastest = _sourceFastestLatency(arr);
  return arr.sort(function(a, b) {
    var la = fastest[a.source_code];
    var lb = fastest[b.source_code];
    var hasA = typeof la === 'number';
    var hasB = typeof lb === 'number';
    if (hasA && hasB) {
      if (la !== lb) return la - lb;
    } else if (hasA !== hasB) {
      return hasA ? -1 : 1;
    }
    var seA = _extractSeasonInfo(a.vod_name || '');
    var seB = _extractSeasonInfo(b.vod_name || '');
    var baseCompare = seA.base.localeCompare(seB.base, 'zh-CN');
    if (baseCompare !== 0) return baseCompare;
    if (seA.season !== null && seB.season !== null) return seA.season - seB.season;
    if (seA.season !== null) return -1;
    if (seB.season !== null) return 1;
    return (a.source_name || '').localeCompare(b.source_name || '', 'zh-CN');
  });
}

function _getSourceLabel(apiId, results) {
  if (results) { var m = results.find(function(r) { return r.source_code === apiId; }); if (m && m.source_name) return m.source_name; }
  if (apiId.indexOf("custom_") === 0) { var i = parseInt(apiId.replace("custom_", "")); var a = customAPIs[i]; return a ? a.name : "自定义源" + (i+1); }
  if (API_SITES[apiId]) return API_SITES[apiId].name;
  return apiId;
}


function _initFilterTabs() {
  var ct = document.getElementById('sourceFilterTabs');
  if (!ct) return;
  if (!selectedAPIs || selectedAPIs.length === 0) { ct.innerHTML = ''; return; }
  var valid = selectedAPIs.filter(function(id) {
    if (id.indexOf('custom_') === 0) {
      var idx = parseInt(id.replace('custom_', ''));
      return idx >= 0 && idx < customAPIs.length;
    }
    return !!API_SITES[id];
  });
  if (valid.length === 0) { ct.innerHTML = ''; return; }
  var h = '<button class="source-filter-tab active" data-source="all">\u5168\u90e8 (0)</button>';
  valid.forEach(function(id) { h += '<button class="source-filter-tab" data-source="' + id + '">' + _getSourceLabel(id) + '</button>'; });
  ct.innerHTML = h;
}

function _renderSourceFilterTabs(totalCount) {
  var ct = document.getElementById('sourceFilterTabs');
  if (!ct) return;
  if (!_lastAllResults || _lastAllResults.length === 0) { ct.innerHTML = ''; return; }
  var ac = totalCount || _lastAllResults.length;
  var seen = new Set(), uniq = [];
  _lastAllResults.forEach(function(item) { var c = item.source_code; if (c && !seen.has(c)) { seen.add(c); uniq.push(c); } });
  // 标签顺序：本次搜索延迟快的源在前（与结果排序同一口径）
  uniq = _orderSourcesByLatency(uniq, _sourceFastestLatency(_lastAllResults));
  var h = '<button class="source-filter-tab active" data-source="all">\u5168\u90e8 (' + ac + ')</button>';
  uniq.forEach(function(code) {
    var label = _getSourceLabel(code, _lastAllResults);
    var cnt = _lastAllResults.filter(function(r) { return r.source_code === code; }).length;
    h += '<button class="source-filter-tab" data-source="' + code + '">' + label + ' (' + cnt + ')</button>';
  });
  ct.innerHTML = h;
}

function _updateAllTabCount(count) {
  var t = document.querySelector('#sourceFilterTabs .source-filter-tab[data-source="all"]');
  if (t) t.textContent = '\u5168\u90e8 (' + count + ')';
  var ct = document.getElementById('sourceFilterTabs');
  if (!ct || !_lastAllResults) return;
  ct.querySelectorAll('.source-filter-tab:not([data-source="all"])').forEach(function(tab) {
    var code = tab.dataset.source;
    var cnt = _lastAllResults.filter(function(r) { return r.source_code === code; }).length;
    tab.textContent = _getSourceLabel(code, _lastAllResults) + ' (' + cnt + ')';
  });
}

function _applySourceFilter(sourceFilter) {
  _activeSourceFilter = sourceFilter;
  document.querySelectorAll('#sourceFilterTabs .source-filter-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.source === sourceFilter);
  });
  var fr = _lastAllResults;
  if (sourceFilter !== 'all') fr = _lastAllResults.filter(function(r) { return r.source_code === sourceFilter; });
  document.getElementById('results').innerHTML = _buildSearchCardsHtml(fr);
  animateCardEntrance();
  var ra = document.getElementById('resultsArea');
  if (ra) ra.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function animateCardEntrance(containerSel) {
  var root = document.querySelector(containerSel || '#results');
  if (!root) return;
  if (window.LeLeMotion ? window.LeLeMotion.reduced() : (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  root.querySelectorAll('.card-hover').forEach(function(card, i) {
    if (i > 24) return;   // 只给首屏附近的卡片做入场，列表很长时不拖慢
    card.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, delay: i * 30, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
  });
}

// 加载中的海报骨架，与首页海报卡片同一形状
function generateSkeletonCards(count) {
  var n = count || 12;
  var html = '';
  for (var i = 0; i < n; i++) {
    html += '<div class="v2-pcard v2-skel" aria-hidden="true"><div class="v2-poster"></div><h3>　</h3><p>　</p></div>';
  }
  return html;
}
