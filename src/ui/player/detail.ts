// LeLeTV — 播放器详情渲染模块
// 从 player-ui.js 拆分

function renderPlayerDetailInfo(): void {
  var ct = document.getElementById('playerDetailInfo');
  if (!ct) return;
  var metaCt = document.getElementById('detailMetaContainer');
  var descBody = document.getElementById('detailDescBody');
  var arrow = ct.querySelector('.detail-toggle-arrow') as HTMLElement | null;
  var videoInfo: Record<string, unknown> | null = null;
  try { videoInfo = StorageService.getCurrentVideoInfo(); } catch(e) { console.warn('[LeLeTV] \u83b7\u53d6\u89c6\u9891\u8be6\u60c5\u5931\u8d25:', e); }
  var descText = videoInfo && videoInfo.desc ? String(videoInfo.desc).replace(/<[^>]+>/g, '').trim() : '';
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
  var toggleHd = ct.querySelector('.detail-toggle-header') as HTMLElement | null;
  if (toggleHd) toggleHd.style.display = hasActorOrDesc ? '' : 'none';
  if (hasActorOrDesc) ct.classList.add('detail-collapsed');
}

function toggleDetailInfo(): void {
  var ct = document.getElementById('playerDetailInfo');
  if (!ct) return;
  ct.classList.toggle('detail-collapsed');
}

function toggleEpisodeSection(): void {
  var sec = document.getElementById('episodeSection');
  if (sec) sec.classList.toggle('episode-collapsed');
}

function updateEpisodeCollapseState(): void {
  var sec = document.getElementById('episodeSection');
  if (sec) sec.classList.remove('episode-collapsed');
}

// 线路切换面板（折叠）：折叠态只显示「线路切换 · 当前源名 · 当前集共 N 个来源」，
// 展开后由 player-ui.js 扫描全部来源并逐条补上延迟
function renderResourceInfoBar(): void {
  var countEl = document.getElementById('resourceSourceCount');
  if (!countEl) return;
  if (typeof renderResourceCurrentSource === 'function') renderResourceCurrentSource();
  if (typeof updateResourceSourceCount === 'function') {
    updateResourceSourceCount();
    return;
  }
  countEl.textContent = '· 当前集共 - 个来源';
}

function getVideoCover(): string {
  try {
    var info = StorageService.getCurrentVideoInfo();
    if (info && typeof info.cover === 'string' && info.cover.indexOf('http') === 0) return info.cover;
  } catch(e) { console.warn('[LeLeTV] \u83b7\u53d6\u89c6\u9891\u5c01\u9762\u5931\u8d25:', e); }
  return '/image/logo-black.png';
}

function escHtml(str: unknown): string {
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 表单值转义：连 & 一起转，避免标题/简介里的实体写法被浏览器二次解析
function escTextField(str: unknown): string {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 编辑标题与简介：m3u8 直链等没有元数据的视频，手动补全后写回详情与观看历史
function showEditVideoInfoModal(): void {
  var info: Record<string, unknown> | null = null;
  try { info = StorageService.getCurrentVideoInfo(); } catch (e) { console.warn('[LeLeTV] 读取视频详情失败:', e); }
  info = info || {};

  var oldTitle = currentVideoTitle || '';
  var descText = String(info.desc || '').replace(/<[^>]+>/g, '').trim();

  showModal({
    title: '编辑视频信息',
    content: function (body, overlay) {
      body.innerHTML = `
        <div class="v2-field">
          <label class="v2-label" for="editVideoTitle">标题</label>
          <input type="text" id="editVideoTitle" class="v2-input" maxlength="80"
                 autocomplete="off" spellcheck="false" value="${escTextField(oldTitle)}">
        </div>
        <div class="v2-field">
          <label class="v2-label" for="editVideoDesc">简介</label>
          <textarea id="editVideoDesc" class="v2-input" rows="5" maxlength="2000"
                    placeholder="填写这部视频的简介">${escTextField(descText)}</textarea>
        </div>
        <div class="v2-dialog-foot is-end">
          <button type="button" class="v2-btn v2-btn--secondary" data-role="cancel">取消</button>
          <button type="button" class="v2-btn v2-btn--primary" data-role="save">保存</button>
        </div>
      `;

      var titleInput = body.querySelector('#editVideoTitle') as HTMLInputElement;
      var descInput = body.querySelector('#editVideoDesc') as HTMLTextAreaElement;
      titleInput.focus();
      titleInput.select();

      body.querySelector('[data-role="cancel"]').addEventListener('click', function () { overlay.remove(); });
      body.querySelector('[data-role="save"]').addEventListener('click', function () {
        var nextTitle = titleInput.value.trim();
        if (!nextTitle) {
          if (typeof showToast === 'function') showToast('标题不能为空', 'warning');
          titleInput.focus();
          return;
        }
        var nextDesc = descInput.value.trim();
        overlay.remove();
        saveVideoInfoEdits(oldTitle, nextTitle, nextDesc, info as Record<string, unknown>);
      });
    }
  });
}

function saveVideoInfoEdits(oldTitle: string, nextTitle: string, nextDesc: string, info: Record<string, unknown>): void {
  currentVideoTitle = nextTitle;
  try { localStorage.setItem('currentVideoTitle', nextTitle); } catch (e) { /* 忽略 */ }

  document.title = nextTitle + ' - LeLeTV播放器';
  var titleEl = document.getElementById('videoTitle');
  var titleRightEl = document.getElementById('videoTitleRight');
  if (titleEl) titleEl.textContent = nextTitle;
  if (titleRightEl) titleRightEl.textContent = nextTitle;

  var nextInfo = Object.assign({}, info || {}, { title: nextTitle, desc: nextDesc });
  try { StorageService.setCurrentVideoInfo(nextInfo); } catch (e) { console.warn('[LeLeTV] 保存视频详情失败:', e); }

  // 同步到观看历史：标题同时更新历史链接里的 title 参数，下次从历史进入仍是新标题
  try {
    var history = StorageService.getViewingHistory() as ViewingHistoryItem[];
    var encodedVideoUrl = currentVideoUrl ? encodeURIComponent(currentVideoUrl) : '';
    var idx = history.findIndex(function (item) {
      if (encodedVideoUrl && item.url && item.url.indexOf(encodedVideoUrl) !== -1) return true;
      return item.title === oldTitle && (item.episodeIndex === undefined || item.episodeIndex === currentEpisodeIndex);
    });
    if (idx !== -1) {
      var item = history[idx];
      item.title = nextTitle;
      item.desc = nextDesc;
      if (typeof nextInfo.cover === 'string') item.cover = nextInfo.cover;
      if (item.url && item.url.indexOf('src/pages/player/index.html') !== -1) {
        item.url = item.url.replace(/([?&])title=[^&]*/, '$1title=' + encodeURIComponent(nextTitle));
      }
      StorageService.setViewingHistory(history);
    }
  } catch (e) {
    console.warn('[LeLeTV] 同步历史记录信息失败:', e);
  }

  if (typeof updateMediaSession === 'function') updateMediaSession();
  renderPlayerDetailInfo();
  if (typeof showToast === 'function') showToast('视频信息已更新', 'success');
}


function _shareCurrentVideo(): void {
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

// 阶段 5A-6 过渡期兼容桥：player bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  renderPlayerDetailInfo,
  toggleDetailInfo,
  toggleEpisodeSection,
  updateEpisodeCollapseState,
  renderResourceInfoBar,
  getVideoCover,
  escHtml,
  showEditVideoInfoModal
});
