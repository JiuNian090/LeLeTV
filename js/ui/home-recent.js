/**
 * 首页「最近更新」：电影 / 电视剧 / 动漫 / 综艺各一行，数据来自 TMDB discover。
 *   - 电影：近 60 天有数字或实体发行的片（片源里「更新」的大致时间），按热度排
 *   - 电视剧：近 10 天播出过新集的剧（排除动画、真人秀、脱口秀、新闻、肥皂剧、儿童）
 *   - 动漫：近 10 天有新集的日本动画
 *   - 综艺：近 3 周有新集的中韩港台真人秀
 * 每行渲染 6 张，栅格列数少时由 CSS 收掉不满一行的那几张；「更多」切到分类页并预置对应类型。
 * 结果在 sessionStorage 里缓存半小时：从播放页返回时不重新请求。
 * 卡片沿用 home-shelves.js 的 posterCard：点击按片名去各片源检索。
 */
(function () {
  'use strict';

  const LIMIT = 6;
  const CACHE_KEY = 'leletv_home_recent_v1';
  const CACHE_TTL = 30 * 60 * 1000;
  const TYPES = ['movie', 'tv', 'anime', 'variety'];

  // 剧集带 origin_country；电影只有 original_language，按语言给个大致地区
  const REGION = {
    CN: '大陆', HK: '香港', TW: '台湾', US: '美国', GB: '英国', JP: '日本', KR: '韩国', FR: '法国', DE: '德国',
    TH: '泰国', IN: '印度', ES: '西班牙', IT: '意大利', CA: '加拿大', AU: '澳大利亚', RU: '俄罗斯', BR: '巴西',
    MX: '墨西哥', SE: '瑞典', DK: '丹麦', NO: '挪威', NL: '荷兰', BE: '比利时', AT: '奥地利', PL: '波兰',
    TR: '土耳其', IE: '爱尔兰', NZ: '新西兰', AR: '阿根廷', SG: '新加坡', MY: '马来西亚', PH: '菲律宾',
    ID: '印尼', VN: '越南', CH: '瑞士', FI: '芬兰', PT: '葡萄牙', CO: '哥伦比亚', IL: '以色列', ZA: '南非'
  };
  const LANG_REGION = {
    zh: '华语', cn: '华语', en: '英语', ja: '日本', ko: '韩国', fr: '法国', de: '德国', es: '西班牙', it: '意大利',
    th: '泰国', hi: '印度', ru: '俄罗斯', pt: '葡语', sv: '瑞典', da: '丹麦', no: '挪威', nl: '荷兰', pl: '波兰',
    tr: '土耳其', id: '印尼', vi: '越南', tl: '菲律宾', ms: '马来', ar: '阿拉伯语', fa: '波斯语', he: '希伯来语'
  };

  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  const QUERIES = {
    movie: () => ['discover/movie', {
      sort_by: 'popularity.desc',
      with_release_type: '4|5',
      'release_date.gte': day(-60),
      'release_date.lte': day(0),
      'vote_count.gte': 5
    }],
    tv: () => ['discover/tv', {
      sort_by: 'popularity.desc',
      'air_date.gte': day(-10),
      'air_date.lte': day(1),
      without_genres: '16,10764,10767,10763,10766,10762',
      'vote_count.gte': 3
    }],
    anime: () => ['discover/tv', {
      sort_by: 'popularity.desc',
      'air_date.gte': day(-10),
      'air_date.lte': day(1),
      with_genres: '16',
      with_original_language: 'ja'
    }],
    variety: () => ['discover/tv', {
      sort_by: 'popularity.desc',
      'air_date.gte': day(-21),
      'air_date.lte': day(1),
      with_genres: '10764',
      with_origin_country: 'CN|KR|TW|HK'
    }]
  };

  function isPrivateMode() {
    return typeof isHiddenContentMode === 'function' && isHiddenContentMode();
  }

  function fetchList(endpoint, params) {
    const query = Object.assign({ language: 'zh-CN', page: 1 }, params);
    if (typeof tmdbFetch === 'function') return tmdbFetch(endpoint, query);
    query.endpoint = endpoint;
    return fetch('/api/tmdb?' + new URLSearchParams(query).toString()).then(res => {
      if (!res.ok) throw new Error('TMDB ' + res.status);
      return res.json();
    });
  }

  function genreNames(type, ids) {
    const map = typeof GENRE_MAP === 'object' && GENRE_MAP ? GENRE_MAP[type === 'movie' ? 'movie' : 'tv'] : null;
    if (!map || !Array.isArray(ids)) return [];
    return map.filter(g => ids.includes(g.id)).map(g => g.name)
      // 动漫、综艺这两行的类型本身就是「动画」「真人秀」，再写一遍是废话
      .filter(name => !((type === 'anime' && name === '动画') || (type === 'variety' && name === '真人秀')))
      .slice(0, 2);
  }

  function regionOf(item) {
    const countries = Array.isArray(item.origin_country) ? item.origin_country : [];
    for (const code of countries) {
      if (REGION[code]) return REGION[code];
    }
    return LANG_REGION[item.original_language] || '';
  }

  function formatVotes(n) {
    if (!n) return '';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万人评';
    return n + '人评';
  }

  function normalize(type, item) {
    const title = String(item.title || item.name || '').trim();
    const date = String(item.release_date || item.first_air_date || '');
    const shelves = window.HomeShelves;
    return {
      title,
      year: date.slice(0, 4),
      region: regionOf(item),
      genres: genreNames(type, item.genre_ids),
      rating: item.vote_count >= 10 && item.vote_average ? Number(item.vote_average).toFixed(1) : '',
      votes: item.vote_count >= 10 ? formatVotes(item.vote_count) : '',
      img: shelves ? shelves.tmdbImage(item.poster_path) : ''
    };
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.at > CACHE_TTL || !cached.data) return null;
      return cached.data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* 忽略 */ }
  }

  function loadType(type) {
    const [endpoint, params] = QUERIES[type]();
    return fetchList(endpoint, params)
      .then(data => (data && Array.isArray(data.results) ? data.results : [])
        .filter(item => item && item.poster_path && (item.title || item.name))
        .slice(0, LIMIT)
        .map(item => normalize(type, item)))
      .catch(err => {
        console.warn('[home] 最近更新加载失败', type, err);
        return [];
      });
  }

  function renderRow(row, items) {
    const grid = row.querySelector('[data-recent-list]');
    const shelves = window.HomeShelves;
    if (!grid || !shelves || !items.length) { row.hidden = true; return false; }
    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const card = shelves.posterCard({
        action: 'tmdb-search-video',
        data: { title: item.title, genres: item.genres.join(',') },
        title: item.title,
        label: '检索 ' + item.title,
        sub: [item.year, item.region].concat(item.genres).filter(Boolean).join(' / '),
        img: item.img,
        rating: item.rating,
        votes: item.votes
      });
      card.classList.add('v2-pcard--recent');
      frag.appendChild(card);
    });
    grid.replaceChildren(frag);
    row.hidden = false;
    return true;
  }

  let started = false;

  function shelvesEnabled() {
    return document.documentElement.getAttribute('data-home-shelves') !== 'off';   // 设置 › 首页与导航 关掉了内容板块
  }

  function init() {
    if (started || !shelvesEnabled()) return;
    const section = document.getElementById('homeRecent');
    if (!section || isPrivateMode()) return;   // 私密模式不展示 TMDB 内容
    started = true;
    const rows = {};
    TYPES.forEach(type => {
      const row = section.querySelector('[data-recent="' + type + '"]');
      if (!row) return;
      rows[type] = row;
      const grid = row.querySelector('[data-recent-list]');
      if (grid && window.HomeShelves) grid.replaceChildren(window.HomeShelves.skeletons(LIMIT));
      row.hidden = false;
    });
    section.hidden = false;

    const cached = readCache();
    const pending = TYPES.map(type => cached && Array.isArray(cached[type])
      ? Promise.resolve(cached[type])
      : loadType(type));

    Promise.all(pending).then(lists => {
      const data = {};
      let shown = 0;
      TYPES.forEach((type, i) => {
        data[type] = lists[i];
        if (rows[type] && renderRow(rows[type], lists[i])) shown++;
      });
      section.hidden = shown === 0;
      if (!cached) writeCache(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // 设置里刚把内容板块打开：这时再拉数据
  window.addEventListener('leletv:layoutchange', init);

  window.HomeRecent = { ensure: init };
})();
