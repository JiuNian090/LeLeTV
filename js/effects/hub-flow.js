/**
 * 首页聚合动效（按 flux.inch.red「万能聚合中心」的参数复刻）
 *
 * - 画布高 850 设计像素，宽度至少 1920：屏幕比 1920 宽（2K、4K）时按需加宽，卡片流始终铺到两侧边缘；
 *   整体按屏幕宽度缩放（CSS 变量 --hub-s：4K 放大、桌面 1、平板 0.7、手机 0.45）
 * - 三排，行距 212：上排沿圆心在上方 1800 处的圆弧、下排沿圆心在下方的圆弧、中排直线
 * - 卡片与海报同为 120×180、间距 32；每个条目只有一个运动坐标 u（中心到光线的距离），
 *   左半边按弧线画资源站卡片，右半边按直线画海报。离光线一张卡片宽度以内都走直线，
 *   所以过线时左边的卡片和右边的海报位置、尺寸完全重合，拼成一张完整的卡片
 * - 只改 transform；离开视口、页面隐藏时暂停；系统开启「减少动态效果」时静止展示
 */
(function () {
  'use strict';

  const BASE_W = 1920;                      // flux 的设计宽度，画布不会比它窄
  const H = 850;
  const CARD_W = 120;
  const CARD_H = 180;
  const PITCH = CARD_W + 32;
  const ROW_OFFSET = 212;
  const RADIUS = 1800;
  const STRAIGHT = CARD_W / 2 + 8;           // 这段距离内走直线，保证过线处卡片与海报对齐
  const SPEED = 22;                         // 设计尺寸下每秒移动的像素

  // 三排：bend -1 向上弯，0 直线，1 向下弯
  const ROWS = [
    { y: H / 2 - ROW_OFFSET, bend: -1 },
    { y: H / 2, bend: 0 },
    { y: H / 2 + ROW_OFFSET, bend: 1 }
  ];

  const FALLBACK_SOURCES = ['暴风资源', '光速资源', '极速资源', '豪华资源', '百度资源', '量子资源', '非凡资源', '新浪资源'];

  // 线性图标（24×24，描边），与导航图标同一套粗细
  const ICON_PATHS = [
    'M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3Zm0 0v5c0 1.66 3.58 3 8 3s8-1.34 8-3V7m-16 5v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5',
    'M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97V18H7Z',
    'M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z',
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-8.5-9h17M12 3c2.5 2.6 3.75 5.6 3.75 9S14.5 18.4 12 21c-2.5-2.6-3.75-5.6-3.75-9S9.5 5.6 12 3Z',
    'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v3a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 9.5v-3Zm0 8A2.5 2.5 0 0 1 6.5 12h11a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-3ZM8 8h.01M8 16h.01'
  ];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function getSourceNames() {
    try {
      if (typeof API_SITES === 'object' && API_SITES) {
        // 只取正常源：带 hidden 标记的私密源不在首页出现
        const names = Object.values(API_SITES)
          .filter(site => site && !site.hidden && typeof site.name === 'string')
          .map(site => site.name.trim())
          .filter(Boolean);
        if (names.length >= 4) return names;
      }
    } catch (e) {
      console.warn('[hub-flow] 读取资源站列表失败，使用默认名单', e);
    }
    return FALLBACK_SOURCES;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function icon(d) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  function makeCard(name, index) {
    const card = el('div', 'hub-item hub-card');
    const ic = el('span', 'hub-ic');
    ic.appendChild(icon(ICON_PATHS[index % ICON_PATHS.length]));
    card.append(ic, el('b', null, name.replace(/资源$/, '')), el('i', 'hub-dot' + (index % 5 === 3 ? ' is-warn' : '')));
    return card;
  }

  function isSafeImageUrl(url) {
    return typeof url === 'string' && /^https:\/\//.test(url);
  }

  function makePoster(poster) {
    const card = el('div', 'hub-item hub-poster');
    if (poster && isSafeImageUrl(poster.img)) {
      card.style.backgroundImage = 'url("' + poster.img.replace(/["\\\n]/g, '') + '")';
      card.appendChild(el('span', null, poster.title || ''));
    } else {
      card.classList.add('is-placeholder');
    }
    return card;
  }

  function prefersReducedMotion() {
    if (window.LeLeMotion) return window.LeLeMotion.reduced();   // 设置里可强制开启 / 关闭
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /** 当前缩放比：CSS 按断点给 --hub-s，画布宽度 = 舞台宽度 / 缩放比 */
  function readScale(stage) {
    const raw = parseFloat(getComputedStyle(stage).getPropertyValue('--hub-s'));
    return raw > 0 ? raw : 1;
  }

  function createHubFlow(stage) {
    const sources = getSourceNames();
    let posters = [];
    let items = [];
    let running = false;
    let visible = false;
    let rafId = 0;
    let last = 0;
    let clock = 0;

    // 画布几何：宽度随舞台变化，其余量都由宽度推出
    const geo = { w: BASE_W, portal: BASE_W / 2, uMin: 0, count: 0, span: 0 };

    const canvas = el('div', 'hub-canvas');
    const leftLayer = el('div', 'hub-layer is-left');
    // 右半边等海报加载好再淡入；迟迟等不到（私密模式、TMDB 不通）就改用占位海报
    const rightLayer = el('div', 'hub-layer is-right is-pending');
    const revealRight = () => rightLayer.classList.remove('is-pending');
    const revealTimer = setTimeout(revealRight, 5000);

    // 分割线：2px 光线 + 只在左侧的光幕
    const beam = el('div', 'hub-beam');
    beam.appendChild(el('div', 'hub-curtain'));
    canvas.append(leftLayer, rightLayer, beam);
    stage.replaceChildren(canvas);

    /** 按舞台宽度定画布宽度；返回是否需要重建条目（每排张数变了） */
    function layout() {
      const stageW = stage.clientWidth || BASE_W;
      const w = Math.max(BASE_W, Math.ceil(stageW / readScale(stage)));
      const count = Math.ceil((w + CARD_W * 2 + 200) / PITCH);
      const changed = count !== geo.count;
      geo.w = w;
      geo.portal = w / 2;
      geo.uMin = -(w / 2 + CARD_W);          // 完全移出右边
      geo.count = count;
      geo.span = count * PITCH;
      canvas.style.width = w + 'px';
      return changed;
    }

    /** 左半边卡片的位姿：离光线 STRAIGHT 以内走直线，再往左沿半径 RADIUS 的圆弧抬起或落下 */
    function cardPose(u, bend) {
      if (!bend || u <= STRAIGHT) return { cx: geo.portal - u, dy: 0, rot: 0 };
      const a = (u - STRAIGHT) / RADIUS;
      return {
        cx: geo.portal - STRAIGHT - RADIUS * Math.sin(a),
        dy: bend * RADIUS * (1 - Math.cos(a)),
        rot: -bend * a * 57.29578
      };
    }

    function build() {
      leftLayer.replaceChildren();
      rightLayer.replaceChildren();
      items = [];
      ROWS.forEach((row, r) => {
        for (let i = 0; i < geo.count; i++) {
          const n = r * geo.count + i;
          const card = makeCard(sources[(i + r * 3) % sources.length], n);
          const poster = makePoster(posters.length ? posters[(i + r * 5) % posters.length] : null);
          leftLayer.appendChild(card);
          rightLayer.appendChild(poster);
          items.push({ card, poster, row, base: i * PITCH });
        }
      });
      render(clock);
    }

    function render(t) {
      const shift = t * SPEED;
      for (const item of items) {
        // 同一个 u 同时决定左边卡片和右边海报的位置：u 越小越靠右
        const u = geo.uMin + ((((item.base - shift) % geo.span) + geo.span) % geo.span);
        const top = item.row.y - CARD_H / 2;
        const pose = cardPose(u, item.row.bend);
        item.card.style.transform = 'translate3d(' + (pose.cx - CARD_W / 2).toFixed(1) + 'px,' + (top + pose.dy).toFixed(1) + 'px,0) rotate(' + pose.rot.toFixed(2) + 'deg)';
        item.poster.style.transform = 'translate3d(' + (geo.portal - u - CARD_W / 2).toFixed(1) + 'px,' + top + 'px,0)';
      }
    }

    function frame(now) {
      if (!running) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt;
      render(clock);
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (running || prefersReducedMotion()) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    function syncRunning() {
      if (visible && !document.hidden && !prefersReducedMotion()) start(); else stop();
    }

    const io = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      syncRunning();
    });
    io.observe(stage);
    document.addEventListener('visibilitychange', syncRunning);
    // 设置里切了「动态效果」：立刻起动或停下
    window.addEventListener('leletv:motionchange', syncRunning);

    // 窗口宽度或缩放断点变了：重新定画布宽度，张数变了才重建，否则只重画一帧
    let resizeRaf = 0;
    function onResize() {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (layout()) build(); else render(clock);
      });
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(onResize).observe(stage);
    else window.addEventListener('resize', onResize);

    // 静止时也给一个错落的起始画面：让一张卡片正好压在光线上
    clock = (PITCH * 0.5) / SPEED;
    layout();
    build();

    return {
      /** 海报图先预加载，加载成功的才换上去，避免出现空框；最多等 4 秒 */
      setPosters(list) {
        const candidates = Array.isArray(list) ? list.filter(p => p && isSafeImageUrl(p.img)) : [];
        const loadOne = poster => new Promise(resolve => {
          const img = new Image();
          img.onload = () => resolve(poster);
          img.onerror = () => resolve(null);
          img.src = poster.img;
        });
        const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 4000));
        const settled = [];
        const all = Promise.all(candidates.map(p => loadOne(p).then(r => { if (r) settled.push(r); return r; })));
        Promise.race([all, timeout]).then(() => {
          if (settled.length) {
            posters = settled.slice();
            build();
          }
          clearTimeout(revealTimer);
          revealRight();
        });
      },

      /** 不会有海报了（私密模式）：直接显示占位海报 */
      usePlaceholders() {
        clearTimeout(revealTimer);
        revealRight();
      }
    };
  }

  window.HubFlow = {
    init(stage) {
      if (!stage || stage.__hubFlow) return stage && stage.__hubFlow;
      stage.__hubFlow = createHubFlow(stage);
      return stage.__hubFlow;
    }
  };
})();
