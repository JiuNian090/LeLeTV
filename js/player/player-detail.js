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

function renderResourceInfoBar() {
  var ct = document.getElementById('resourceInfoBarContainer');
  if (!ct) { console.error('\u627e\u4e0d\u5230\u8d44\u6e90\u4fe1\u606f\u5361\u7247\u5bb9\u5668'); return; }
  var urlParams = new URLSearchParams(window.location.search);
  var currentSource = urlParams.get('source') || '';
  ct.innerHTML = '<div class="resource-info-bar-left flex"><span>\u52a0\u8f7d\u4e2d...</span><span class="resource-info-bar-videos">-</span></div><button class="resource-switch-btn flex" id="switchResourceBtn" data-action="show-switch-resource"><span class="resource-switch-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>\u5207\u6362\u8d44\u6e90</button>';
  var rn = currentSource;
  if (currentSource && API_SITES[currentSource]) rn = API_SITES[currentSource].name;
  if (rn === currentSource) {
    var caps = JSON.parse(localStorage.getItem('customAPIs') || '[]');
    var ci = parseInt(currentSource.replace('custom_', ''), 10);
    if (caps[ci]) rn = caps[ci].name || '\u81ea\u5b9a\u4e49\u8d44\u6e90';
  }
  ct.innerHTML = '<div class="resource-info-bar-left flex"><span>' + rn + '</span><span class="resource-info-bar-videos">' + currentEpisodes.length + ' \u4e2a\u89c6\u9891</span></div><button class="resource-switch-btn flex" id="switchResourceBtn" data-action="show-switch-resource"><span class="resource-switch-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>\u5207\u6362\u8d44\u6e90</button>';
}

function getVideoCover() {
  try {
    var info = StorageService.getCurrentVideoInfo();
    if (info && info.cover && info.cover.indexOf('http') === 0) return info.cover;
  } catch(e) { console.warn('[LeLeTV] \u83b7\u53d6\u89c6\u9891\u5c01\u9762\u5931\u8d25:', e); }
  return '/image/logo-black.png';
}

function formatSpeedDisplay(speedResult) {
  if (speedResult.speed === -1) return '<span class="speed-indicator error">\u274c ' + (speedResult.error || '\u5931\u8d25') + '</span>';
  var s = speedResult.speed;
  var cls = 'speed-indicator good', ico = '\ud83d\udfe2';
  if (s > 500) { cls = 'speed-indicator poor'; ico = '\ud83d\udd34'; }
  else if (s > 200) { cls = 'speed-indicator medium'; ico = '\ud83d\udfe1'; }
  return '<span class="' + cls + '">' + ico + ' ' + s + 'ms</span>';
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
