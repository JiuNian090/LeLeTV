const TMDB_STATE = {
  type: 'movie',
  page: 1,
  totalPages: 1,
  selectedGenre: null,
  selectedYear: '',
  selectedSort: 'primary_release_date.desc',
  voteRating: '',
  originalLanguage: '',
  originCountry: '',
  tvStatus: '',
  isLoaded: false,
  isLoading: false,
  _genreExpanded: false
};

const TMDB_CONFIG = {
  imageBase: 'https://image.tmdb.org/t/p',
  posterSize: 'w342',
  backdropSize: 'w780',
  language: 'zh-CN'
};

const GENRE_MAP = {
  movie: [
    { id: 28, name: '动作' },
    { id: 12, name: '冒险' },
    { id: 16, name: '动画' },
    { id: 35, name: '喜剧' },
    { id: 80, name: '犯罪' },
    { id: 99, name: '纪录' },
    { id: 18, name: '剧情' },
    { id: 10751, name: '家庭' },
    { id: 14, name: '奇幻' },
    { id: 36, name: '历史' },
    { id: 27, name: '恐怖' },
    { id: 10402, name: '音乐' },
    { id: 9648, name: '悬疑' },
    { id: 10749, name: '爱情' },
    { id: 878, name: '科幻' },
    { id: 10770, name: '电视电影' },
    { id: 53, name: '惊悚' },
    { id: 10752, name: '战争' },
    { id: 37, name: '西部' }
  ],
  tv: [
    { id: 10759, name: '动作冒险' },
    { id: 16, name: '动画' },
    { id: 35, name: '喜剧' },
    { id: 80, name: '犯罪' },
    { id: 99, name: '纪录' },
    { id: 18, name: '剧情' },
    { id: 10751, name: '家庭' },
    { id: 10762, name: '儿童' },
    { id: 9648, name: '悬疑' },
    { id: 10763, name: '新闻' },
    { id: 10764, name: '真人秀' },
    { id: 10765, name: '科幻奇幻' },
    { id: 10766, name: '肥皂剧' },
    { id: 10767, name: '脱口秀' },
    { id: 10768, name: '战争政治' },
    { id: 37, name: '西部' }
  ]
};

const SORT_OPTIONS = {
  movie: [
    { value: 'primary_release_date.desc', label: '最近上映' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'revenue.desc', label: '最高票房' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'title.asc', label: '名称A-Z' },
    { value: 'title.desc', label: '名称Z-A' },
    { value: 'original_title.asc', label: '原名A-Z' }
  ],
  tv: [
    { value: 'first_air_date.desc', label: '最近开播' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'name.asc', label: '名称A-Z' },
    { value: 'name.desc', label: '名称Z-A' }
  ],
  anime: [
    { value: 'first_air_date.desc', label: '最近开播' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'name.asc', label: '名称A-Z' },
    { value: 'name.desc', label: '名称Z-A' }
  ],
  variety: [
    { value: 'first_air_date.desc', label: '最近开播' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'name.asc', label: '名称A-Z' },
    { value: 'name.desc', label: '名称Z-A' }
  ]
};

const LANGUAGES = [
  { value: '', label: '全部语言' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'th', label: '泰语' },
  { value: 'hi', label: '印地语' },
  { value: 'ru', label: '俄语' }
];

const COUNTRIES = [
  { value: '', label: '全部地区' },
  { value: 'CN', label: '中国大陆' },
  { value: 'US', label: '美国' },
  { value: 'JP', label: '日本' },
  { value: 'KR', label: '韩国' },
  { value: 'GB', label: '英国' },
  { value: 'FR', label: '法国' },
  { value: 'DE', label: '德国' },
  { value: 'HK', label: '香港' },
  { value: 'TW', label: '台湾' },
  { value: 'IN', label: '印度' },
  { value: 'TH', label: '泰国' }
];

const TV_STATUSES = [
  { value: '', label: '全部状态' },
  { value: '0', label: '已播完' },
  { value: '1', label: '拍摄中' },
  { value: '2', label: '计划中' },
  { value: '3', label: '即将开播' },
  { value: '4', label: '连载中' },
  { value: '5', label: '暂停播出' }
];

function getYears() {
  const current = new Date().getFullYear();
  const years = [{ value: '', label: '全部年份' }];
  for (let y = current; y >= 1990; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  years.push({ value: '1980s', label: '1980年代' });
  years.push({ value: '1970s', label: '1970年代' });
  years.push({ value: '1960s', label: '更早' });
  return years;
}

function isMovieLike(type) {
  return type === 'movie';
}

function getEffectiveType(type) {
  if (type === 'anime') return 'tv';
  if (type === 'variety') return 'tv';
  return type;
}

function getTmdbBaseUrl() {
  if (typeof TMDB_WORKER_URL !== 'undefined' && TMDB_WORKER_URL) {
    return TMDB_WORKER_URL;
  }
  return '/api/tmdb';
}

async function tmdbFetch(endpoint, params = {}) {
  params.endpoint = endpoint;
  const query = new URLSearchParams(params).toString();
  const url = `${getTmdbBaseUrl()}?${query}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB 请求失败: ${res.status}`);
  return res.json();
}

function initTmdbCategory() {
  if (TMDB_STATE.isLoaded) return;
  TMDB_STATE.isLoaded = true;
  resetTmdbFilters();
  renderTmdbFilters();
  loadTmdbResults();
}

function resetTmdbFilters() {
  TMDB_STATE.page = 1;
  TMDB_STATE.selectedGenre = null;
  TMDB_STATE.selectedYear = '';
  TMDB_STATE.selectedSort = isMovieLike(TMDB_STATE.type) ? 'primary_release_date.desc' : 'first_air_date.desc';
  TMDB_STATE.voteRating = '';
  TMDB_STATE.originalLanguage = '';
  TMDB_STATE.originCountry = '';
  TMDB_STATE.tvStatus = '';

  if (TMDB_STATE.type === 'anime') {
    TMDB_STATE.selectedGenre = 16;
    TMDB_STATE.originalLanguage = 'ja';
  } else if (TMDB_STATE.type === 'variety') {
    TMDB_STATE.selectedGenre = 10764;
  }
}

function renderYearFilter() {
  const MAX_VISIBLE = 7;
  const years = getYears();
  const selectedIdx = years.findIndex(y => y.value === TMDB_STATE.selectedYear);
  const hasHiddenYears = years.length > MAX_VISIBLE;
  const expanded = TMDB_STATE._yearExpanded || (hasHiddenYears && selectedIdx >= MAX_VISIBLE);

  return `
    <div class="tmdb-genre-list year-filter-list${!expanded ? ' year-filter-collapsed' : ''}">
      ${years.map((y, i) => `
        <button class="tmdb-genre-btn${TMDB_STATE.selectedYear === y.value ? ' active' : ''}${i >= MAX_VISIBLE ? ' year-btn-extra' : ''}" data-year="${y.value}">${y.label}</button>
      `).join('')}
      ${hasHiddenYears ? `
        <button class="tmdb-genre-btn year-toggle-btn" data-year-toggle>
          ${expanded ? '收起' : `更多年份...`}
        </button>
      ` : ''}
    </div>
  `;
}

function renderTmdbFilters() {
  const container = document.getElementById('tmdb-filters');
  if (!container) return;

  const type = TMDB_STATE.type;
  const isMovie = isMovieLike(type);
  const genres = GENRE_MAP[getEffectiveType(type)];
  const sortOptions = SORT_OPTIONS[type];

  container.innerHTML = `
    <div class="tmdb-filter-section">
      <div class="tmdb-filter-row">
        <div class="tmdb-type-switch">
          <button class="tmdb-type-btn${type === 'movie' ? ' active' : ''}" data-type="movie">电影</button>
          <button class="tmdb-type-btn${type === 'tv' ? ' active' : ''}" data-type="tv">电视剧</button>
          <button class="tmdb-type-btn${type === 'anime' ? ' active' : ''}" data-type="anime">动漫</button>
          <button class="tmdb-type-btn${type === 'variety' ? ' active' : ''}" data-type="variety">综艺</button>
        </div>
      </div>

      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list${!TMDB_STATE._genreExpanded && GENRE_MAP[getEffectiveType(type)].length > 8 ? ' genre-filter-collapsed' : ''}">
          <button class="tmdb-genre-btn${!TMDB_STATE.selectedGenre ? ' active' : ''}" data-genre="">全部</button>
          ${genres.map((g, i) => `
            <button class="tmdb-genre-btn${TMDB_STATE.selectedGenre === g.id ? ' active' : ''}${i >= 8 ? ' genre-btn-extra' : ''}" data-genre="${g.id}">${g.name}</button>
          `).join('')}
          ${GENRE_MAP[getEffectiveType(type)].length > 8 ? `
            <button class="tmdb-genre-btn genre-toggle-btn" data-genre-toggle>
              ${TMDB_STATE._genreExpanded ? '收起' : '更多类型...'}
            </button>
          ` : ''}
        </div>
      </div>

      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${COUNTRIES.map(c => `
            <button class="tmdb-genre-btn${TMDB_STATE.originCountry === c.value ? ' active' : ''}" data-country="${c.value}">${c.label}</button>
          `).join('')}
        </div>
      </div>

      ${!isMovie ? `
      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${TV_STATUSES.map(s => `
            <button class="tmdb-genre-btn${TMDB_STATE.tvStatus === s.value ? ' active' : ''}" data-status="${s.value}">${s.label}</button>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${LANGUAGES.map(l => `
            <button class="tmdb-genre-btn${TMDB_STATE.originalLanguage === l.value ? ' active' : ''}" data-language="${l.value}">${l.label}</button>
          `).join('')}
        </div>
      </div>

      <div class="tmdb-filter-row tmdb-genre-row">
        ${renderYearFilter()}
      </div>

      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '' ? ' active' : ''}" data-rating="">全部评分</button>
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '9' ? ' active' : ''}" data-rating="9">9分以上</button>
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '8' ? ' active' : ''}" data-rating="8">8分以上</button>
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '7' ? ' active' : ''}" data-rating="7">7分以上</button>
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '6' ? ' active' : ''}" data-rating="6">6分以上</button>
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '5' ? ' active' : ''}" data-rating="5">5分以上</button>
        </div>
      </div>

      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${sortOptions.map(s => `
            <button class="tmdb-genre-btn${TMDB_STATE.selectedSort === s.value ? ' active' : ''}" data-sort="${s.value}">${s.label}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  bindTypeSwitch();
  bindFilterTags();
}

function bindTypeSwitch() {
  document.querySelectorAll('.tmdb-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type !== TMDB_STATE.type) {
        TMDB_STATE.type = type;
        resetTmdbFilters();
        renderTmdbFilters();
        loadTmdbResults();
      }
    });
  });
}

function bindFilterTags() {
  const section = document.querySelector('.tmdb-filter-section');
  if (!section) return;

  section.addEventListener('click', (e) => {
    const btn = e.target.closest('.tmdb-genre-btn');
    if (!btn) return;

    if (btn.hasAttribute('data-type')) return;

    if (btn.hasAttribute('data-genre')) {
      const genre = btn.dataset.genre ? Number(btn.dataset.genre) : null;
      if (genre === TMDB_STATE.selectedGenre) return;
      TMDB_STATE.selectedGenre = genre;
    } else if (btn.hasAttribute('data-country')) {
      if (btn.dataset.country === TMDB_STATE.originCountry) return;
      TMDB_STATE.originCountry = btn.dataset.country;
    } else if (btn.hasAttribute('data-status')) {
      if (btn.dataset.status === TMDB_STATE.tvStatus) return;
      TMDB_STATE.tvStatus = btn.dataset.status;
    } else if (btn.hasAttribute('data-language')) {
      if (btn.dataset.language === TMDB_STATE.originalLanguage) return;
      TMDB_STATE.originalLanguage = btn.dataset.language;
    } else if (btn.hasAttribute('data-year-toggle')) {
      TMDB_STATE._yearExpanded = !TMDB_STATE._yearExpanded;
      renderTmdbFilters();
      return;
    } else if (btn.hasAttribute('data-genre-toggle')) {
      TMDB_STATE._genreExpanded = !TMDB_STATE._genreExpanded;
      renderTmdbFilters();
      return;
    } else if (btn.hasAttribute('data-year')) {
      if (btn.dataset.year === TMDB_STATE.selectedYear) return;
      TMDB_STATE.selectedYear = btn.dataset.year;
    } else if (btn.hasAttribute('data-rating')) {
      if (btn.dataset.rating === TMDB_STATE.voteRating) return;
      TMDB_STATE.voteRating = btn.dataset.rating;
    } else if (btn.hasAttribute('data-sort')) {
      if (btn.dataset.sort === TMDB_STATE.selectedSort) return;
      TMDB_STATE.selectedSort = btn.dataset.sort;
    } else {
      return;
    }

    TMDB_STATE.page = 1;
    renderTmdbFilters();
    loadTmdbResults();
  });
}

async function loadTmdbResults() {
  if (TMDB_STATE.isLoading) return;
  TMDB_STATE.isLoading = true;

  const container = document.getElementById('tmdb-results');
  if (!container) return;

  container.innerHTML = `
    <div class="tmdb-loading">
      <div class="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-gray-400 ml-3">加载中...</span>
    </div>
  `;

  try {
    const type = TMDB_STATE.type;
    const isMovie = isMovieLike(type);
    const params = {
      language: 'zh-CN',
      page: TMDB_STATE.page,
      sort_by: TMDB_STATE.selectedSort,
      'vote_count.gte': 10
    };

    if (TMDB_STATE.selectedGenre) {
      params.with_genres = TMDB_STATE.selectedGenre;
    }

    if (TMDB_STATE.selectedYear) {
      if (TMDB_STATE.selectedYear === '1980s') {
        params[isMovie ? 'primary_release_date.gte' : 'first_air_date.gte'] = '1980-01-01';
        params[isMovie ? 'primary_release_date.lte' : 'first_air_date.lte'] = '1989-12-31';
      } else if (TMDB_STATE.selectedYear === '1970s') {
        params[isMovie ? 'primary_release_date.gte' : 'first_air_date.gte'] = '1970-01-01';
        params[isMovie ? 'primary_release_date.lte' : 'first_air_date.lte'] = '1979-12-31';
      } else if (TMDB_STATE.selectedYear === '1960s') {
        params[isMovie ? 'primary_release_date.gte' : 'first_air_date.gte'] = '1900-01-01';
        params[isMovie ? 'primary_release_date.lte' : 'first_air_date.lte'] = '1969-12-31';
      } else if (isMovie) {
        params.year = TMDB_STATE.selectedYear;
      } else {
        params.first_air_date_year = TMDB_STATE.selectedYear;
      }
    }

    if (TMDB_STATE.voteRating) {
      params['vote_average.gte'] = TMDB_STATE.voteRating;
    }

    if (TMDB_STATE.originalLanguage) {
      params.with_original_language = TMDB_STATE.originalLanguage;
    }

    if (TMDB_STATE.originCountry) {
      if (isMovie) {
        params.region = TMDB_STATE.originCountry;
      } else {
        params.with_origin_country = TMDB_STATE.originCountry;
      }
    }

    if (!isMovie && TMDB_STATE.tvStatus) {
      params.with_status = TMDB_STATE.tvStatus;
    }

    const endpoint = isMovie ? 'discover/movie' : 'discover/tv';

    const ourPage = TMDB_STATE.page;
    const startIdx = (ourPage - 1) * 24;
    const tmdbPage1 = Math.floor(startIdx / 20) + 1;
    const offset = startIdx % 20;

    const [data, data2] = await Promise.all([
      tmdbFetch(endpoint, { ...params, page: tmdbPage1 }),
      tmdbPage1 + 1 <= 500
        ? tmdbFetch(endpoint, { ...params, page: tmdbPage1 + 1 })
        : { results: [] }
    ]);

    let results = [...(data.results || []), ...(data2.results || [])];
    results = results.slice(offset, offset + 24);

    const totalTmdbPages = Math.min(data.total_pages || 1, 500);
    TMDB_STATE.totalPages = Math.min(Math.ceil(totalTmdbPages * 20 / 24), 500);
    renderTmdbCards(results);
    renderTmdbPagination();
  } catch (err) {
    console.error('TMDB 加载失败:', err);
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-red-400 text-lg mb-2">加载失败</div>
        <div class="text-gray-500 text-sm">${err.message}，请检查 TMDB API Key 是否正确配置</div>
        <button data-action="load-tmdb-results" class="mt-4 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors">重试</button>
      </div>
    `;
  } finally {
    TMDB_STATE.isLoading = false;
  }
}

function renderTmdbCards(items) {
  const container = document.getElementById('tmdb-results');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-gray-400 text-lg">没有找到相关内容</div>
        <div class="text-gray-500 text-sm mt-2">请尝试调整筛选条件</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const title = isMovieLike(TMDB_STATE.type) ? item.title : item.name;
    const date = isMovieLike(TMDB_STATE.type) ? item.release_date : item.first_air_date;
    const year = date ? date.split('-')[0] : '';
    const voteAverage = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const posterPath = item.poster_path
      ? `${TMDB_CONFIG.imageBase}/${TMDB_CONFIG.posterSize}${item.poster_path}`
      : null;
    const overview = item.overview || '暂无简介';
    const language = item.original_language || '';

    const genresList = GENRE_MAP[getEffectiveType(TMDB_STATE.type)]
      .filter(g => (item.genre_ids || []).includes(g.id))
      .map(g => g.name)
      .slice(0, 2);

    const langLabel = LANGUAGES.find(l => l.value === language);

    const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeOverview = overview.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const card = document.createElement('div');
    card.className = 'tmdb-card';

    card.innerHTML = `
      <div class="tmdb-card-inner" data-action="tmdb-search-video" data-title="${safeTitle}">
        <div class="tmdb-card-poster">
          ${posterPath
            ? `<img src="${posterPath}" alt="${safeTitle}" loading="lazy" class="tmdb-card-img" onerror="this.parentElement.innerHTML = '<div class=\\'tmdb-card-placeholder\\'><svg class=\\'w-12 h-12\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z\\'></path></svg><span class=\\'text-xs text-gray-500 mt-2\\'>${safeTitle}</span></div>'">
            <div class="tmdb-card-rating">★ ${voteAverage}</div>
            ${genresList.length ? `<div class="tmdb-card-genres">${genresList.map(g => `<span>${g}</span>`).join('')}</div>` : ''}`
            : `<div class="tmdb-card-placeholder">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <span class="text-xs text-gray-500 mt-2">${safeTitle}</span>
              </div>`
          }
          ${langLabel ? `<div class="tmdb-card-lang">${langLabel.label}</div>` : ''}
        </div>
        <div class="tmdb-card-body">
          <div class="tmdb-card-meta">
            <span class="tmdb-card-year">${year}</span>
            ${item.vote_count ? `<span class="tmdb-card-votes">${item.vote_count} 票</span>` : ''}
          </div>
          <div class="tmdb-card-title" title="${safeTitle}">${safeTitle}</div>
          <div class="tmdb-card-overview">${safeOverview}</div>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
}

function renderTmdbPagination() {
  const container = document.getElementById('tmdb-pagination');
  if (!container) return;

  if (TMDB_STATE.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const current = TMDB_STATE.page;
  const total = TMDB_STATE.totalPages;

  const getPageButtons = () => {
    const pages = [];
    const addPage = (n) => { if (!pages.includes(n) && n >= 1 && n <= total) pages.push(n); };

    addPage(1);
    addPage(current - 1);
    addPage(current);
    addPage(current + 1);
    addPage(total);

    pages.sort((a, b) => a - b);

    const result = [];
    for (let i = 0; i < pages.length; i++) {
      if (i > 0 && pages[i] - pages[i - 1] > 1) {
        result.push('ellipsis');
      }
      result.push(pages[i]);
    }
    return result;
  };

  container.innerHTML = `
    <div class="tmdb-pagination-inner">
      <button class="tmdb-page-btn${current <= 1 ? ' disabled' : ''}" data-page="${current - 1}"${current <= 1 ? ' disabled' : ''}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      ${getPageButtons().map(p => {
        if (p === 'ellipsis') return '<span class="tmdb-page-ellipsis">...</span>';
        return `<button class="tmdb-page-btn${p === current ? ' active' : ''}" data-page="${p}">${p}</button>`;
      }).join('')}
      <button class="tmdb-page-btn${current >= total ? ' disabled' : ''}" data-page="${current + 1}"${current >= total ? ' disabled' : ''}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  `;

  container.querySelectorAll('.tmdb-page-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = Number(btn.dataset.page);
      if (page >= 1 && page <= total && page !== current) {
        TMDB_STATE.page = page;
        loadTmdbResults();
        const filtersEl = document.getElementById('tmdb-filters');
        if (filtersEl) {
          window.scrollTo({ top: filtersEl.offsetTop - 80, behavior: 'smooth' });
        }
      }
    });
  });
}

function tmdbSearchVideo(title) {
  if (!title) return;
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  switchPage('home');
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = safeTitle;
    setTimeout(() => search(), 300);
  }
}

function resetTmdbCategory() {
  TMDB_STATE.type = 'movie';
  TMDB_STATE.page = 1;
  TMDB_STATE.totalPages = 1;
  TMDB_STATE.isLoaded = false;
  TMDB_STATE.isLoading = false;
  resetTmdbFilters();
}
