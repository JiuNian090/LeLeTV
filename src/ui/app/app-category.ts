/**
 * TMDB 分类浏览 UI 模块
 * 筛选栏渲染、结果卡片渲染、分页
 */

import {
  TMDB_STATE,
  TMDB_CONFIG,
  GENRE_MAP,
  SORT_OPTIONS,
  fetchTmdbDiscover,
  TmdbResult,
} from '../../services/api/tmdb';

// ==================== 常量 ====================

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
  { value: 'ru', label: '俄语' },
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
  { value: 'TH', label: '泰国' },
];

const TV_STATUSES = [
  { value: '', label: '全部状态' },
  { value: '0', label: '已播完' },
  { value: '1', label: '拍摄中' },
  { value: '2', label: '计划中' },
  { value: '3', label: '即将开播' },
  { value: '4', label: '连载中' },
  { value: '5', label: '暂停播出' },
];

// ==================== 工具函数 ====================

function isMovieLike(type: string): boolean {
  return type === 'movie';
}

function getEffectiveType(type: string): string {
  if (type === 'anime' || type === 'variety') return 'tv';
  return type;
}

function getYears(): { value: string; label: string }[] {
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

function escapeHtml(str: string): string {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== 入口 ====================

export function initTmdbCategory(): void {
  if (TMDB_STATE.isLoaded) return;
  TMDB_STATE.isLoaded = true;
  resetTmdbFilters();
  renderTmdbFilters();
  loadTmdbResults();
}

function resetTmdbFilters(): void {
  TMDB_STATE.page = 1;
  TMDB_STATE.selectedGenre = null;
  TMDB_STATE.selectedYear = '';
  TMDB_STATE.selectedSort = isMovieLike(TMDB_STATE.type)
    ? 'primary_release_date.desc'
    : 'first_air_date.desc';
  TMDB_STATE.voteRating = '';
  TMDB_STATE.originalLanguage = '';
  TMDB_STATE.originCountry = '';
  TMDB_STATE.tvStatus = '';
  TMDB_STATE._genreExpanded = false;

  if (TMDB_STATE.type === 'anime') {
    TMDB_STATE.selectedGenre = 16;
    TMDB_STATE.originalLanguage = 'ja';
  } else if (TMDB_STATE.type === 'variety') {
    TMDB_STATE.selectedGenre = 10764;
  }
}

// ==================== 筛选栏渲染 ====================

function renderYearFilter(): string {
  const MAX_VISIBLE = 7;
  const years = getYears();
  const selectedIdx = years.findIndex((y) => y.value === TMDB_STATE.selectedYear);
  const hasHidden = years.length > MAX_VISIBLE;
  const expanded = (TMDB_STATE as any)._yearExpanded || (hasHidden && selectedIdx >= MAX_VISIBLE);

  return `
    <div class="tmdb-genre-list year-filter-list${!expanded ? ' year-filter-collapsed' : ''}">
      ${years
        .map(
          (y, i) =>
            `<button class="tmdb-genre-btn${TMDB_STATE.selectedYear === y.value ? ' active' : ''}${i >= MAX_VISIBLE ? ' year-btn-extra' : ''}" data-year="${y.value}">${y.label}</button>`
        )
        .join('')}
      ${hasHidden ? `<button class="tmdb-genre-btn year-toggle-btn" data-year-toggle>${expanded ? '收起' : '更多年份...'}</button>` : ''}
    </div>
  `;
}

export function renderTmdbFilters(): void {
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
          <button class="tmdb-type-btn tmdb-genre-btn${type === 'movie' ? ' active' : ''}" data-type="movie">电影</button>
          <button class="tmdb-type-btn tmdb-genre-btn${type === 'tv' ? ' active' : ''}" data-type="tv">电视剧</button>
          <button class="tmdb-type-btn tmdb-genre-btn${type === 'anime' ? ' active' : ''}" data-type="anime">动漫</button>
          <button class="tmdb-type-btn tmdb-genre-btn${type === 'variety' ? ' active' : ''}" data-type="variety">综艺</button>
        </div>
      </div>
      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list${!TMDB_STATE._genreExpanded && genres.length > 8 ? ' genre-filter-collapsed' : ''}">
          <button class="tmdb-genre-btn${!TMDB_STATE.selectedGenre ? ' active' : ''}" data-genre="">全部</button>
          ${genres
            .map(
              (g, i) =>
                `<button class="tmdb-genre-btn${TMDB_STATE.selectedGenre === g.id ? ' active' : ''}${i >= 8 ? ' genre-btn-extra' : ''}" data-genre="${g.id}">${g.name}</button>`
            )
            .join('')}
          ${genres.length > 8 ? `<button class="tmdb-genre-btn genre-toggle-btn" data-genre-toggle>${TMDB_STATE._genreExpanded ? '收起' : '更多类型...'}</button>` : ''}
        </div>
      </div>
      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${COUNTRIES.map(
            (c) =>
              `<button class="tmdb-genre-btn${TMDB_STATE.originCountry === c.value ? ' active' : ''}" data-country="${c.value}">${c.label}</button>`
          ).join('')}
        </div>
      </div>
      ${!isMovie
        ? `<div class="tmdb-filter-row tmdb-genre-row"><div class="tmdb-genre-list">${TV_STATUSES.map(
            (s) =>
              `<button class="tmdb-genre-btn${TMDB_STATE.tvStatus === s.value ? ' active' : ''}" data-status="${s.value}">${s.label}</button>`
          ).join('')}</div></div>`
        : ''}
      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${LANGUAGES.map(
            (l) =>
              `<button class="tmdb-genre-btn${TMDB_STATE.originalLanguage === l.value ? ' active' : ''}" data-language="${l.value}">${l.label}</button>`
          ).join('')}
        </div>
      </div>
      <div class="tmdb-filter-row tmdb-genre-row">${renderYearFilter()}</div>
      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          <button class="tmdb-genre-btn${TMDB_STATE.voteRating === '' ? ' active' : ''}" data-rating="">全部评分</button>
          ${['9', '8', '7', '6', '5']
            .map(
              (r) =>
                `<button class="tmdb-genre-btn${TMDB_STATE.voteRating === r ? ' active' : ''}" data-rating="${r}">${r}分以上</button>`
            )
            .join('')}
        </div>
      </div>
      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list">
          ${sortOptions
            .map(
              (s) =>
                `<button class="tmdb-genre-btn${TMDB_STATE.selectedSort === s.value ? ' active' : ''}" data-sort="${s.value}">${s.label}</button>`
            )
            .join('')}
        </div>
      </div>
    </div>
  `;

  bindFilterEvents();
}

// ==================== 筛选事件绑定 ====================

function bindFilterEvents(): void {
  const section = document.querySelector('.tmdb-filter-section');
  if (!section) return;

  section.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tmdb-genre-btn') as HTMLElement;
    if (!btn) return;

    // 类型切换
    if (btn.dataset.type) {
      const type = btn.dataset.type;
      if (type !== TMDB_STATE.type) {
        TMDB_STATE.type = type as any;
        resetTmdbFilters();
        renderTmdbFilters();
        loadTmdbResults().catch(() => {});
      }
      return;
    }

    // 展开/收起
    if (btn.dataset.yearToggle) {
      (TMDB_STATE as any)._yearExpanded = !(TMDB_STATE as any)._yearExpanded;
      renderTmdbFilters();
      return;
    }
    if (btn.dataset.genreToggle) {
      TMDB_STATE._genreExpanded = !TMDB_STATE._genreExpanded;
      renderTmdbFilters();
      return;
    }

    // 筛选条件
    if (btn.dataset.genre) {
      const g = btn.dataset.genre ? Number(btn.dataset.genre) : null;
      if (g === TMDB_STATE.selectedGenre) return;
      TMDB_STATE.selectedGenre = g;
    } else if (btn.dataset.country) {
      if (btn.dataset.country === TMDB_STATE.originCountry) return;
      TMDB_STATE.originCountry = btn.dataset.country;
    } else if (btn.dataset.status) {
      if (btn.dataset.status === TMDB_STATE.tvStatus) return;
      TMDB_STATE.tvStatus = btn.dataset.status;
    } else if (btn.dataset.language) {
      if (btn.dataset.language === TMDB_STATE.originalLanguage) return;
      TMDB_STATE.originalLanguage = btn.dataset.language;
    } else if (btn.dataset.year) {
      if (btn.dataset.year === TMDB_STATE.selectedYear) return;
      TMDB_STATE.selectedYear = btn.dataset.year;
    } else if (btn.dataset.rating) {
      if (btn.dataset.rating === TMDB_STATE.voteRating) return;
      TMDB_STATE.voteRating = btn.dataset.rating;
    } else if (btn.dataset.sort) {
      if (btn.dataset.sort === TMDB_STATE.selectedSort) return;
      TMDB_STATE.selectedSort = btn.dataset.sort;
    } else {
      return;
    }

    TMDB_STATE.page = 1;
    renderTmdbFilters();
    loadTmdbResults().catch(() => {});
  });
}

// ==================== 加载结果 ====================

export async function loadTmdbResults(): Promise<void> {
  if (TMDB_STATE.isLoading) return;
  TMDB_STATE.isLoading = true;

  const container = document.getElementById('tmdb-results');
  if (!container) return;

  container.innerHTML = `<div class="tmdb-loading"><div class="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div><span class="text-gray-400 ml-3">加载中...</span></div>`;

  try {
    const data = await fetchTmdbDiscover();
    if (!data) throw new Error('TMDB Worker 未配置');

    renderTmdbCards(data.results || []);
    renderTmdbPagination();
  } catch (err: any) {
    console.error('TMDB 加载失败:', err);
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-red-400 text-lg mb-2">加载失败</div>
        <div class="text-gray-500 text-sm">${err.message}</div>
        <button data-action="load-tmdb-results" class="mt-4 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors">重试</button>
      </div>
    `;
  } finally {
    TMDB_STATE.isLoading = false;
  }
}

// ==================== 渲染卡片 ====================

function renderTmdbCards(items: TmdbResult[]): void {
  const container = document.getElementById('tmdb-results');
  if (!container) return;

  if (!items?.length) {
    container.innerHTML = `<div class="col-span-full text-center py-12"><div class="text-gray-400 text-lg">没有找到相关内容</div><div class="text-gray-500 text-sm mt-2">请尝试调整筛选条件</div></div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const title = isMovieLike(TMDB_STATE.type) ? item.title : item.name;
    const date = isMovieLike(TMDB_STATE.type) ? item.release_date : item.first_air_date;
    const year = date ? date.split('-')[0] : '';
    const vote = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const poster = item.poster_path
      ? `${TMDB_CONFIG.imageBase}/${TMDB_CONFIG.posterSize}${item.poster_path}`
      : null;
    const overview = item.overview || '暂无简介';
    const safeTitle = escapeHtml(title || '');
    const safeOverview = escapeHtml(overview);

    const genresList = (GENRE_MAP[getEffectiveType(TMDB_STATE.type)] || [])
      .filter((g) => (item.genre_ids || []).includes(g.id))
      .map((g) => g.name)
      .slice(0, 2);

    const card = document.createElement('div');
    card.className = 'tmdb-card';

    card.innerHTML = `
      <div class="tmdb-card-inner" data-action="tmdb-search-video" data-title="${safeTitle}">
        <div class="tmdb-card-poster">
          ${poster
            ? `<img src="${poster}" alt="${safeTitle}" loading="lazy" class="tmdb-card-img" onerror="this.parentElement.innerHTML='<div class=\\'tmdb-card-placeholder\\'><svg class=\\'w-12 h-12\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z\\'></path></svg><span class=\\'text-xs text-gray-500 mt-2\\'>${safeTitle}</span></div>'">
            <div class="tmdb-card-rating">★ ${vote}</div>
            ${genresList.length ? `<div class="tmdb-card-genres">${genresList.map((g) => `<span>${g}</span>`).join('')}</div>` : ''}`
            : `<div class="tmdb-card-placeholder"><svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg><span class="text-xs text-gray-500 mt-2">${safeTitle}</span></div>`
          }
        </div>
        <div class="tmdb-card-body">
          <div class="tmdb-card-meta"><span class="tmdb-card-year">${year}</span>${item.vote_count ? `<span class="tmdb-card-votes">${item.vote_count} 票</span>` : ''}</div>
          <div class="tmdb-card-title" title="${safeTitle}">${safeTitle}</div>
          <div class="tmdb-card-overview">${safeOverview}</div>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
}

// ==================== 分页 ====================

function renderTmdbPagination(): void {
  const container = document.getElementById('tmdb-pagination');
  if (!container) return;

  if (TMDB_STATE.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const current = TMDB_STATE.page;
  const total = TMDB_STATE.totalPages;
  const range: (number | string)[] = [];
  const delta = 2;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }

  container.innerHTML = `
    <div class="tmdb-pagination">
      <button class="tmdb-page-btn${current <= 1 ? ' disabled' : ''}" data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}>上一页</button>
      ${range
        .map((p) =>
          typeof p === 'number'
            ? `<button class="tmdb-page-btn${p === current ? ' active' : ''}" data-page="${p}">${p}</button>`
            : `<span class="tmdb-page-ellipsis">${p}</span>`
        )
        .join('')}
      <button class="tmdb-page-btn${current >= total ? ' disabled' : ''}" data-page="${current + 1}" ${current >= total ? 'disabled' : ''}>下一页</button>
    </div>
  `;

  container.querySelectorAll('.tmdb-page-btn:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = Number((btn as HTMLElement).dataset.page);
      if (page && page !== TMDB_STATE.page) {
        TMDB_STATE.page = page;
        renderTmdbFilters();
        loadTmdbResults();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}
