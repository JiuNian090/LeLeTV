// LeLeTV - Hash routing module
// Extracted from index.html inline script
let currentPage = 'home';

// 整页重载（如切换隐藏/正常内容模式）前记录目标页，重载后恢复到该页
const RELOAD_RESUME_PAGE_KEY = 'leletv_reload_resume_page';

// 记录重载后应停留的页面：URL 只保留目标页 hash（丢掉搜索残留），并用 sessionStorage 兜底
function rememberPageForReload(page) {
  try {
    sessionStorage.setItem(RELOAD_RESUME_PAGE_KEY, page);
    // 只保留目标页 hash：清掉 /s=关键词 路径与 ?s= 查询串这类搜索残留，
    // 否则重载后首页初始化会把上次搜索词当直链再搜一次、跳回结果页
    var path = location.pathname || '/';
    if (path.indexOf('/s=') === 0) path = '/';
    history.replaceState(null, '', path + '#' + page);
  } catch (e) { /* 隐私模式等场景忽略：仅影响重载后的落点 */ }
}

// ===================== 数据域切换的过渡 =====================
// 隐藏/正常模式切换需整页重载，为消除闪屏与加载弹窗：
// 重载前——设置页内容整体淡出 + 卡片化作细密粒子向上飘散湮灭
// （参考 Telegram 删除消息 / HarmonyOS 删除通知的消散）；
// 重载后——粒子自随机位置螺旋向中心凝聚成 LeLeTV，成型后爆开，设置页内容整体淡入。
// 隐藏范围是"整个设置页内容"：首帧靠 css 的 html[data-init-page="settings"] 规则（head 阶段即生效），
// 之后由 html[data-particle-in] 接手，直到动效揭示完成。
var PARTICLE_SWEEP_KEY = 'leletv_particle_sweep';
var PARTICLE_CARD_SELECTOR = '#page-settings .dash-card';
var PARTICLE_SWEEP_MS = 950;       // 消散时长（放慢：粒子悠长上飘，不再一闪而过）
// 消散遮罩渐变的目标深色：与 index.html 的 #bootSplash 背景、--color-bg、.page-bg 保持同一个值，
// 重载前后才能无缝接续。此处硬编码而非读 CSS 变量：启动占位在样式表之前就会用到它
var PARTICLE_SWEEP_BG = '#000000';
var PARTICLE_SWEEP_STEP = 6;       // 采样步长基准（px）：越小粒子越细密
var PARTICLE_MAX = 6000;           // 粒子总数上限：采样步长会按卡片面积自适应放宽
var PARTICLE_RISE = 58;            // 向上飘散高度基准（px）
var PARTICLE_WIND_X = 42;          // 风的水平推力（px，正值向右；越到后段推得越远）
var PARTICLE_WIND_Y = -18;         // 风的上升分量（px，负值向上）
var PARTICLE_GUST = 0.3;           // 阵风幅度：整体风力的周期性强弱（0 = 恒定风）
var PARTICLE_ALPHA_STEPS = 32;     // 透明度量化档数（预生成颜色串，避免逐帧拼接字符串）
// 粒子只用主题色本身，不掺白色/浅灰：色调完全跟随所选主题色与当前模式，
// 层次感由粒子的尺寸与透明度随机给出。rgb 为 null 占位，首次构建颜色表时填充（见 _particleColorTable）
var PARTICLE_PALETTE = [
  { rgb: null, weight: 1 }
];

// 重载后的入场：粒子自随机位置螺旋向中心凝聚成 LeLeTV（与首页标题同款的 MapleMono 玻璃质感字样），
// 成型后爆开，再让设置页内容整体淡入。
// 消散与入场都以"整个设置页内容"为整体目标（首帧经 css 的 data-init-page 规则隐藏，
// 随后由 data-particle-in 接手，避免框架漏出来、再出卡片造成的闪现）。

// ===== 主题色取值（正常模式霓虹粉 / 私密模式鸿蒙便签黄）=====
// 结果缓存一次：模式切换会整页重载，页面生命周期内不会变，
// 避免逐帧 getComputedStyle 触发布局/样式重算
var _themeRgbCache = null;
function _themeRgbParts() {
  if (_themeRgbCache) return _themeRgbCache;
  var parts = null;
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim();
    var arr = v.split(',').map(function (n) { return parseInt(n, 10); });
    if (arr.length === 3 && arr[0] >= 0 && arr[1] >= 0 && arr[2] >= 0) parts = arr;
  } catch (e) { /* 忽略 */ }
  if (!parts) {
    parts = document.documentElement.hasAttribute('data-hidden-mode') ? [184, 115, 51] : [236, 72, 153];
  }
  _themeRgbCache = parts;
  return parts;
}
function _themeRgba(alpha) {
  var c = _themeRgbParts();
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
}
function _themeHex() {
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    if (v) return v;
  } catch (e) { /* 忽略 */ }
  return document.documentElement.hasAttribute('data-hidden-mode') ? '#B87333' : '#ec4899';
}

var DOMAIN_GATHER_MS = 680;      // 粒子螺旋凝聚 + 字样成形
var DOMAIN_HOLD_MS = 140;        // 成型停留
var DOMAIN_BURST_MS = 380;       // 爆开
var DOMAIN_PARTICLE_MAX = 1500;  // 粒子数上限
var DOMAIN_TEXT = 'LeLeTV';      // 中心字样（与首页标题一致）
var REVEAL_DURATION_MS = 460;    // 爆开后设置页内容淡入时长
var REVEAL_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

var _entranceStarted = false;

// 本脚本在 defer 阶段执行：若本次加载来自数据域切换，先把设置页内容整体藏住
// （首帧其实已由 css 的 html[data-init-page="settings"] 规则藏住，这里接手继续隐藏）
var _particleIncoming = false;
try { _particleIncoming = sessionStorage.getItem(PARTICLE_SWEEP_KEY) === '1'; } catch (e) { /* 忽略 */ }
// 启动占位（index.html 的 #bootSplash）已接管这次切换的遮罩：它自己就能挡住首帧，
// 所以不必再藏设置页内容——反过来要放行，让新页面在深色遮罩下就绪
var _bootSplashOwnsTransition = !!window.__LELETV_BOOT_INTRO__;
if (_particleIncoming && !_bootSplashOwnsTransition) {
  document.documentElement.setAttribute('data-particle-in', '1');
  // 兜底：任何原因导致入场动画没启动，也不能让设置页一直不可见
  setTimeout(function () {
    if (!_entranceStarted) {
      _resetPanel();
    }
  }, 3000);
} else {
  // 非过渡加载（手动刷新 / 直链打开设置页），或本次由启动占位接管：立刻放行首帧隐藏
  document.documentElement.setAttribute('data-domain-shown', '1');
}

function _particleReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

function _particleCards() {
  return Array.prototype.slice.call(document.querySelectorAll(PARTICLE_CARD_SELECTOR));
}

function _particleNewCanvas() {
  var old = document.getElementById('particleTransitionCanvas');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = window.innerWidth;
  var h = window.innerHeight;
  var cv = document.createElement('canvas');
  cv.id = 'particleTransitionCanvas';
  cv.className = 'particle-transition-canvas';
  cv.width = Math.max(1, Math.floor(w * dpr));
  cv.height = Math.max(1, Math.floor(h * dpr));
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  var ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  document.body.appendChild(cv);
  return { ctx: ctx, canvas: cv };
}

function _particleDropCanvas(canvas) {
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
}

// 调色板随机取色（返回 PARTICLE_PALETTE 下标）
function _particlePickColor() {
  var r = Math.random();
  var acc = 0;
  for (var i = 0; i < PARTICLE_PALETTE.length; i++) {
    acc += PARTICLE_PALETTE[i].weight;
    if (r <= acc) return i;
  }
  return 0;
}

// 预生成 rgba 字符串（透明度量化 × 调色板）：粒子多时避免每帧拼接字符串造成 GC 抖动
var _particleColorCache = null;
function _particleColorTable() {
  if (_particleColorCache) return _particleColorCache;
  if (!PARTICLE_PALETTE[0].rgb) PARTICLE_PALETTE[0].rgb = _themeRgbParts();
  var table = [];
  PARTICLE_PALETTE.forEach(function (p) {
    var row = [];
    for (var i = 0; i <= PARTICLE_ALPHA_STEPS; i++) {
      row.push('rgba(' + p.rgb[0] + ',' + p.rgb[1] + ',' + p.rgb[2] + ',' + (i / PARTICLE_ALPHA_STEPS).toFixed(2) + ')');
    }
    table.push(row);
  });
  _particleColorCache = table;
  return table;
}

// 采样：在元素区域按网格生成粒子种子，记录"元素内位置 → 向上飘散终点"、延迟、寿命与摆动参数。
// duration / riseBase 可覆盖：删除单项这类小场景用更短时长、更低的飘散高度。
function _particleSeeds(elements, duration, riseBase) {
  var total = duration || PARTICLE_SWEEP_MS;
  var baseRise = riseBase || PARTICLE_RISE;
  var boxes = [];
  elements.forEach(function (element) {
    var r = element.getBoundingClientRect();
    if (r.width > 8 && r.height > 8) boxes.push(r);
  });
  if (!boxes.length) return [];

  var area = 0;
  boxes.forEach(function (r) { area += r.width * r.height; });
  var step = PARTICLE_SWEEP_STEP;
  if (area < 90000) step = 4; // 小区域（历史条目、下拉项…）采样更细，保证粒子密度
  while (area / (step * step) > PARTICLE_MAX && step < 26) step += 1;

  var seeds = [];
  boxes.forEach(function (r) {
    for (var y = r.top + step / 2; y < r.bottom; y += step) {
      for (var x = r.left + step / 2; x < r.right; x += step) {
        // 越靠上的粒子飘散距离越短，接近"被上方气流抽走的尘埃"
        var depth = (y - r.top) / (r.height || 1);
        var rise = baseRise * (0.45 + 0.85 * (1 - depth)) * (0.55 + Math.random() * 0.9);
        seeds.push({
          fx: x,
          fy: y,
          tx: x + (Math.random() - 0.5) * 18, // 基础漂移（主位移交给"风"）
          ty: y - rise,
          delay: Math.random() * total * 0.22,
          life: total * (0.5 + Math.random() * 0.35),
          amp: 1.2 + Math.random() * 3.2,  // 摆动幅度
          freq: 0.6 + Math.random() * 1.5, // 摆动频率
          phase: Math.random() * Math.PI * 2,
          // 受风系数：轻重/阻力不同的尘埃被吹得远近不同；小场景（删除单项）按飘散高度等比缩小
          wind: (0.55 + Math.random() * 1.1) * (baseRise / PARTICLE_RISE),
          swirl: (Math.random() - 0.5) * 1.6, // 湍流强弱（有正有负，形成涡动）
          size: 0.9 + Math.random() * 1.3,
          color: _particlePickColor(),
          px: x,
          py: y,
          alpha: 1
        });
      }
    }
  });
  return seeds;
}

// 推进粒子：reverse=false 为消散（进度 0→1），true 为逆向回收（1→0），透明度与位移同步反演。
// 消散叠加"风"：整体推力 + 个体受风系数 + 双频湍流摆 + 阵风 —— 看起来是被风吹散，而非直上直下
function _particleUpdate(seeds, elapsed, reverse) {
  // 阵风：所有粒子共用相位，才有"一阵风扫过"的整体感
  var gust = 1 + PARTICLE_GUST * Math.sin(elapsed * 0.005);
  for (var i = 0; i < seeds.length; i++) {
    var s = seeds[i];
    var local = (elapsed - s.delay) / s.life;
    local = local < 0 ? 0 : (local > 1 ? 1 : local);
    var p = reverse ? 1 - local : local;
    var ease = 1 - Math.pow(1 - p, 3); // 起手像被抽离，尾部缓慢湮灭
    // 风压随进度加速（p²）：起手只是被掀起，越往后被吹得越远
    var wind = PARTICLE_WIND_X * p * p * s.wind * gust;
    var windY = PARTICLE_WIND_Y * p * p * s.wind * gust;
    // 湍流：两层不同频率的正弦叠加，摆动不再规则
    var sway = Math.sin(s.phase + p * s.freq * 6.283) * s.amp * p
      + Math.sin(s.phase * 1.7 + p * s.freq * 2.4) * s.amp * 0.5 * s.swirl * p;
    s.px = s.fx + (s.tx - s.fx) * ease + sway + wind;
    s.py = s.fy + (s.ty - s.fy) * ease + windY;
    var a = 1 - p;
    s.alpha = a * a;
  }
}

function _particlePaint(ctx, seeds) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  var table = _particleColorTable();
  for (var i = 0; i < seeds.length; i++) {
    var s = seeds[i];
    if (s.alpha <= 0.02) continue;
    var idx = Math.round(s.alpha * PARTICLE_ALPHA_STEPS);
    if (idx > PARTICLE_ALPHA_STEPS) idx = PARTICLE_ALPHA_STEPS;
    ctx.fillStyle = table[s.color][idx];
    ctx.fillRect(s.px, s.py, s.size, s.size);
  }
}

function _particleNow() {
  return (window.performance && performance.now) ? performance.now() : Date.now();
}

// 设置页内容容器：数据域切换的消散与入场都以它为整体目标（避免只藏卡片、框架漏出来）
function _domainPanel() {
  return document.getElementById('page-settings');
}

// 设置页内容复位：清除过渡期内联样式、首帧隐藏属性，并标记"已放行"（不再被首帧隐藏规则拦）
function _resetPanel() {
  var panel = _domainPanel();
  if (panel) {
    panel.style.transition = '';
    panel.style.opacity = '';
    panel.style.filter = '';
  }
  document.documentElement.removeAttribute('data-particle-in');
  document.documentElement.setAttribute('data-domain-shown', '1');
}

// 重载前：卡片化作细密粒子向上飘散湮灭；动画结束或超时兜底后回调（用于触发 reload）
function playParticleDissolve(onDone) {
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    if (typeof onDone === 'function') onDone();
  }

  var cards = _particleCards();
  if (!cards.length || _particleReducedMotion()) { finish(); return; }

  var seeds = _particleSeeds(cards);
  var view = seeds.length ? _particleNewCanvas() : null;
  if (!view) { finish(); return; }

  // 标记本次过渡：重载后据此播放"凝聚"入场，并让新页面首帧先藏住设置页内容
  try { sessionStorage.setItem(PARTICLE_SWEEP_KEY, '1'); } catch (e) { /* 忽略 */ }

  // 设置页内容整体淡出（卡片随之一并消失），与粒子飘散配合：视觉上是"整个界面化作尘埃"
  var panel = _domainPanel();
  if (panel) {
    panel.style.transition = 'opacity ' + Math.round(PARTICLE_SWEEP_MS * 0.6) + 'ms ease';
    panel.style.opacity = '0';
  }

  // 画布背景同步由透明渐变为深色底：粒子还在飘散时，画面已经渐变到与重载后启动占位（#bootSplash）
  // 相同的深色，于是"消散 → 深色背景 → 粒子重新凝聚"之间没有跳色：
  // 重载前后两帧是同一个颜色，接缝看不出来
  var sweepCanvas = view.canvas;
  sweepCanvas.style.transition = 'background-color ' + PARTICLE_SWEEP_MS + 'ms linear';
  void sweepCanvas.offsetWidth;                 // 强制采纳初值（CSS 未设底色 = 透明），过渡才会真的发生
  sweepCanvas.style.backgroundColor = PARTICLE_SWEEP_BG;

  var ctx = view.ctx;
  var start = _particleNow();

  function frame(now) {
    var elapsed = now - start;
    _particleUpdate(seeds, elapsed, false);
    _particlePaint(ctx, seeds);
    if (elapsed < PARTICLE_SWEEP_MS) {
      requestAnimationFrame(frame);
      return;
    }
    _particleDropCanvas(view.canvas);
    finish();
  }
  requestAnimationFrame(frame);

  // 兜底：标签页在后台时 rAF 可能长时间不执行，保证最终一定继续重载
  setTimeout(function () {
    if (!finished) {
      _particleDropCanvas(view.canvas);
      finish();
    }
  }, PARTICLE_SWEEP_MS + 900);
}

// ===================== 通用：元素粒子消散（删除场景复用） =====================
var DISSOLVE_ITEM_MS = 520;    // 单项删除的消散时长（比整页切换更快）
var DISSOLVE_ITEM_RISE = 38;   // 单项删除的飘散高度基准（px）

// 把元素"化作粒子"向上飘散，元素同步淡出；动画结束（或超时兜底）后回调，
// 由调用方在回调里真正删除数据 / 重渲染列表 —— 删除场景统一走这里
function dissolveElement(el, onDone) {
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    if (typeof onDone === 'function') onDone();
  }

  if (!el || typeof el.getBoundingClientRect !== 'function' || _particleReducedMotion()) { finish(); return; }

  var seeds = _particleSeeds([el], DISSOLVE_ITEM_MS, DISSOLVE_ITEM_RISE);
  var view = seeds.length ? _particleNewCanvas() : null;
  if (!view) { finish(); return; }

  // 元素同步淡出，与粒子飘散配合
  el.style.transition = 'opacity ' + Math.round(DISSOLVE_ITEM_MS * 0.6) + 'ms ease';
  el.style.opacity = '0';

  var ctx = view.ctx;
  var start = _particleNow();

  function frame(now) {
    var elapsed = now - start;
    _particleUpdate(seeds, elapsed, false);
    _particlePaint(ctx, seeds);
    if (elapsed < DISSOLVE_ITEM_MS) {
      requestAnimationFrame(frame);
      return;
    }
    _particleDropCanvas(view.canvas);
    el.style.transition = '';
    el.style.opacity = '';
    finish();
  }
  requestAnimationFrame(frame);

  // 兜底：后台标签页 rAF 暂停时也要保证删除继续执行
  setTimeout(function () {
    if (!finished) {
      _particleDropCanvas(view.canvas);
      el.style.transition = '';
      el.style.opacity = '';
      finish();
    }
  }, DISSOLVE_ITEM_MS + 600);
}

// 删除动作的统一入口：有元素就先播消散，播完再执行删除；元素缺失/降级时直接删除
function dissolveThenRemove(el, action) {
  if (!el || typeof dissolveElement !== 'function') {
    if (typeof action === 'function') action();
    return;
  }
  dissolveElement(el, action);
}

// ===================== 首次访问的首页入场 =====================
var HOME_INTRO_FADE_MS = 340;   // 爆开后覆盖层淡出时长

// 覆盖层背景：优先取页面背景色（含主题变量 --color-bg），取不到时用深色兜底，避免与首页有色差
function _homeIntroBackground() {
  function usable(v) {
    return !!v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent';
  }
  var bg = '';
  try {
    bg = window.getComputedStyle(document.body).backgroundColor || '';
    if (!usable(bg)) bg = window.getComputedStyle(document.documentElement).backgroundColor || '';
    if (!usable(bg)) {
      bg = window.getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '';
    }
  } catch (e) { /* 忽略 */ }
  return usable(bg) ? bg : '#0b0b0d';
}

// 首次打开网站（或清除缓存后重开）时，在首页播"粒子凝聚成 LeLeTV → 爆开"的入场过渡：
// 最上层盖一张不透明 canvas，动效结束后整层淡出，露出已渲染好的首页（为首页加载提供过渡）
function playHomeIntro() {
  if (_particleReducedMotion()) return;
  // 启动占位（index.html 的 #bootSplash）已经播过同一套入场：粒子随加载进度凝聚 → 实体化 → 爆开。
  // 此处直接跳过，否则新访客会连着看两遍同样的动画
  if (window.__LELETV_BOOT_INTRO__) return;
  // 仅在首页播放：带搜索直链 / 结果页 / 其它 hash 时不打扰
  if (location.hash && location.hash !== '#home') return;
  if (!document.getElementById('page-home')) return;

  var view = _particleNewCanvas();
  if (!view) return;

  view.canvas.style.background = _homeIntroBackground();
  view.canvas.style.transition = 'opacity ' + HOME_INTRO_FADE_MS + 'ms ease';

  var ctx = view.ctx;
  var center = _domainCenter();
  var fontSize = Math.max(26, Math.min(window.innerWidth * 0.15, 82));
  var brandRadius = fontSize * 1.5;   // 粒子凝聚半径：环绕字样形成环带
  var ringStart = center.maxR * 0.55;
  var particles = _domainParticles(brandRadius);
  var start = 0;
  var burstStart = DOMAIN_GATHER_MS + DOMAIN_HOLD_MS;
  var began = false;
  var finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    view.canvas.style.opacity = '0'; // 整层淡出，露出首页
    setTimeout(function () { _particleDropCanvas(view.canvas); }, HOME_INTRO_FADE_MS + 60);
  }

  // 等 MapleMono 就绪再起动画（避免用回退字体画出的字样与首页标题不一致），最多等 220ms
  function begin() {
    if (began) return;
    began = true;
    start = _particleNow();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    var elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (elapsed < DOMAIN_GATHER_MS) {
      // 阶段一：粒子螺旋凝聚；环带与字样在后半段浮现
      var t = elapsed / DOMAIN_GATHER_MS;
      _domainUpdateGather(particles, elapsed, center);
      _particlePaint(ctx, particles);
      var reveal = Math.max(0, (t - 0.4) / 0.6);
      var revealEase = 1 - Math.pow(1 - reveal, 3);
      _domainDrawRing(ctx, center, ringStart + (brandRadius - ringStart) * revealEase, 0.55 * revealEase);
      _domainDrawBrand(ctx, center, fontSize, 0.88 + 0.12 * revealEase, revealEase);
      requestAnimationFrame(frame);
      return;
    }

    if (elapsed < burstStart) {
      // 阶段二：成型停留
      _domainUpdateGather(particles, DOMAIN_GATHER_MS * 2, center);
      _particlePaint(ctx, particles);
      _domainDrawRing(ctx, center, brandRadius, 0.55);
      _domainDrawBrand(ctx, center, fontSize, 1, 1);
      requestAnimationFrame(frame);
      return;
    }

    // 阶段三：爆开 → 覆盖层淡出，露出首页
    var be = elapsed - burstStart;
    var bt = Math.min(1, be / DOMAIN_BURST_MS);
    _domainUpdateBurst(particles, be, center);
    _particlePaint(ctx, particles);
    _domainDrawRing(ctx, center, brandRadius + 220 * bt, 0.5 * (1 - bt));
    _domainDrawBrand(ctx, center, fontSize, 1 + 0.35 * bt, 1 - bt);
    if (bt < 1) {
      requestAnimationFrame(frame);
      return;
    }
    finish();
  }

  try {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('900 ' + fontSize + 'px "MapleMono"').then(begin).catch(begin);
    }
  } catch (e) { /* 忽略 */ }
  setTimeout(begin, 220);

  // 兜底：后台标签页 rAF 暂停时也要保证覆盖层最终消失，不能一直挡住首页
  setTimeout(function () {
    if (!began) {
      finished = true;
      _particleDropCanvas(view.canvas);
      return;
    }
    finish();
  }, burstStart + DOMAIN_BURST_MS + 1200);
}

// 设置页内容初态：先写内联样式、再摘掉 CSS 首帧隐藏属性，保证交接过程不闪
function _panelInitialState() {
  var panel = _domainPanel();
  if (panel) {
    panel.style.transition = 'none';
    panel.style.opacity = '0';
  }
  document.documentElement.removeAttribute('data-particle-in');
  void document.body.offsetHeight; // 强制一次样式计算，确保初态已被采纳，淡入才会真的过渡
}

// 设置页内容整体淡入（爆开之后），结束后清理内联样式
function _revealPanel() {
  var panel = _domainPanel();
  if (!panel) { _resetPanel(); return; }
  panel.style.transition = 'opacity ' + REVEAL_DURATION_MS + 'ms ' + REVEAL_EASING;
  panel.style.opacity = '1';
  setTimeout(function () { _resetPanel(); }, REVEAL_DURATION_MS + 80);
}

// 视口中心与对角线半径
function _domainCenter() {
  var hw = window.innerWidth / 2;
  var hh = window.innerHeight / 2;
  return { x: hw, y: hh, maxR: Math.sqrt(hw * hw + hh * hh) };
}

// 生成粒子：随机角度 + 随机起始半径（远离中心），螺旋收拢到字样外圈的小环带 → 即"星环"
function _domainParticles(brandRadius) {
  var c = _domainCenter();
  var list = [];
  for (var i = 0; i < DOMAIN_PARTICLE_MAX; i++) {
    list.push({
      a0: Math.random() * Math.PI * 2,
      r0: c.maxR * (0.35 + Math.random() * 0.6),
      r1: brandRadius * (0.7 + Math.random() * 0.6),
      spin: (0.5 + Math.random() * 0.85) * (Math.random() < 0.5 ? -1 : 1),
      size: 0.9 + Math.random() * 1.4,
      color: _particlePickColor(),
      delay: Math.random() * DOMAIN_GATHER_MS * 0.18,
      a1: 0,
      px: c.x,
      py: c.y,
      alpha: 0
    });
  }
  return list;
}

// 聚集：半径由 r0 螺旋收拢到 r1（角度持续旋转，靠近中心时形成明亮的星环）
function _domainUpdateGather(particles, elapsed, center) {
  var span = Math.max(1, DOMAIN_GATHER_MS);
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var local = (elapsed - p.delay) / span;
    local = local < 0 ? 0 : (local > 1 ? 1 : local);
    var ease = 1 - Math.pow(1 - local, 3);
    var r = p.r0 + (p.r1 - p.r0) * ease;
    var ang = p.a0 + p.spin * Math.PI * 2.4 * (1 - Math.pow(1 - local, 2));
    p.a1 = ang;
    p.px = center.x + Math.cos(ang) * r;
    p.py = center.y + Math.sin(ang) * r;
    p.alpha = 0.12 + 0.88 * local;
  }
}

// 爆开：自收拢半径快速向外扩散并湮灭
function _domainUpdateBurst(particles, elapsed, center) {
  var t = Math.min(1, elapsed / Math.max(1, DOMAIN_BURST_MS));
  var ease = 1 - Math.pow(1 - t, 2);
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var ang = p.a1 + p.spin * Math.PI * 1.1 * ease;
    var r = p.r1 + (p.r0 * 0.85 + 140) * ease;
    p.px = center.x + Math.cos(ang) * r;
    p.py = center.y + Math.sin(ang) * r;
    var a = 1 - t;
    p.alpha = a * a;
  }
}

// 星环：中心向外的粉色光环（随聚集收缩、成型后稳定、爆开时扩散淡出）
function _domainDrawRing(ctx, center, radius, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  var inner = Math.max(1, radius * 0.72);
  var outer = Math.max(inner + 1, radius * 1.2);
  var g = ctx.createRadialGradient(center.x, center.y, inner, center.x, center.y, outer);
  g.addColorStop(0, _themeRgba(0));
  g.addColorStop(0.55, _themeRgba(0.42));
  g.addColorStop(1, _themeRgba(0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(center.x, center.y, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 中心字样：与首页标题同款（MapleMono + 玻璃白），额外叠一层粉色光晕
function _domainDrawBrand(ctx, center, fontSize, scale, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(center.x, center.y);
  ctx.scale(scale, scale);
  ctx.font = '900 ' + fontSize + 'px "MapleMono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = _themeRgba(0.55);
  ctx.shadowBlur = 28;
  // 字样本身也跟随主题色（与启动占位动画的 drawBrand 保持一致）
  ctx.fillStyle = _themeRgba(0.5);
  ctx.fillText(DOMAIN_TEXT, 0, 0);
  ctx.shadowBlur = 0;
  var grad = ctx.createLinearGradient(0, -fontSize * 0.6, 0, fontSize * 0.6);
  grad.addColorStop(0, _themeRgba(0.95));
  grad.addColorStop(0.45, _themeRgba(0.45));
  grad.addColorStop(1, _themeRgba(0.18));
  ctx.fillStyle = grad;
  ctx.fillText(DOMAIN_TEXT, 0, 0);
  ctx.strokeStyle = _themeRgba(0.25);
  ctx.lineWidth = 1;
  ctx.strokeText(DOMAIN_TEXT, 0, 0);
  ctx.restore();
}

// 重载后：粒子自随机位置螺旋向中心凝聚成 LeLeTV → 爆开 → 设置页内容整体淡入
function playDomainTransition() {
  _entranceStarted = true;

  var incoming = false;
  try {
    incoming = sessionStorage.getItem(PARTICLE_SWEEP_KEY) === '1';
    if (incoming) sessionStorage.removeItem(PARTICLE_SWEEP_KEY);
  } catch (e) { /* 忽略 */ }

  // 启动占位（index.html 的 #bootSplash）在本次重载后已经播过同一套"粒子凝聚 → 爆开"，
  // 且遮罩是纯深色底。这里不再重复播粒子，只做面板交接：
  // 摘掉首帧隐藏，让设置页内容就绪，等占位在爆开时同步淡出后自然露出来
  if (window.__LELETV_BOOT_INTRO__) {
    _resetPanel();
    return;
  }

  if (!incoming || !_domainPanel() || _particleReducedMotion()) {
    _resetPanel();
    return;
  }

  // 设置页内容先按初态藏住（摘掉 data-particle-in 也不会闪），等爆开后再整体淡入
  _panelInitialState();

  var view = _particleNewCanvas();
  if (!view) { _revealPanel(); return; }

  var ctx = view.ctx;
  var center = _domainCenter();
  var fontSize = Math.max(26, Math.min(window.innerWidth * 0.15, 82));
  var brandRadius = fontSize * 1.5;   // 粒子凝聚半径：环绕字样形成环带
  var ringStart = center.maxR * 0.55;
  var particles = _domainParticles(brandRadius);
  var start = 0;
  var burstStart = DOMAIN_GATHER_MS + DOMAIN_HOLD_MS;
  var cardsStarted = false;
  var began = false;

  function startCards() {
    if (cardsStarted) return;
    cardsStarted = true;
    _revealPanel();
  }

  // 等 MapleMono 就绪再起动画（避免用回退字体画出的字样与首页不一致），最多等 220ms
  function begin() {
    if (began) return;
    began = true;
    start = _particleNow();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    var elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (elapsed < DOMAIN_GATHER_MS) {
      // 阶段一：粒子螺旋聚集；星环与字样在后半段浮现
      var t = elapsed / DOMAIN_GATHER_MS;
      _domainUpdateGather(particles, elapsed, center);
      _particlePaint(ctx, particles);
      var reveal = Math.max(0, (t - 0.4) / 0.6);
      var revealEase = 1 - Math.pow(1 - reveal, 3);
      _domainDrawRing(ctx, center, ringStart + (brandRadius - ringStart) * revealEase, 0.55 * revealEase);
      _domainDrawBrand(ctx, center, fontSize, 0.88 + 0.12 * revealEase, revealEase);
      requestAnimationFrame(frame);
      return;
    }

    if (elapsed < burstStart) {
      // 阶段二：成型停留
      _domainUpdateGather(particles, DOMAIN_GATHER_MS * 2, center);
      _particlePaint(ctx, particles);
      _domainDrawRing(ctx, center, brandRadius, 0.55);
      _domainDrawBrand(ctx, center, fontSize, 1, 1);
      requestAnimationFrame(frame);
      return;
    }

    // 阶段三：爆开 → 设置界面浮现
    var be = elapsed - burstStart;
    var bt = Math.min(1, be / DOMAIN_BURST_MS);
    _domainUpdateBurst(particles, be, center);
    _particlePaint(ctx, particles);
    _domainDrawRing(ctx, center, brandRadius + 220 * bt, 0.5 * (1 - bt));
    _domainDrawBrand(ctx, center, fontSize, 1 + 0.35 * bt, 1 - bt);
    if (bt > 0.2) startCards();

    if (bt < 1) {
      requestAnimationFrame(frame);
      return;
    }
    _particleDropCanvas(view.canvas);
  }

  // 字体就绪即起动画；兜底 220ms 起动画（字体加载慢时不让卡片一直空着）
  try {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('900 ' + fontSize + 'px "MapleMono"').then(begin).catch(begin);
    }
  } catch (e) { /* 忽略 */ }
  setTimeout(begin, 220);

  // 兜底：标签页在后台时 rAF 会暂停，保证界面最终一定会浮现
  setTimeout(function () {
    if (!cardsStarted) {
      _particleDropCanvas(view.canvas);
      startCards();
    }
  }, burstStart + DOMAIN_BURST_MS + 900);
}

function switchPage(a) {
  var h = a === 'home' ? '' : '#' + a;
  if (location.hash !== h) location.hash = h; else showPage(a);
}

// ===================== 分类页标签选择持久化 =====================
// 用户选的类型/题材/年份/排序等标签存到 localStorage（scoped：两个数据域各存一份），
// 下次进入分类页沿用上次的标签；该键同时纳入设置数据的导出/导入
var CATEGORY_FILTER_PREFS_KEY = 'tmdbFilters';
var CATEGORY_FILTER_FIELDS = ['type', 'selectedGenre', 'selectedYear', 'selectedSort',
  'voteRating', 'originalLanguage', 'originCountry', 'tvStatus'];

// 落盘当前标签选择
function saveCategoryFilterPrefs() {
  try {
    if (typeof TMDB_STATE === 'undefined' || !TMDB_STATE) return;
    var payload = {};
    CATEGORY_FILTER_FIELDS.forEach(function (k) {
      if (k in TMDB_STATE) payload[k] = TMDB_STATE[k];
    });
    localStorage.setItem(scopedKey(CATEGORY_FILTER_PREFS_KEY), JSON.stringify(payload));
  } catch (e) { /* 忽略：存储不可用不影响浏览 */ }
}

// 进入分类页前：本会话没有浏览状态时，把上次的标签注入会话状态，
// 交由 tmdb.js 的 restoreTmdbState() 恢复（不多发请求，也不改它的重置逻辑）
function seedCategoryFiltersFromPrefs() {
  try {
    if (typeof TMDB_STATE_KEY === 'undefined') return;
    if (sessionStorage.getItem(TMDB_STATE_KEY)) return; // 会话内已浏览过：以当前会话状态为准
    var raw = localStorage.getItem(scopedKey(CATEGORY_FILTER_PREFS_KEY));
    if (!raw) return;
    sessionStorage.setItem(TMDB_STATE_KEY, raw);
  } catch (e) { /* 忽略 */ }
}

function handleHashChange() { showPage(location.hash.slice(1) || 'home'); }

function showPage(n) {
  // 离开类别页前保存滚动位置与标签选择（标签供下次进入时沿用）
  if (currentPage === 'category' && n !== 'category') {
    if (typeof saveTmdbScroll === 'function') saveTmdbScroll();
    saveCategoryFilterPrefs();
  }
  currentPage = n;
  function _apply() {
    document.querySelectorAll('.page-content').forEach(function(e) { e.classList.remove('active'); });
    var t = document.getElementById('page-' + n);
    if (t) t.classList.add("active");
    var m = document.querySelector('.main-container');
    if (m) m.setAttribute("data-page", n);
    // TV 风格结果页全屏：隐藏全局导航栏与页脚
    var nav = document.querySelector('.top-nav-bar');
    if (nav) nav.style.display = n === 'movies' ? 'none' : '';
    var footer = document.querySelector('.footer');
    if (footer) footer.style.display = n === 'movies' ? 'none' : '';
    // 清除所有卡片的加载动画状态
    document.querySelectorAll('.search-result-card.card-loading').forEach(function(c) { c.classList.remove('card-loading'); });
    updateNavButtons(n);
    handlePageLoad(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // 粒子过渡（数据域切换重载）时跳过视图过渡：首帧直达已把设置页显示出来，
  // 再叠一层 cross-fade 会与粒子汇聚打架
  if (document.startViewTransition && !_particleIncoming) {
    document.startViewTransition(_apply);
  } else {
    _apply();
  }
}

function updateNavButtons(a) {
  document.querySelectorAll('.nav-btn[data-page]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-page') === a);
  });
}

function handlePageLoad(n) {
  switch(n) {
    case 'category':
      // 先按持久化的标签选择注入会话状态，再由 tmdb.js 统一恢复并加载
      seedCategoryFiltersFromPrefs();
      if (typeof initTmdbCategory === 'function') initTmdbCategory();
      break;
    case 'history': if (typeof loadViewingHistory === 'function') loadViewingHistory(); break;
    case 'movies': if (typeof initMoviesPage === 'function') initMoviesPage(); break;
    case 'about': loadAboutPageChangelog(); break;
    case 'readme': loadReadmePage(); break;
  }
}

function loadReadmePage() {
  var content = document.getElementById('readmeContent');
  if (!content || content.getAttribute('data-loaded') === 'true') return;
  content.setAttribute('data-loaded', 'true');

  var loading = document.getElementById('readmeLoading');
  var error = document.getElementById('readmeError');

  loading.classList.remove('hidden');
  content.classList.add('hidden');
  error.classList.add('hidden');

  fetch('https://raw.githubusercontent.com/JiuNian090/LeLeTV/main/README.md')
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function(md) {
      if (typeof marked !== 'undefined') {
        content.innerHTML = marked.parse(md);
      } else {
        content.textContent = md;
      }
      loading.classList.add('hidden');
      content.classList.remove('hidden');
    })
    .catch(function() {
      loading.classList.add('hidden');
      error.classList.remove('hidden');
    });
}

document.addEventListener('click', function(e) {
  var retryBtn = e.target.closest('#retryReadmeBtn');
  if (retryBtn) {
    var content = document.getElementById('readmeContent');
    if (content) content.removeAttribute('data-loaded');
    loadReadmePage();
  }
});

function switchToAbout(s) {
  switchPage('about');
  if (s) setTimeout(function() {
    var el = document.getElementById(s);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function toggleHistory(e) { if (e) e.stopPropagation(); switchPage('history'); }
function toggleSettings(e) { if (e) e.stopPropagation(); switchPage('settings'); }
function focusSearch() { switchPage('home'); setTimeout(function() { var si = document.getElementById('searchInput'); if (si) si.focus(); }, 100); }

function loadAboutPageChangelog() {
  var ct = document.getElementById('aboutChangelogContent');
  if (!ct || ct.getAttribute('data-loaded') === 'true') return;
  ct.setAttribute('data-loaded', 'true');
  fetch('/CHANGELOG.md', { cache: 'no-store' })
    .then(function(r) { if (!r.ok) throw new Error('fail'); return r.text(); })
    .then(function(md) {
      var entries = parseChangelogMarkdown(md);
      ct.innerHTML = '';
      ct.appendChild(renderVersionHistory(entries));
    })
    .catch(function(e) {
      ct.innerHTML = '<div class="bg-red-900/30 border border-red-800/50 rounded-lg p-4 text-center mt-4"><p class="text-red-400 text-sm">\u52a0\u8f7d\u66f4\u65b0\u65e5\u5fd7\u5931\u8d25</p></div>';
    });
}

function parseChangelogMarkdown(md) {
  var entries = [], cur = null;
  md.split('\n').forEach(function(line) {
    if (line.indexOf('### ') === 0) {
      if (cur) entries.push(cur);
      cur = { version: '', date: '', content: '' };
      var m = line.match(/### (v[\d.]+) \(([\d\-:\s]+)\)/);
      if (m) { cur.version = m[1]; cur.date = m[2]; }
    } else if (line.indexOf('- ') === 0 && cur) {
      var t = line.match(/- \[(.*?)\] (.*?)$/);
      if (t) cur.content += '<p class="mb-1"><span class="text-green-400">[' + t[1] + ']</span> ' + t[2] + '</p>';
      else cur.content += '<p class="mb-1">' + line.substring(2) + '</p>';
    } else if (line.trim() !== '' && cur) {
      cur.content += '<p class="text-gray-400 text-sm mt-2">' + line + '</p>';
    }
  });
  if (cur) entries.push(cur);
  return entries;
}

function renderVersionHistory(entries) {
  var html = '<div class="changelog-timeline max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">';
  entries.forEach(function(e, i) {
    var latest = i === 0;
    html += '<div class="changelog-entry"><div class="timeline-marker"><div class="timeline-dot' + (latest ? ' latest' : '') + '"></div><div class="timeline-line"></div></div>';
    html += '<div class="timeline-content"><div class="entry-header"><span class="version-number">' + e.version + '</span>';
    if (latest) html += '<span class="latest-badge">\u6700\u65b0</span>';
    if (e.date) html += '<span class="version-date">' + e.date + '</span>';
    html += '</div><div class="entry-body">' + e.content + '</div></div></div>';
  });
  html += '</div>';
  var d = document.createElement('div');
  d.innerHTML = html;
  var container = d.firstElementChild;
  container.style.scrollbarWidth = 'thin';
  container.style.scrollbarColor = '#4B5563 transparent';
  return container;
}

function openDisclaimerModal() {
  document.getElementById('disclaimerModal').style.display = 'flex';
}

function closeDisclaimerModal() {
  localStorage.setItem('lastAcceptedDisclaimer', Date.now().toString());
  document.getElementById('disclaimerModal').style.display = 'none';

  // 幂等广播：通知挂起的更新弹窗「隐私政策已确认」（只派发一次）
  if (window.LELETV_DISCLAIMER && !window.LELETV_DISCLAIMER.handled) {
    window.LELETV_DISCLAIMER.handled = true;
    document.dispatchEvent(new CustomEvent('disclaimerAccepted'));
  }
}

function openInviteGuideModal() {
  document.getElementById('inviteGuideModal').style.display = 'flex';
}

function closeInviteGuideModal() {
  document.getElementById('inviteGuideModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  AppInit.register('aurora', AppInit.PHASES.POST, function() {
    initAurora({ selector: '#auroraContainer', colorStops: ['#3A29FF', _themeHex(), '#FFD700'], amplitude: 0.45, blend: 0.6, speed: 0.35 });
  });
  AppInit.register('hash-routing', AppInit.PHASES.POST, function() {
    // 重载恢复页优先（如切换隐藏/正常内容模式后要留在设置页），其次 URL hash，最后默认首页
    var resumePage = '';
    try {
      resumePage = sessionStorage.getItem(RELOAD_RESUME_PAGE_KEY) || '';
      sessionStorage.removeItem(RELOAD_RESUME_PAGE_KEY);
    } catch (e) { /* 忽略 */ }
    var initPage = resumePage || location.hash.slice(1) || 'home';
    showPage(initPage);
    // 移除首帧直达标记（index.html 内联脚本设置），恢复由 active 类控制页面显示
    document.documentElement.removeAttribute('data-init-page');
    window.addEventListener('hashchange', handleHashChange);
    // 本次重载的首帧已处理完毕：恢复正常视图过渡（后续切页照旧）
    _particleIncoming = false;
  });
  AppInit.register('domain-transition', AppInit.PHASES.POST, function() {
    // 等 showPage 的路由与数据源渲染落定后再播"星环 + LeLeTV"入场，避免刚渲染的卡片被立刻替换
    setTimeout(playDomainTransition, 90);
  });
  AppInit.register('email-handler', AppInit.PHASES.POST, function() {
    if (typeof setupEmailClickHandlers === 'function') setupEmailClickHandlers();
  });
  AppInit.register('category-filter-persist', AppInit.PHASES.POST, function() {
    // 点击分类页标签后应落盘（tmdb.js 会先更新 TMDB_STATE，这里等一拍再读）
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('#tmdb-filters')) return;
      setTimeout(saveCategoryFilterPrefs, 0);
    });
  });
  AppInit.run();
});

window.currentPage = currentPage;
window.switchPage = switchPage;
window.handleHashChange = handleHashChange;
window.showPage = showPage;
window.switchToAbout = switchToAbout;
window.toggleHistory = toggleHistory;
window.toggleSettings = toggleSettings;
window.focusSearch = focusSearch;
window.openDisclaimerModal = openDisclaimerModal;
window.closeDisclaimerModal = closeDisclaimerModal;
window.shareInviteInfo = shareInviteInfo;

// 关于页「分享」按钮：移动端调起系统级分享，桌面端复制文案到剪贴板
function shareInviteInfo() {
  var auth = (window.INVITE_AUTH && typeof window.INVITE_AUTH.getAuth === 'function') ? window.INVITE_AUTH.getAuth() : null;
  var code = (auth && auth.code) ? auth.code : '';
  if (!code) { showToast('未获取到邀请码，请先验证邀请码登录', 'error'); return; }

  var text = 'LeLeTV：https://leletv.415599.xyz\n邀请码：' + code;
  var onOk = function() { showToast('邀请信息已复制，可粘贴分享', 'success'); };
  var onFail = function() { showToast('复制失败，请手动复制', 'error'); };

  var fallbackCopy = function() {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? onOk() : onFail();
    } catch (e) {
      onFail();
    }
  };

  var copyText = function() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onOk).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  // 移动端优先调起系统分享面板；宿主未实现 navigator.share 时回退复制
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile && typeof navigator.share === 'function') {
    navigator.share({ title: 'LeLeTV', text: text }).catch(function(err) {
      // 用户主动取消（AbortError）或拒绝授权不提示，其余异常回退到复制
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
      copyText();
    });
    return;
  }

  copyText();
}

// ===================== 移动端滑动手势 =====================
(function() {
  var startX, startY, startTime;
  var SWIPE_THRESHOLD = 60;    // px
  var VERTICAL_LIMIT = 30;     // px - 垂直偏移超过此值不触发水平滑动
  var MAX_TIME = 300;          // ms - 超过此时间不触发

  var pages = ['home', 'category', 'history', 'settings', 'about'];

  document.addEventListener('touchstart', function(e) {
    // 不在播放器页面或搜索输入框内触发
    if (e.target.closest('#player') || e.target.closest('#searchInput') || 
        e.target.closest('.art-controls') || e.target.closest('input, textarea, select')) {
      startX = null;
      return;
    }
    var t = e.changedTouches[0];
    startX = t.screenX;
    startY = t.screenY;
    startTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (startX === null) return;
    var t = e.changedTouches[0];
    var dx = t.screenX - startX;
    var dy = t.screenY - startY;
    var dt = Date.now() - startTime;

    // 垂直滑动太多或太慢，忽略
    if (Math.abs(dy) > VERTICAL_LIMIT || dt > MAX_TIME) {
      startX = null;
      return;
    }

    // 水平滑动距离不够
    if (Math.abs(dx) < SWIPE_THRESHOLD) {
      startX = null;
      return;
    }

    var curIdx = pages.indexOf(currentPage);
    if (curIdx === -1) { startX = null; return; }

    if (dx > 0) {
      // 右滑 → 上一页
      if (curIdx > 0) switchPage(pages[curIdx - 1]);
    } else {
      // 左滑 → 下一页
      if (curIdx < pages.length - 1) switchPage(pages[curIdx + 1]);
    }

    startX = null;
  }, { passive: true });
})();


// ===================== 全局错误边界 =====================
(function() {
  var reportedErrors = {};
  
  window.addEventListener("error", function(e) {
    // 过滤常见无害错误
    if (e.message && (
      e.message.indexOf("ResizeObserver") >= 0 ||
      e.message.indexOf("NetworkError") >= 0 ||
      e.message.indexOf("AbortError") >= 0 ||
      e.message.indexOf("Failed to fetch") >= 0
    )) return;
    
    var key = e.message + ":" + (e.filename || "");
    if (reportedErrors[key]) return;
    reportedErrors[key] = true;
    
    console.warn("[LeLeTV] 捕获错误:", e.message, e.filename, e.lineno);
  });
  
  window.addEventListener("unhandledrejection", function(e) {
    var msg = e.reason ? (e.reason.message || String(e.reason)) : "Unknown";
    console.warn("[LeLeTV] 未处理的 Promise 错误:", msg);
  });
})();
