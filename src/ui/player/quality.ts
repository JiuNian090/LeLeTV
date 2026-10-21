// LeLeTV — HLS 清晰度切换模块
// 依赖 player-core.js 中的 Hls 全局变量

interface QualityLevel {
  height?: number;
  bitrate?: number;
}

interface QualityHls extends HlsInstance {
  levels?: QualityLevel[];
  currentLevel?: number;
}

interface QualityArt {
  template?: { $controlsLeft?: HTMLElement };
}

interface QualityWindow extends Window {
  art?: QualityArt;
}

var _hlsLevels: { index: number; label: string; height: number }[] = [];

export function setupQualitySwitcher(hls: QualityHls): void {
  hls.on(Hls.Events.MANIFEST_PARSED, function() {
    if (!hls.levels || hls.levels.length <= 1) {
      _hlsLevels = [];
      return;
    }
    _hlsLevels = hls.levels.map(function(level: QualityLevel, idx: number) {
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

function addQualityButton(hls: QualityHls): void {
  var art = (window as QualityWindow).art;
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

  var controlsLeft = art.template?.$controlsLeft;
  if (controlsLeft) controlsLeft.appendChild(btn);
}

function toggleQualityMenu(art: QualityArt, hls: QualityHls, btn: HTMLElement): void {
  var old = document.querySelector('.hls-quality-menu');
  if (old) { old.remove(); return; }

  var menu = document.createElement('div');
  menu.className = 'hls-quality-menu';
  menu.style.cssText = 'position:absolute;bottom:100%;left:0;background:rgba(0,0,0,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 0;z-index:9999;min-width:110px;';

  function makeItem(text: string, isActive: boolean, onClick: () => void): HTMLElement {
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'padding:8px 16px;cursor:pointer;color:' + (isActive ? ((typeof themeColor === 'function') ? themeColor() : '#ec4899') : 'rgba(255,255,255,0.85)') + ';font-size:13px;transition:background 0.15s;';
    el.onmouseenter = function() { el.style.background = 'rgba(255,255,255,0.1)'; };
    el.onmouseleave = function() { el.style.background = 'none'; };
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
    function close(e: MouseEvent) {
      if (!menu.contains(e.target as Node) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    }
    document.addEventListener('click', close);
  }, 0);
}

function updateQLabel(btn: HTMLElement, label: string): void {
  var s = btn.querySelector('.qlabel');
  if (s) s.textContent = label;
}

// 阶段 5A-6 过渡期兼容桥：player bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  setupQualitySwitcher
});

// 阶段 5B-3 过渡期类型桥：quality.ts 已成为 ESM 模块，core 仍以裸名调用。
declare global {
  function setupQualitySwitcher(hls: unknown): void;
}
