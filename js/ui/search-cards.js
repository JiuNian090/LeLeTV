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

function _buildSearchCardsHtml(items) {
  return items.map(function(item) {
    var sid = (item.vod_id || "").toString().replace(/[^\w-]/g, "");
    var sn = (item.vod_name || "").toString().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    var srcInfo = item.source_name ? "<span class='source-label-tag'>" + item.source_name + "</span>" : "";
    var sc = item.source_code || "";
    var au = item.api_url ? " data-api-url='" + item.api_url.replace(/"/g, "&quot;") + "'" : "";
    var cv = item.vod_pic && item.vod_pic.indexOf("http") === 0;
    var h = "<div class='card-hover search-result-card rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md' data-action='play-directly' data-id='" + sid + "' data-name='" + sn + "' data-source='" + sc + "'" + au + ">";
    h += "<div class='flex h-full'>";
    if (cv) { h += "<div class='search-card-img-container'><img src='" + item.vod_pic + "' alt='" + sn + "' loading='lazy' class='loading-fade' onerror=\"_cardImgFallback(this)\" onload=\"this.classList.add('loaded')\"></div>"; }
    h += "<div class='card-content'><div class='card-content-header'><h3 title='" + sn + "'>" + sn + "</h3><div class='card-content-tags'>";
    var tn = (item.type_name || "").toString().replace(/</g, "&lt;");
    if (tn) h += "<span>" + tn + "</span>";
    if (item.vod_year) h += "<span>" + item.vod_year + "</span>";
    h += "</div></div>";
    h += "<p class='card-content-description'>" + (item.vod_remarks || "暂无介绍").toString().replace(/</g, "&lt;") + "</p>";
    h += "<div class='card-content-footer'>" + (srcInfo || "") + "</div></div></div>";
    h += "<button class='card-share-btn' data-action='share-video' data-title='" + sn + "' data-url='" + (item.vod_id ? window.location.origin + "/player.html?id=" + encodeURIComponent(item.vod_id) + "&source=" + encodeURIComponent(sc || "") + "&title=" + encodeURIComponent(sn) : "") + "' onclick='event.stopPropagation();_shareVideo(this.dataset.title, this.dataset.url)' title='分享'>&#x2197;</button></div>";
    return h;
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

function animateCardEntrance() {
  document.querySelectorAll('#results .card-hover').forEach(function(card, i) {
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
  var cols = window.innerWidth < 640 ? 1 : window.innerWidth < 768 ? 2 : window.innerWidth < 1024 ? 3 : 4;
  var cards = [];
  for (var i = 0; i < Math.max(count, cols * 2); i++) {
    cards.push('<div class="skeleton-card"><div class="skeleton-card-img"></div><div class="skeleton-card-body"><div class="skeleton-line" style="width:85%"></div><div class="skeleton-line" style="width:55%"></div><div class="skeleton-tags"><div class="skeleton-tag"></div><div class="skeleton-tag"></div></div><div class="skeleton-line-sm" style="margin-top:auto"></div><div class="skeleton-line-xs"></div></div></div>');
  }
  return cards.join('');
}
