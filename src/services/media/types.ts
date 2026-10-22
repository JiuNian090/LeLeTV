/**
 * 元数据统一层 — 归一化模型
 *
 * 豆瓣 / TMDB 的列表、搜索、详情都先转成这里的结构，页面只消费 MediaItem / MediaDetail。
 * 播放源（采集站）不在这套模型里：元数据源只负责标题、简介、演员、封面等展示信息。
 */

/** 单条影视的媒体类型（豆瓣/TMDB 只有电影和剧集两种底层类型） */
export type MediaType = 'movie' | 'tv';

/** 本站分类页的四类入口；豆瓣/TMDB 会把 anime/variety 映射到各自的 tv 子类 */
export type MediaCategory = 'movie' | 'tv' | 'anime' | 'variety';

/** 元数据来源 */
export type SourceId = 'douban' | 'tmdb';

/** 分类页排序；具体 provider 只实现自己能支持的子集 */
export type MediaSort = 'default' | 'popular' | 'rating' | 'recent';

/** 列表项：详情页/播放页只需要这一层就能渲染卡片 */
export interface MediaItem {
  source: SourceId;
  /** 豆瓣 ID 或 TMDB ID（字符串化） */
  sourceId: string;
  /** 豆瓣条目若已知对应 TMDB ID 时填充；当前播放匹配不依赖它 */
  tmdbId?: number;
  type: MediaType;
  /** 分类入口（movie/tv/anime/variety）；列表 provider 应原样带回 */
  category?: MediaCategory;
  title: string;
  originalTitle?: string;
  year?: string;
  poster?: string;
  rating?: number;
  overview?: string;
  /** TMDB 列表返回的类型 ID；豆瓣列表没有，分类页按需用它补「类型」文案 */
  genreIds?: number[];
  /** TMDB 原始语言代码；豆瓣列表没有 */
  originalLanguage?: string;
}

/** 演职员条目：豆瓣详情给姓名，credits 可补角色名与头像 */
export interface MediaCredit {
  name: string;
  role?: string;
  avatar?: string;
}

/** 详情：在列表项基础上补简介、类型、导演、演员、地区等 */
export interface MediaDetail extends MediaItem {
  summary: string;
  genres: string[];
  directors: string[];
  casts: string[];
  credits?: MediaCredit[];
  countries?: string[];
  languages?: string[];
  runtime?: string;
  releaseDates?: string[];
  backdrop?: string;
}

/** 分类标签（豆瓣的 tag / TMDB 的类型） */
export interface MediaTag {
  id: string;
  name: string;
}

/** 分类列表参数 */
export interface MediaListParams {
  type: MediaCategory;
  page: number;
  pageSize?: number;
  /** 豆瓣原始标签（如「热门」「美剧」）；为空时由 provider 决定默认值 */
  tag?: string;
  /** 类型名（如「动作」「喜剧」） */
  genre?: string;
  /** 年份（如「2024」）；年代标签由 provider 自行决定是否支持 */
  year?: string;
  /** 地区（如「中国大陆」「美国」） */
  region?: string;
  /** 评分下限（0–10） */
  minRating?: number;
  /** 原始语言代码（TMDB），豆瓣不支持时由 provider 抛错降级 */
  language?: string;
  /** 剧集状态（TMDB），豆瓣不支持时由 provider 抛错降级 */
  tvStatus?: string;
  sort?: MediaSort;
}

/**
 * 列表结果。
 *
 * 方案文档的接口只返回 MediaItem[]；豆瓣的 new_search_subjects 不返回总条数，
 * 为了分类页能正确显示「还有下一页」，这里额外带回 hasMore。
 */
export interface MediaListResult {
  items: MediaItem[];
  hasMore: boolean;
}

/** 搜索参数 */
export interface MediaSearchParams {
  keyword: string;
  type: MediaType;
  page?: number;
}

/** 元数据 provider 的统一接口 */
export interface MediaProvider {
  readonly source: SourceId;
  getTags(type: MediaType): Promise<MediaTag[]>;
  getList(params: MediaListParams): Promise<MediaListResult>;
  search(params: MediaSearchParams): Promise<MediaItem[]>;
  getDetail(item: MediaItem): Promise<MediaDetail>;
}
