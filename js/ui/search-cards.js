// LeLeTV — 搜索结果卡片渲染模块
// 从 app-search.js 拆分

// 封面加载失败的本地 fallback（内联 SVG data URI，永不失效）
// 注意：必须在替换 src 前先添加 loaded 类，否则 img.loading-fade 仍为 opacity:0
var _CARD_IMG_FALLBACK_SRC = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"><rect width="300" height="450" fill="#191919"/><g fill="none" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="100" y="160" width="100" height="80" rx="4"/><circle cx="120" cy="182" r="6" fill="#444"/><path d="M100 235 L145 195 L200 250"/></g><text x="150" y="290" font-size="18" fill="#666" text-anchor="middle" font-family="sans-serif">无封面</text></svg>');
function _cardImgFallback(img) {
  img.onerror = null;
  img.classList.add('loaded');
  img.classList.add('object-contain');
  img.src = _CARD_IMG_FALLBACK_SRC;
}

// 来源多色色板：角标 / 来源标识 / 侧栏图标按 source_code 稳定取色
var _SOURCE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#eab308'];

function _sourceColor(code) {
  var s = String(code || '');
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _SOURCE_COLORS[h % _SOURCE_COLORS.length];
}

function _buildSearchCardsHtml(items) {
  return items.map(function(item) {
    var sid = (item.vod_id || "").toString().replace(/[^\w-]/g, "");
    var sn = (item.vod_name || "").toString().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    var srcInfo = "";
    if (item.source_name) {
      srcInfo += "<span class='source-label-tag'>" + item.source_name + "</span>";
      // 该源本次搜索的耗时：<1s 快（绿）/ 1-2s 中（黄）/ ≥2s 慢（红）
      var lat = item.source_latency;
      if (typeof lat === "number" && lat > 0) {
        var lvl = lat < 1000 ? "fast" : (lat < 2000 ? "mid" : "slow");
        var lvlName = lat < 1000 ? "快" : (lat < 2000 ? "中" : "慢");
        // 秒数向下取整到 0.1s，避免 1999ms 与 2000ms 显示成同一个 "2.0s"
        var latText = lat < 1000 ? (lat + "ms") : ((Math.floor(lat / 100) / 10).toFixed(1) + "s");
        srcInfo += "<span class='source-latency-tag latency-" + lvl + "' title='该源本次搜索耗时 " + lat + "ms（" + lvlName + "）'>" + latText + "</span>";
      }
    }
    var sc = item.source_code || "";
    var au = item.api_url ? " data-api-url='" + item.api_url.replace(/"/g, "&quot;") + "'" : "";
    var cv = item.vod_pic && item.vod_pic.indexOf("http") === 0;
    // 提取简介：优先 vod_blurb，其次从 vod_content 中剥离HTML
    var desc = "";
    if (item.vod_blurb) {
      desc = item.vod_blurb.toString().replace(/<[^>]+>/g, "").replace(/</g, "&lt;").trim();
    } else if (item.vod_content) {
      desc = item.vod_content.toString().replace(/<[^>]+>/g, "").replace(/</g, "&lt;").trim();
    }
    if (desc.length > 200) desc = desc.substring(0, 200);
    var remarks = (item.vod_remarks || "").toString().replace(/</g, "&lt;");
    // 项目卡片样式：圆角、左海报 + 右内容、粉色标签
    var h = "<div class='card-hover search-result-card rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md' data-action='play-directly' data-id='" + sid + "' data-name='" + sn + "' data-source='" + sc + "'" + au + ">";
    h += "<div class='flex h-full'>";
    if (cv) { h += "<div class='search-card-img-container'><img src='" + item.vod_pic + "' alt='" + sn + "' loading='lazy' class='loading-fade' onerror=\"_cardImgFallback(this)\" onload=\"this.classList.add('loaded')\"></div>"; }
    h += "<div class='card-content'><div class='card-content-header'><h3 title='" + sn + "'>" + sn + "</h3><div class='card-content-tags'>";
    var tn = (item.type_name || "").toString().replace(/</g, "&lt;");
    if (tn) h += "<span>" + tn + "</span>";
    if (item.vod_year) h += "<span>" + item.vod_year + "</span>";
    h += "</div></div>";
    if (remarks) h += "<p class='card-content-remarks'>" + remarks + "</p>";
    if (desc) h += "<p class='card-content-synopsis'>" + desc + "</p>";
    h += "<div class='card-content-footer'>" + (srcInfo || "") + "</div></div></div>";
    h += "<button class='card-share-btn' data-action='share-video' data-title='" + sn + "' data-url='" + (item.vod_id ? window.location.origin + "/player.html?id=" + encodeURIComponent(item.vod_id) + "&source=" + encodeURIComponent(sc || "") + "&title=" + encodeURIComponent(sn) : "") + "' onclick='event.stopPropagation();_shareVideo(this.dataset.title, this.dataset.url)' title='分享'>&#x2197;</button></div>";
    return h;
  }).join("");
}

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
  root.querySelectorAll('.card-hover').forEach(function(card, i) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    setTimeout(function() {
      card.style.transition = 'opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 50);
  });
}

function generateSkeletonCards(count) {
  if (count === undefined) count = 8;
  var cols = window.innerWidth < 640 ? 1 : window.innerWidth < 768 ? 2 : window.innerWidth < 1024 ? 3 : window.innerWidth < 1440 ? 3 : window.innerWidth < 1920 ? 4 : 5;
  var cards = [];
  for (var i = 0; i < Math.max(count, cols * 2); i++) {
    cards.push('<div class="skeleton-card"><div class="skeleton-card-img"></div><div class="skeleton-card-body"><div class="skeleton-line" style="width:85%"></div><div class="skeleton-line" style="width:55%"></div><div class="skeleton-tags"><div class="skeleton-tag"></div><div class="skeleton-tag"></div></div><div class="skeleton-line-sm" style="width:40%"></div><div class="skeleton-line-xs"></div><div class="skeleton-line-xs" style="width:90%"></div><div class="skeleton-line-xs" style="margin-top:auto"></div></div></div>');
  }
  return cards.join('');
}
