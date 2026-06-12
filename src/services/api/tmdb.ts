/**
 * TMDB 分类浏览服务层
 *
 * 提供 TMDB 数据获取和状态管理，不包含 DOM 操作。
 * UI 渲染部分在 js/api/tmdb.js（Step 6 迁移到 src/ui/）
 */

import { getTmdbWorkerUrl } from './api-config';

// ==================== 类型定义 ====================

export interface GenreItem {
  id: number;
  name: string;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface TmdbState {
  type: 'movie' | 'tv' | 'anime' | 'variety';
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
}

export interface TmdbConfig {
  imageBase: string;
  posterSize: string;
  backdropSize: string;
  language: string;
}

export interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  first_air_date?: string;
  release_date?: string;
  genre_ids?: number[];
  media_type?: string;
  [key: string]: unknown;
}

export interface TmdbResponse {
  page: number;
  results: TmdbResult[];
  total_pages: number;
  total_results: number;
}

// ==================== 数据配置 ====================

export const TMDB_CONFIG: TmdbConfig = {
  imageBase: 'https://image.tmdb.org/t/p',
  posterSize: 'w342',
  backdropSize: 'w780',
  language: 'zh-CN',
};

export const GENRE_MAP: Record<string, GenreItem[]> = {
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
    { id: 37, name: '西部' },
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
    { id: 37, name: '西部' },
  ],
};

export const SORT_OPTIONS: Record<string, SortOption[]> = {
  movie: [
    { value: 'primary_release_date.desc', label: '最近上映' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'revenue.desc', label: '最高票房' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'title.asc', label: '名称A-Z' },
    { value: 'title.desc', label: '名称Z-A' },
    { value: 'original_title.asc', label: '原名A-Z' },
  ],
  tv: [
    { value: 'first_air_date.desc', label: '最近开播' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'name.asc', label: '名称A-Z' },
    { value: 'name.desc', label: '名称Z-A' },
  ],
  anime: [
    { value: 'first_air_date.desc', label: '最近开播' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'name.asc', label: '名称A-Z' },
    { value: 'name.desc', label: '名称Z-A' },
  ],
  variety: [
    { value: 'first_air_date.desc', label: '最近开播' },
    { value: 'popularity.desc', label: '最热门' },
    { value: 'vote_average.desc', label: '评分最高' },
    { value: 'vote_count.desc', label: '评价最多' },
    { value: 'name.asc', label: '名称A-Z' },
    { value: 'name.desc', label: '名称Z-A' },
  ],
};

export const YEAR_OPTIONS: string[] = (() => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear; y >= 1970; y--) {
    years.push(String(y));
  }
  return years;
})();

export const TV_STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'Returning Series', label: '连载中' },
  { value: 'Ended', label: '已完结' },
  { value: 'Canceled', label: '已取消' },
];

// ==================== 状态管理 ====================

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
};

// ==================== 数据获取 ====================

/**
 * 构建 TMDB 查询参数
 */
function buildTmdbParams(): Record<string, string> {
  const params: Record<string, string> = {
    page: String(TMDB_STATE.page),
    sort_by: TMDB_STATE.selectedSort,
    language: TMDB_CONFIG.language,
  };

  if (TMDB_STATE.selectedGenre) {
    params.with_genres = String(TMDB_STATE.selectedGenre);
  }

  // 年份/日期过滤
  if (TMDB_STATE.selectedYear) {
    if (TMDB_STATE.type === 'movie') {
      params.primary_release_year = TMDB_STATE.selectedYear;
    } else {
      params.first_air_date_year = TMDB_STATE.selectedYear;
    }
  }

  // 评分过滤
  if (TMDB_STATE.voteRating) {
    params['vote_average.gte'] = TMDB_STATE.voteRating;
  }

  // 语言过滤
  if (TMDB_STATE.originalLanguage) {
    params.with_original_language = TMDB_STATE.originalLanguage;
  }

  // 地区过滤
  if (TMDB_STATE.originCountry) {
    params.with_origin_country = TMDB_STATE.originCountry;
  }

  // TV 状态过滤
  if (TMDB_STATE.tvStatus && TMDB_STATE.type === 'tv') {
    params.with_status = TMDB_STATE.tvStatus;
  }

  // 动漫专用过滤
  if (TMDB_STATE.type === 'anime') {
    params.with_genres = '16'; // 动画类型
    params.with_original_language = 'ja';
  }

  // 综艺专用过滤
  if (TMDB_STATE.type === 'variety') {
    params.with_genres = '10764'; // 真人秀类型
  }

  return params;
}

/**
 * 获取 TMDB 发现列表
 */
export async function fetchTmdbDiscover(): Promise<TmdbResponse | null> {
  TMDB_STATE.isLoading = true;

  try {
    const tmdbWorkerUrl = getTmdbWorkerUrl();
    if (!tmdbWorkerUrl) {
      console.warn('TMDB Worker URL 未配置');
      TMDB_STATE.isLoading = false;
      return null;
    }

    const params = buildTmdbParams();
    const endpoint = TMDB_STATE.type === 'movie' ? 'discover/movie' : 'discover/tv';
    const queryString = new URLSearchParams(params).toString();
    const url = `${tmdbWorkerUrl}/3/${endpoint}?${queryString}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB 请求失败: ${response.status}`);
    }

    const data: TmdbResponse = await response.json();
    TMDB_STATE.totalPages = Math.min(data.total_pages, 500);
    TMDB_STATE.isLoaded = true;
    TMDB_STATE.isLoading = false;

    return data;
  } catch (error) {
    console.error('TMDB 发现列表获取失败:', error);
    TMDB_STATE.isLoading = false;
    return null;
  }
}

/**
 * 重置 TMDB 状态到初始值
 */
export function resetTmdbState(): void {
  TMDB_STATE.page = 1;
  TMDB_STATE.totalPages = 1;
  TMDB_STATE.selectedGenre = null;
  TMDB_STATE.selectedYear = '';
  TMDB_STATE.selectedSort = 'primary_release_date.desc';
  TMDB_STATE.voteRating = '';
  TMDB_STATE.originalLanguage = '';
  TMDB_STATE.originCountry = '';
  TMDB_STATE.tvStatus = '';
  TMDB_STATE.isLoaded = false;
  TMDB_STATE._genreExpanded = false;
}
