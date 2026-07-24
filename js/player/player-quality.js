// LeLeTV — HLS 清晰度切换模块
// 依赖 player-core.js 中的 Hls 全局变量

var _hlsLevels = [];

function setupQualitySwitcher(hls) {
  hls.on(Hls.Events.MANIFEST_PARSED, function() {
    if (!hls.levels || hls.levels.length <= 1) {
      _hlsLevels = [];
      return;
    }
    _hlsLevels = hls.levels.map(function(level, idx) {
      var h = level.height || 0;
      var b = level.bitrate || 0;
      var label = h >= 2160 ? '4K' : h >= 1440 ? '2K' : h >= 1080 ? '1080P' :
                  h >= 720 ? '720P' : h >= 480 ? '480P' : h >= 360 ? '360P' : '\u81ea\u52a8';
      if (b) label += ' (' + (b / 1000000).toFixed(1) + 'M)';
      return { index: idx, label: label, height: h };
    });
    addQualityButton(hls);
  });
}

function addQualityButton(hls) {
  var art = window.art;
  if (!art || _hlsLevels.length <= 1) return;

  var btn = document.createElement('div');
  btn.className = 'art-control art-control-quality';
  btn.innerHTML = '<span class="qlabel">\u81ea\u52a8</span>';
  btn.title = '\u5207\u6362\u6e05\u6670\u5ea6';
  btn.style.cssText = 'display:flex;align-items:center;padding:0 8px;cursor:pointer;opacity:0.9;font-size:12px;white-space:nowrap;color:rgba(255,255,255,0.8);order:999;';

  btn.onclick = function(e) {
    e.stopPropagation();
    toggleQualityMenu(art, hls, btn);
  };

  var controlsLeft = art.template.$controlsLeft;
  if (controlsLeft) controlsLeft.appendChild(btn);
}

function toggleQualityMenu(art, hls, btn) {
  var old = document.querySelector('.hls-quality-menu');
  if (old) { old.remove(); return; }

  var menu = document.createElement('div');
  menu.className = 'hls-quality-menu';
  menu.style.cssText = 'position:absolute;bottom:100%;left:0;background:rgba(0,0,0,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 0;z-index:9999;min-width:110px;';

  function makeItem(text, isActive, onClick) {
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'padding:8px 16px;cursor:pointer;color:' + (isActive ? '#ec4899' : 'rgba(255,255,255,0.85)') + ';font-size:13px;transition:background 0.15s;';
    el.onmouseenter = function() { this.style.background = 'rgba(255,255,255,0.1)'; };
    el.onmouseleave = function() { this.style.background = 'none'; };
    el.onclick = function(e) { e.stopPropagation(); onClick(); menu.remove(); };
    return el;
  }

  menu.appendChild(makeItem('\u81ea\u52a8', hls.currentLevel === -1, function() {
    hls.currentLevel = -1;
    updateQLabel(btn, '\u81ea\u52a8');
  }));

  _hlsLevels.forEach(function(level) {
    menu.appendChild(makeItem(level.label, hls.currentLevel === level.index, function() {
      hls.currentLevel = level.index;
      updateQLabel(btn, level.label);
    }));
  });

  btn.style.position = 'relative';
  btn.appendChild(menu);

  setTimeout(function() {
    function close(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    }
    document.addEventListener('click', close);
  }, 0);
}

function updateQLabel(btn, label) {
  var s = btn.querySelector('.qlabel');
  if (s) s.textContent = label;
}
