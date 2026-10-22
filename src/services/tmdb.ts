// 阶段 5B-3：TMDB Worker URL 改为显式 import。
import { TMDB_WORKER_URL } from '../core/config';
import { GENRE_MAP } from '../core/genres';
import type { GenreItem } from '../core/genres';
import { getMediaProvider } from './media';
import type { MediaCategory, MediaItem, MediaSort } from './media';
import { saveLastPickedMedia } from './media/context';

// 兼容旧调用方：类型表已下沉 core，这里继续按原路径导出
export { GENRE_MAP } from '../core/genres';
export type { GenreItem } from '../core/genres';

interface TmdbState {
  type: string;
  page: number;
  totalPages: number;
  selectedGenre: number | null;
  selectedYear: string;
  selectedSort: string;
  voteRating: string;
  originalLanguage: string;
  originCountry: string;
  tvStatus: string;
  isLoaded: boolean;
  isLoading: boolean;
  _genreExpanded: boolean;
  _yearExpanded?: boolean;
  _filtersCollapsed: boolean | null;
  [key: string]: unknown;
}

interface TmdbConfig {
  imageBase: string;
  posterSize: string;
  backdropSize: string;
  language: string;
}

interface SortOption {
  value: string;
  label: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface TmdbResultItem {
  [key: string]: unknown;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface TmdbResponse {
  results?: TmdbResultItem[];
  total_pages?: number;
}

interface TmdbWindow extends Window {
  saveTmdbScroll?: () => void;
}

declare function generateSkeletonCards(count: number): string;
declare function openMoviesPage(title: string, options: { from: string; fallbackGenres: string[] }): void;
declare function switchPage(page: string): void;
declare function search(): void;

const tmdbWindow = window as TmdbWindow;

// 阶段 5A-2 过渡期类型桥：tmdb.ts 已成为 ESM 模块，但未改造的全局脚本
// 仍以裸名访问这些符号（运行时由文件末尾的 window 兼容桥提供）。
declare global {
  const TMDB_STATE: TmdbState;
  const TMDB_CONFIG: TmdbConfig;
  const GENRE_MAP: Record<string, GenreItem[]>;
  const TMDB_STATE_KEY: string;
  function initTmdbCategory(): void;
  function saveTmdbScroll(): void;
  function restoreTmdbState(): boolean;
  function tmdbSearchVideo(title: string, genres: string): void;
  function openTmdbCategory(type: string): void;
  function loadTmdbResults(): Promise<void>;
  function tmdbFetch(endpoint: string, params?: Record<string, string>): Promise<TmdbResponse>;
}

export const TMDB_STATE: TmdbState = {
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
  _genreExpanded: false,
  _filtersCollapsed: null
};

// 类别页状态持久化（sessionStorage）：从播放页返回时恢复筛选/页码/滚动位置
export const TMDB_STATE_KEY = 'leletv_tmdb_state';
const TMDB_SCROLL_KEY = 'leletv_tmdb_scroll';

function saveTmdbState(): void {
  try {
    const { isLoaded, isLoading, _genreExpanded, ...rest } = TMDB_STATE;
    sessionStorage.setItem(TMDB_STATE_KEY, JSON.stringify(rest));
  } catch (e) { /* 忽略 sessionStorage 不可用 */ }
}

export function restoreTmdbState(): boolean {
  try {
    const raw = sessionStorage.getItem(TMDB_STATE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    if (!saved || typeof saved !== 'object') return false;
    let restored = false;
    Object.keys(saved).forEach(k => {
      if (k in TMDB_STATE) {
        TMDB_STATE[k] = saved[k];
        restored = true;
      }
    });
    return restored;
  } catch (e) { /* 忽略 */ }
  return false;
}

export function saveTmdbScroll(): void {
  try {
    const y = window.scrollY;
    if (y > 0) sessionStorage.setItem(TMDB_SCROLL_KEY, String(y));
  } catch (e) { /* 忽略 */ }
}

function restoreTmdbScroll(): void {
  try {
    const raw = sessionStorage.getItem(TMDB_SCROLL_KEY);
    if (!raw) return;
    sessionStorage.removeItem(TMDB_SCROLL_KEY);
    const y = parseInt(raw, 10);
    if (y > 0) {
      // 等待页面切换的滚动动画结束后再恢复位置
      setTimeout(() => window.scrollTo({ top: y, behavior: 'auto' }), 120);
    }
  } catch (e) { /* 忽略 */ }
}

tmdbWindow.saveTmdbScroll = saveTmdbScroll;

export const TMDB_CONFIG: TmdbConfig = {
  imageBase: 'https://image.tmdb.org/t/p',
  posterSize: 'w342',
  backdropSize: 'w780',
  language: 'zh-CN'
};

const SORT_OPTIONS: Record<string, SortOption[]> = {
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

const LANGUAGES: SelectOption[] = [
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

const COUNTRIES: SelectOption[] = [
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

const TV_STATUSES: SelectOption[] = [
  { value: '', label: '全部状态' },
  { value: '0', label: '已播完' },
  { value: '1', label: '拍摄中' },
  { value: '2', label: '计划中' },
  { value: '3', label: '即将开播' },
  { value: '4', label: '连载中' },
  { value: '5', label: '暂停播出' }
];

function getYears(): SelectOption[] {
  const current = new Date().getFullYear();
  const years: SelectOption[] = [{ value: '', label: '全部年份' }];
  for (let y = current; y >= 1990; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  years.push({ value: '1980s', label: '1980年代' });
  years.push({ value: '1970s', label: '1970年代' });
  years.push({ value: '1960s', label: '更早' });
  return years;
}

function isMovieLike(type: string): boolean {
  return type === 'movie';
}

function getEffectiveType(type: string): string {
  if (type === 'anime') return 'tv';
  if (type === 'variety') return 'tv';
  return type;
}

function getTmdbBaseUrl(): string {
  if (typeof TMDB_WORKER_URL !== 'undefined' && TMDB_WORKER_URL) {
    return TMDB_WORKER_URL;
  }
  return '/api/tmdb';
}

export async function tmdbFetch(endpoint: string, params: Record<string, string> = {}): Promise<TmdbResponse> {
  params.endpoint = endpoint;
  const query = new URLSearchParams(params).toString();
  const url = `${getTmdbBaseUrl()}?${query}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB 请求失败: ${res.status}`);
  return res.json() as Promise<TmdbResponse>;
}

export function initTmdbCategory(): void {
  // 恢复本会话保存的筛选/页码状态（若有），返回播放页或刷新后自动保持浏览状态
  const hadSavedState = restoreTmdbState();

  if (TMDB_STATE.isLoaded) {
    // 本会话已加载过，直接恢复滚动位置
    restoreTmdbScroll();
    return;
  }
  TMDB_STATE.isLoaded = true;
  if (!hadSavedState) {
    // 无保存状态（首次访问）才重置为默认，否则保留恢复的筛选条件
    resetTmdbFilters();
  }
  renderTmdbFilters();
  loadTmdbResults();
}

// 判断是否为手机横屏（窄高横向视口）
function isMobileLandscape(): boolean {
  try {
    return window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
  } catch (e) {
    return false;
  }
}

function resetTmdbFilters(): void {
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

function renderYearFilter(): string {
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
        <button class="tmdb-genre-btn year-toggle-btn" data-year-toggle title="${expanded ? '收起多余的年份标签' : '展开全部年份标签'}">
          ${expanded ? '收起' : '更多年份'}
        </button>
      ` : ''}
    </div>
  `;
}

function renderTmdbFilters(): void {
  const container = document.getElementById('tmdb-filters');
  if (!container) return;

  // 首次渲染时按是否手机横屏决定默认折叠（null = 未初始化）
  if (TMDB_STATE._filtersCollapsed === null) {
    TMDB_STATE._filtersCollapsed = isMobileLandscape();
  }

  const type = TMDB_STATE.type;
  const isMovie = isMovieLike(type);
  const genres = GENRE_MAP[getEffectiveType(type)];
  const sortOptions = SORT_OPTIONS[type];

  container.innerHTML = `
    <div class="tmdb-filter-section${TMDB_STATE._filtersCollapsed ? ' tmdb-filter-collapsed' : ''}">
      <div class="tmdb-filter-row tmdb-type-row">
        <div class="tmdb-type-switch">
          <button class="tmdb-type-btn${type === 'movie' ? ' active' : ''}" data-type="movie">电影</button>
          <button class="tmdb-type-btn${type === 'tv' ? ' active' : ''}" data-type="tv">电视剧</button>
          <button class="tmdb-type-btn${type === 'anime' ? ' active' : ''}" data-type="anime">动漫</button>
          <button class="tmdb-type-btn${type === 'variety' ? ' active' : ''}" data-type="variety">综艺</button>
        </div>
        <button class="tmdb-filter-collapse-btn${TMDB_STATE._filtersCollapsed ? ' collapsed' : ''}" data-filter-toggle aria-label="${TMDB_STATE._filtersCollapsed ? '展开全部筛选条件' : '收起全部筛选条件'}" aria-expanded="${!TMDB_STATE._filtersCollapsed}" title="${TMDB_STATE._filtersCollapsed ? '展开全部筛选条件' : '收起全部筛选条件'}">
          <svg viewBox="0 0 24 24" fill="currentColor" class="tmdb-filter-btn-icon" aria-hidden="true"><path d="M0 4a2 2 0 0 1 2-2h20a2 2 0 0 1 1.386 3.414L15 13v6.5a1.5 1.5 0 0 1-2.2 1.32l-2-1.2A1.5 1.5 0 0 1 10 18.5V13L.614 5.414A2 2 0 0 1 0 4Z"/></svg>
        </button>
      </div>

      <div class="tmdb-filter-row tmdb-genre-row">
        <div class="tmdb-genre-list${!TMDB_STATE._genreExpanded && GENRE_MAP[getEffectiveType(type)].length > 8 ? ' genre-filter-collapsed' : ''}">
          <button class="tmdb-genre-btn${!TMDB_STATE.selectedGenre ? ' active' : ''}" data-genre="">全部</button>
          ${genres.map((g, i) => `
            <button class="tmdb-genre-btn${TMDB_STATE.selectedGenre === g.id ? ' active' : ''}${i >= 8 ? ' genre-btn-extra' : ''}" data-genre="${g.id}">${g.name}</button>
          `).join('')}
          ${GENRE_MAP[getEffectiveType(type)].length > 8 ? `
            <button class="tmdb-genre-btn genre-toggle-btn" data-genre-toggle title="${TMDB_STATE._genreExpanded ? '收起多余的类型标签' : '展开全部类型标签'}">
              ${TMDB_STATE._genreExpanded ? '收起' : '更多类型'}
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
  bindFilterToggle();
  bindFilterTags();
}

function bindTypeSwitch(): void {
  document.querySelectorAll<HTMLElement>('.tmdb-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (!type || type === TMDB_STATE.type) return;
      TMDB_STATE.type = type;
      resetTmdbFilters();
      renderTmdbFilters();
      loadTmdbResults();
      saveTmdbState();
    });
  });
}

// 筛选区整体折叠按钮（漏斗图标）：独立绑定在按钮自身上，
// 只切换 _filtersCollapsed（隐藏/显示整块标签行），与下面各标签行的
// 「更多类型…/收起类型」「更多年份…/收起年份」互不干涉。
function bindFilterToggle(): void {
  const btn = document.querySelector('.tmdb-filter-collapse-btn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    TMDB_STATE._filtersCollapsed = !TMDB_STATE._filtersCollapsed;
    renderTmdbFilters();
  });
}

function bindFilterTags(): void {
  const section = document.querySelector('.tmdb-filter-section');
  if (!section) return;

  section.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tmdb-genre-btn') as HTMLElement | null;
    if (!btn) return;

    if (btn.hasAttribute('data-type')) return;

    if (btn.hasAttribute('data-genre')) {
      const genre = btn.dataset.genre ? Number(btn.dataset.genre) : null;
      if (genre === TMDB_STATE.selectedGenre) return;
      TMDB_STATE.selectedGenre = genre;
    } else if (btn.hasAttribute('data-country')) {
      // 空字符串代表「全部地区」，必须允许清空
      const country = btn.dataset.country || '';
      if (country === TMDB_STATE.originCountry) return;
      TMDB_STATE.originCountry = country;
    } else if (btn.hasAttribute('data-status')) {
      // 空字符串代表「全部状态」
      const status = btn.dataset.status || '';
      if (status === TMDB_STATE.tvStatus) return;
      TMDB_STATE.tvStatus = status;
    } else if (btn.hasAttribute('data-language')) {
      // 空字符串代表「全部语言」
      const language = btn.dataset.language || '';
      if (language === TMDB_STATE.originalLanguage) return;
      TMDB_STATE.originalLanguage = language;
    } else if (btn.hasAttribute('data-year-toggle')) {
      TMDB_STATE._yearExpanded = !TMDB_STATE._yearExpanded;
      renderTmdbFilters();
      return;
    } else if (btn.hasAttribute('data-genre-toggle')) {
      TMDB_STATE._genreExpanded = !TMDB_STATE._genreExpanded;
      renderTmdbFilters();
      return;
    } else if (btn.hasAttribute('data-year')) {
      // 空字符串代表「全部年份」
      const year = btn.dataset.year || '';
      if (year === TMDB_STATE.selectedYear) return;
      TMDB_STATE.selectedYear = year;
    } else if (btn.hasAttribute('data-rating')) {
      // 空字符串代表「全部评分」
      const rating = btn.dataset.rating || '';
      if (rating === TMDB_STATE.voteRating) return;
      TMDB_STATE.voteRating = rating;
    } else if (btn.hasAttribute('data-sort')) {
      const sort = btn.dataset.sort;
      if (!sort || sort === TMDB_STATE.selectedSort) return;
      TMDB_STATE.selectedSort = sort;
    } else {
      return;
    }

    TMDB_STATE.page = 1;
    renderTmdbFilters();
    loadTmdbResults();
    saveTmdbState();
  });
}

function toMediaCategory(type: string): MediaCategory {
  return type === 'tv' || type === 'anime' || type === 'variety' ? type : 'movie';
}

function toMediaSort(sort: string): MediaSort {
  if (sort === 'popularity.desc' || sort === 'vote_count.desc' || sort === 'revenue.desc') return 'popular';
  if (sort === 'vote_average.desc') return 'rating';
  if (sort === 'primary_release_date.desc' || sort === 'first_air_date.desc') return 'recent';
  return 'default';
}

export async function loadTmdbResults(): Promise<void> {
  if (TMDB_STATE.isLoading) return;
  TMDB_STATE.isLoading = true;

  const container = document.getElementById('tmdb-results');
  if (!container) {
    TMDB_STATE.isLoading = false;
    return;
  }

  // 加载中：与结果同形状的海报骨架
  container.innerHTML = typeof generateSkeletonCards === 'function'
    ? generateSkeletonCards(18)
    : '<div class="v2-state-inline"><span class="v2-spinner"></span>正在加载</div>';

  try {
    const category = toMediaCategory(TMDB_STATE.type);
    const genreMap = GENRE_MAP[getEffectiveType(TMDB_STATE.type)] || [];
    const selectedGenre = TMDB_STATE.selectedGenre
      ? genreMap.find(genre => genre.id === TMDB_STATE.selectedGenre)
      : undefined;
    const voteRating = Number(TMDB_STATE.voteRating);

    const result = await getMediaProvider().getList({
      type: category,
      page: TMDB_STATE.page,
      pageSize: 20,
      genre: selectedGenre ? selectedGenre.name : undefined,
      year: TMDB_STATE.selectedYear || undefined,
      region: TMDB_STATE.originCountry || undefined,
      minRating: Number.isFinite(voteRating) && voteRating > 0 ? voteRating : undefined,
      language: TMDB_STATE.originalLanguage || undefined,
      tvStatus: TMDB_STATE.tvStatus || undefined,
      sort: toMediaSort(TMDB_STATE.selectedSort),
    });

    // 豆瓣列表不返回总条数，只能根据 hasMore 推断下一页是否存在；
    // 页码 UI 至少保留当前页与可前进的一页。
    TMDB_STATE.totalPages = result.hasMore ? TMDB_STATE.page + 1 : TMDB_STATE.page;
    renderTmdbCards(result.items);
    renderTmdbPagination();
    // 从播放页返回时恢复之前浏览到的影片位置
    restoreTmdbScroll();
  } catch (err) {
    console.error('元数据加载失败:', err);
    const rawMessage = (err as { message?: unknown } | null)?.message;
    const safeMessage = String(rawMessage || '未知错误').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    container.innerHTML = `
      <div class="v2-state is-error">
        <span class="v2-state-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 8v4.5m0 3.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg></span>
        <h3>片单加载失败</h3>
        <p>${safeMessage}。请检查网络，或在设置中切换元数据源。</p>
        <button type="button" data-action="load-tmdb-results" class="v2-btn v2-btn--secondary v2-btn--sm">重试</button>
      </div>
    `;
  } finally {
    TMDB_STATE.isLoading = false;
  }
}

function renderTmdbCards(items: MediaItem[]): void {
  const container = document.getElementById('tmdb-results');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="v2-state">
        <span class="v2-state-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z"/></svg></span>
        <h3>没有符合条件的影片</h3>
        <p>放宽类型、地区或年份等筛选条件后再试。</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const category = toMediaCategory(TMDB_STATE.type);
  const genreMap = GENRE_MAP[getEffectiveType(TMDB_STATE.type)] || [];
  const safeAttr = (value: unknown): string => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  items.forEach(item => {
    const title = item.title || '';
    const year = item.year || '';
    const voteAverage = typeof item.rating === 'number' ? item.rating.toFixed(1) : 'N/A';
    const posterPath = item.poster || null;
    const overview = item.overview || '暂无简介';
    const genresList = (item.genreIds || [])
      .map(id => genreMap.find(genre => genre.id === id))
      .filter((genre): genre is GenreItem => Boolean(genre))
      .map(genre => genre.name)
      .slice(0, 2);

    const safeTitle = safeAttr(title);
    const safeOverview = safeAttr(overview);
    const safeGenres = safeAttr(genresList.join(','));
    const mediaCategory = item.category || category;

    const card = document.createElement('div');
    card.className = 'tmdb-card';

    const meta = [year, genresList.join(' / ')].filter(Boolean).join(' · ');
    // 片名首字占位垫在下面，封面到了再淡入覆盖
    const posterHtml = `<div class="v2-poster-empty"><b>${safeTitle.charAt(0) || '·'}</b><span>${safeTitle}</span></div>`
      + (posterPath ? `<img src="${safeAttr(posterPath)}" alt="" data-title="${safeTitle}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="_cardImgFallback(this)">` : '');
    const ratingHtml = typeof item.rating === 'number' && item.rating > 0
      ? `<span class="v2-badge">★ ${voteAverage}</span>`
      : '';
    const langLabel = item.originalLanguage
      ? LANGUAGES.find(language => language.value === item.originalLanguage)
      : undefined;
    const langHtml = langLabel ? `<span class="v2-lang">${safeAttr(langLabel.label)}</span>` : '';

    // 整张卡片是按钮：点击后按片名去各片源检索（沿用 data-action="tmdb-search-video"）；
    // 同时携带豆瓣/TMDB 的 sourceId，播放页详情补全时优先用它。
    card.innerHTML = `
      <button type="button" class="v2-pcard tmdb-card-inner" data-action="tmdb-search-video"
        data-title="${safeTitle}" data-genres="${safeGenres}"
        data-media-source="${safeAttr(item.source)}" data-media-id="${safeAttr(item.sourceId)}"
        data-media-type="${safeAttr(item.type)}" data-category="${safeAttr(mediaCategory)}"
        data-year="${safeAttr(year)}"
        aria-label="检索 ${safeTitle}" title="${safeOverview}">
        <div class="v2-poster">${posterHtml}${ratingHtml}${langHtml}</div>
        <h3>${safeTitle}</h3>
        <p>${meta || '&nbsp;'}</p>
      </button>
    `;

    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
}

function renderTmdbPagination(): void {
  const container = document.getElementById('tmdb-pagination');
  if (!container) return;

  if (TMDB_STATE.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const current = TMDB_STATE.page;
  const total = TMDB_STATE.totalPages;

  const getPageButtons = (): (number | string)[] => {
    const pages: number[] = [];
    const addPage = (n: number) => { if (!pages.includes(n) && n >= 1 && n <= total) pages.push(n); };

    addPage(1);
    addPage(current - 1);
    addPage(current);
    addPage(current + 1);
    addPage(total);

    pages.sort((a, b) => a - b);

    const result: (number | string)[] = [];
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
      <button class="tmdb-page-btn${current <= 1 ? ' disabled' : ''}" data-page="${current - 1}"${current <= 1 ? ' disabled' : ''} aria-label="上一页">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      ${getPageButtons().map(p => {
        if (p === 'ellipsis') return '<span class="tmdb-page-ellipsis">…</span>';
        return `<button class="tmdb-page-btn${p === current ? ' active' : ''}" data-page="${p}">${p}</button>`;
      }).join('')}
      <button class="tmdb-page-btn${current >= total ? ' disabled' : ''}" data-page="${current + 1}"${current >= total ? ' disabled' : ''} aria-label="下一页">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  `;

  container.querySelectorAll<HTMLElement>('.tmdb-page-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = Number(btn.dataset.page);
      if (page >= 1 && page <= total && page !== current) {
        TMDB_STATE.page = page;
        loadTmdbResults();
        saveTmdbState();
        const filtersEl = document.getElementById('tmdb-filters');
        if (filtersEl) {
          window.scrollTo({ top: filtersEl.offsetTop - 80, behavior: 'smooth' });
        }
      }
    });
  });
}

export function tmdbSearchVideo(
  title: string,
  genres: string,
  mediaSource?: string,
  mediaId?: string,
  mediaType?: string,
  category?: string,
  year?: string
): void {
  if (!title) return;

  // 分类页卡片携带豆瓣/TMDB 的 sourceId：暂存给播放页详情补全，避免只靠片名重新匹配
  if ((mediaSource === 'douban' || mediaSource === 'tmdb') && mediaId && (mediaType === 'movie' || mediaType === 'tv')) {
    saveLastPickedMedia({
      source: mediaSource,
      sourceId: mediaId,
      type: mediaType,
      category: toMediaCategory(category || mediaType),
      title,
      year: year || undefined,
    });
  }

  function open(): void {
    // 统一进入结果页：左侧源列表 + 右侧结果，携带类型信息用于「无关键词结果时的分类兜底」
    if (typeof openMoviesPage === 'function') {
      openMoviesPage(title, {
        from: 'category',
        fallbackGenres: genres ? String(genres).split(',').map(g => g.trim()).filter(Boolean) : []
      });
      return;
    }

    // 旧逻辑兜底（结果页模块未加载时）
    const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    switchPage('home');
    const input = document.getElementById('searchInput') as HTMLInputElement | null;
    if (input) {
      input.value = safeTitle;
      setTimeout(() => search(), 300);
    }
  }

  // 结果页片段按需加载：先补齐再进入，避免在空容器上渲染
  if (tmdbWindow.LeLePages && typeof tmdbWindow.LeLePages.ensure === 'function' && !tmdbWindow.LeLePages.isLoaded('movies')) {
    tmdbWindow.LeLePages.ensure('movies').then(open);
  } else {
    open();
  }
}

/** 首页「更多」入口：切到分类页并预置类型（电影 / 电视剧 / 动漫 / 综艺），筛选按该类型的默认值重置 */
export function openTmdbCategory(type: string): void {
  if (!SORT_OPTIONS[type]) type = 'movie';
  TMDB_STATE.type = type;
  resetTmdbFilters();
  TMDB_STATE.isLoaded = false;   // 分类页即使本会话打开过，也重新走一遍筛选渲染与加载
  saveTmdbState();
  try { sessionStorage.removeItem(TMDB_SCROLL_KEY); } catch (e) { /* 忽略 */ }
  if (typeof switchPage === 'function') switchPage('category');
}

function resetTmdbCategory(): void {
  TMDB_STATE.type = 'movie';
  TMDB_STATE.page = 1;
  TMDB_STATE.totalPages = 1;
  TMDB_STATE.isLoaded = false;
  TMDB_STATE.isLoading = false;
  resetTmdbFilters();
}

// 阶段 5A-2 过渡期兼容桥：未改造的全局脚本仍通过裸名 / window 访问这些符号。
// 5B 将所有引用方改为 import 后删除本段。
Object.assign(window, {
  TMDB_STATE,
  TMDB_CONFIG,
  GENRE_MAP,
  TMDB_STATE_KEY,
  initTmdbCategory,
  saveTmdbScroll,
  restoreTmdbState,
  tmdbSearchVideo,
  openTmdbCategory,
  loadTmdbResults,
  tmdbFetch,
});
