/**
 * TMDB 类型 ID → 中文名。
 *
 * 放在 core：分类页、services/tmdb 与 services/media/tmdb 都要用，
 * 放在 services/tmdb.ts 会让 media provider 反向依赖 tmdb.ts，形成循环。
 */

export interface GenreItem {
  id: number;
  name: string;
}

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
