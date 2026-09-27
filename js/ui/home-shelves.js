/**
 * 首页内容：继续观看、片源数，以及给聚合动效供海报（本周热门榜只用来喂海报）。
 * 点击行为复用现有的事件委托：
 *   - data-action="tmdb-search-video" + data-title → 进入结果页搜索
 *   - data-action="play-from-history" + data-url/title/index/position → 续播
 */
(function () {
  'use strict';

  const CONTINUE_LIMIT = 6;
  let trendingPromise = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function isPrivateMode() {
    return typeof isHiddenContentMode === 'function' && isHiddenContentMode();
  }

  function isSafeImageUrl(url) {
    return typeof url === 'string' && /^https?:\/\//.test(url);
  }

  function cssUrl(url) {
    return 'url("' + url.replace(/["\\\n\r]/g, '') + '")';
  }

  function tmdbImage(path) {
    const base = (typeof TMDB_CONFIG === 'object' && TMDB_CONFIG && TMDB_CONFIG.imageBase) || 'https://image.tmdb.org/t/p';
    return path ? base + '/w342' + path : '';
  }

  function formatClock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + sec : m + ':' + sec;
  }

  function loadTrending() {
    if (trendingPromise) return trendingPromise;
    const request = typeof tmdbFetch === 'function'
      ? tmdbFetch('trending/all/week', {})
      : fetch('/api/tmdb?endpoint=trending%2Fall%2Fweek').then(res => {
          if (!res.ok) throw new Error('TMDB ' + res.status);
          return res.json();
        });
    trendingPromise = request
      .then(data => (data && Array.isArray(data.results) ? data.results : [])
        .filter(item => item && item.poster_path && (item.title || item.name) && (item.media_type === 'movie' || item.media_type === 'tv'))
        .map(item => ({
          title: String(item.title || item.name).trim(),
          year: String(item.release_date || item.first_air_date || '').slice(0, 4),
          type: item.media_type === 'tv' ? '剧集' : '电影',
          rating: item.vote_count >= 100 && item.vote_average ? item.vote_average.toFixed(1) : '',
          img: tmdbImage(item.poster_path)
        })))
      .catch(err => {
        console.warn('[home] 本周热门加载失败', err);
        return [];
      });
    return trendingPromise;
  }

  /**
   * 海报卡片：按钮 + 2:3 海报 + 片名 + 辅助信息
   * opts.badge   海报左上角的小标签
   * opts.rating  海报底部评分条的分数（如「7.0」），opts.votes 为评价人数文字；给了 rating 才画评分条
   * opts.progress 0～1 的观看进度条
   */
  function posterCard(opts) {
    const card = el('button', 'v2-pcard');
    card.type = 'button';
    card.dataset.action = opts.action;
    Object.keys(opts.data || {}).forEach(key => { card.dataset[key] = String(opts.data[key]); });
    card.setAttribute('aria-label', opts.label || opts.title);

    const poster = el('div', 'v2-poster');
    const initial = el('span', 'v2-initial', opts.title.slice(0, 1));
    if (isSafeImageUrl(opts.img)) {
      card.style.setProperty('--poster', cssUrl(opts.img));
      // 封面 404 / 被拦时换成片名首字占位，不中断渲染
      const probe = new Image();
      probe.onerror = () => {
        card.style.removeProperty('--poster');
        card.classList.add('is-noimg');
        poster.prepend(initial);
      };
      probe.src = opts.img;
    } else {
      card.classList.add('is-noimg');
      poster.appendChild(initial);
    }
    if (opts.badge) poster.appendChild(el('span', 'v2-badge', opts.badge));
    if (opts.rating !== undefined) {
      const rate = el('span', 'v2-rate');
      if (opts.rating) {
        rate.append(el('b', null, '★ ' + opts.rating), el('i', null, opts.votes || ''));
      } else {
        rate.classList.add('is-none');
        rate.textContent = '暂无评分';
      }
      poster.appendChild(rate);
    }
    if (typeof opts.progress === 'number') {
      poster.appendChild(el('span', 'v2-scrim'));
      const bar = el('span', 'v2-progress');
      const fill = el('i');
      fill.style.width = Math.round(Math.min(1, Math.max(0.02, opts.progress)) * 100) + '%';
      bar.appendChild(fill);
      poster.appendChild(bar);
    }
    card.append(poster, el('h3', null, opts.title), el('p', null, opts.sub || ''));
    return card;
  }

  function skeletons(n) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const card = el('div', 'v2-pcard v2-skel');
      card.setAttribute('aria-hidden', 'true');
      card.append(el('div', 'v2-poster'), el('h3', null, '　'), el('p', null, '　'));
      frag.appendChild(card);
    }
    return frag;
  }

  /** 首屏副标题里的片源数：只数正常域里已启用的资源站（私密源不计入、不暴露） */
  function renderSourceCount() {
    const target = document.getElementById('heroSourceCount');
    if (!target) return;
    let count = 0;
    if (!isPrivateMode()) {
      try {
        const stored = localStorage.getItem(scopedKey('selectedAPIs'));
        const keys = stored ? JSON.parse(stored) : (Array.isArray(window.selectedAPIs) ? window.selectedAPIs : []);
        const customs = JSON.parse(localStorage.getItem(scopedKey('customAPIs')) || '[]');
        count = keys.filter(key => {
          if (typeof key !== 'string') return false;
          if (key.startsWith('custom_')) {
            const api = customs[parseInt(key.slice(7), 10)];
            return !!api && !api.isHidden;
          }
          const site = typeof API_SITES === 'object' && API_SITES ? API_SITES[key] : null;
          return !!site && !site.hidden;
        }).length;
      } catch (e) {
        console.warn('[home] 读取已启用片源失败', e);
      }
    }
    target.textContent = count > 0 ? ' ' + count + ' 个资源站' : '多个资源站';
  }

  function renderContinue() {
    const section = document.getElementById('homeContinue');
    const grid = document.getElementById('homeContinueList');
    if (!section || !grid) return;
    const history = typeof getViewingHistory === 'function' ? getViewingHistory() : [];
    const items = history
      .filter(item => item && item.title && item.url)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, CONTINUE_LIMIT);
    if (!items.length) { section.hidden = true; grid.replaceChildren(); return; }
    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const index = parseInt(item.episodeIndex, 10) || 0;
      const position = Math.floor(item.playbackPosition || 0);
      const isSeries = Array.isArray(item.episodes) && item.episodes.length > 1;
      frag.appendChild(posterCard({
        action: 'play-from-history',
        data: { url: item.url, title: item.title, index, position },
        title: item.title,
        label: '继续播放 ' + item.title,
        sub: (isSeries ? '第 ' + (index + 1) + ' 集 · ' : '') + '看到 ' + formatClock(position),
        img: item.cover,
        progress: item.duration > 0 ? position / item.duration : undefined
      }));
    });
    grid.replaceChildren(frag);
    section.hidden = false;
  }

  // 设置 › 首页与导航：关掉的板块首帧就由 css 隐藏（html 上的 data-home-* 属性），这里顺带不去建节点、不发请求
  function hubEnabled() { return document.documentElement.getAttribute('data-home-hub') !== 'off'; }
  function shelvesEnabled() { return document.documentElement.getAttribute('data-home-shelves') !== 'off'; }

  let hub = null;

  /** 聚合动效按需初始化：关着时不建那一百多个节点，打开时再建并喂海报（只建一次） */
  function ensureHub() {
    if (hub || !hubEnabled() || !window.HubFlow) return;
    hub = window.HubFlow.init(document.getElementById('hubFlow'));
    if (!hub) return;
    if (isPrivateMode()) { hub.usePlaceholders(); return; }   // 私密模式不展示 TMDB 内容，动效改用占位海报
    loadTrending().then(list => {
      if (list.length) hub.setPosters(list);
      else hub.usePlaceholders();
    });
  }

  function init() {
    if (shelvesEnabled()) renderContinue();
    // 打包脚本是 defer 执行的，这时 DOMContentLoaded 还没派发；首访的默认片源由 app.js 在那之后写入
    if (document.readyState === 'complete') renderSourceCount();
    else document.addEventListener('DOMContentLoaded', () => setTimeout(renderSourceCount, 0), { once: true });
    ensureHub();
  }

  // 从播放页返回、或切回首页时刷新「继续观看」；设置里刚打开的板块这时补建
  window.addEventListener('pageshow', event => { if (event.persisted && shelvesEnabled()) renderContinue(); });
  document.addEventListener('click', event => {
    const target = event.target.closest && event.target.closest('[data-action="switch-page"][data-page="home"]');
    if (target) setTimeout(() => { if (shelvesEnabled()) renderContinue(); renderSourceCount(); ensureHub(); }, 0);
  });
  window.addEventListener('leletv:layoutchange', () => { ensureHub(); if (shelvesEnabled()) renderContinue(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HomeShelves = { refresh: renderContinue, loadTrending, posterCard, skeletons, tmdbImage };
})();
