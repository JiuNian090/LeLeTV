// LeLeTV — 播放器详情渲染模块
// 从 player-ui.js 拆分

function renderPlayerDetailInfo() {
  var ct = document.getElementById('playerDetailInfo');
  if (!ct) return;
  var metaCt = document.getElementById('detailMetaContainer');
  var descBody = document.getElementById('detailDescBody');
  var arrow = ct.querySelector('.detail-toggle-arrow');
  var videoInfo = null;
  try { videoInfo = StorageService.getCurrentVideoInfo(); } catch(e) { console.warn('[LeLeTV] \u83b7\u53d6\u89c6\u9891\u8be6\u60c5\u5931\u8d25:', e); }
  var descText = videoInfo && videoInfo.desc ? videoInfo.desc.replace(/<[^>]+>/g, '').trim() : '';
  var hasMeta = videoInfo && (videoInfo.type || videoInfo.year || videoInfo.area || videoInfo.director || videoInfo.remarks);
  var hasActorOrDesc = videoInfo && (videoInfo.actor || descText);
  ct.style.display = 'block';
  if (metaCt && hasMeta) {
    var h = '<div class="detail-meta">';
    if (videoInfo.type) h += '<div class="detail-meta-item"><span class="detail-meta-label">\u7c7b\u578b:</span><span class="detail-meta-value">' + escHtml(videoInfo.type) + '</span></div>';
    if (videoInfo.year) h += '<div class="detail-meta-item"><span class="detail-meta-label">\u5e74\u4efd:</span><span class="detail-meta-value">' + escHtml(videoInfo.year) + '</span></div>';
    if (videoInfo.area) h += '<div class="detail-meta-item"><span class="detail-meta-label">\u5730\u533a:</span><span class="detail-meta-value">' + escHtml(videoInfo.area) + '</span></div>';
    if (videoInfo.director) h += '<div class="detail-meta-item"><span class="detail-meta-label">\u5bfc\u6f14:</span><span class="detail-meta-value">' + escHtml(videoInfo.director) + '</span></div>';
    if (videoInfo.remarks) h += '<div class="detail-meta-item"><span class="detail-meta-label">\u5907\u6ce8:</span><span class="detail-meta-value">' + escHtml(videoInfo.remarks) + '</span></div>';
    h += '</div>';
    metaCt.innerHTML = h;
  } else if (metaCt) { metaCt.innerHTML = ''; }
  if (descBody) {
    var dh = '';
    if (videoInfo && videoInfo.actor) dh += '<div class="detail-meta detail-meta-collapsible"><div class="detail-meta-item"><span class="detail-meta-label">\u4e3b\u6f14:</span><span class="detail-meta-value">' + escHtml(videoInfo.actor) + '</span></div></div>';
    if (descText) dh += '<div class="detail-desc-content"><span class="detail-meta-label">\u7b80\u4ecb:</span>' + escHtml(descText) + '</div>';
    if (dh) { descBody.innerHTML = dh; if (arrow) arrow.style.display = ''; }
    else { descBody.innerHTML = ''; if (arrow) arrow.style.display = 'none'; }
  }
  var toggleHd = ct.querySelector('.detail-toggle-header');
  if (toggleHd) toggleHd.style.display = hasActorOrDesc ? '' : 'none';
  if (hasActorOrDesc) ct.classList.add('detail-collapsed');
}

function toggleDetailInfo() {
  var ct = document.getElementById('playerDetailInfo');
  if (!ct) return;
  ct.classList.toggle('detail-collapsed');
}

function toggleEpisodeSection() {
  var sec = document.getElementById('episodeSection');
  if (sec) sec.classList.toggle('episode-collapsed');
}

function updateEpisodeCollapseState() {
  var sec = document.getElementById('episodeSection');
  if (sec) sec.classList.remove('episode-collapsed');
}

// 线路切换面板（折叠）：折叠态只显示「线路切换 · 当前源名 · 当前集共 N 个来源」，
// 展开后由 player-ui.js 扫描全部来源并逐条补上延迟
function renderResourceInfoBar() {
  var countEl = document.getElementById('resourceSourceCount');
  if (!countEl) return;
  if (typeof renderResourceCurrentSource === 'function') renderResourceCurrentSource();
  if (typeof updateResourceSourceCount === 'function') {
    updateResourceSourceCount();
    return;
  }
  countEl.textContent = '· 当前集共 - 个来源';
}

function getVideoCover() {
  try {
    var info = StorageService.getCurrentVideoInfo();
    if (info && info.cover && info.cover.indexOf('http') === 0) return info.cover;
  } catch(e) { console.warn('[LeLeTV] \u83b7\u53d6\u89c6\u9891\u5c01\u9762\u5931\u8d25:', e); }
  return '/image/logo-black.png';
}

function escHtml(str) {
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


function _shareCurrentVideo() {
  var url = window.location.href;
  var title = currentVideoTitle || document.title;
  if (navigator.share) {
    navigator.share({ title: title, url: url }).catch(function() {});
  } else {
    navigator.clipboard.writeText(url).then(function() {
      if (typeof showToast === "function") showToast("链接已复制", "success");
    }).catch(function() {});
  }
}
