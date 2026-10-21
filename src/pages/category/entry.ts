/**
 * category 页按需 bundle 的 ESM 入口（阶段 5A-2 垂直试点）。
 *
 * 当前 category bundle 只承载 TMDB 分类页逻辑；后续按需模块从这里 import。
 * 过渡期由 src/services/tmdb.ts 末尾的 window 兼容桥保证未改造模块仍可访问。
 */
import '../../services/tmdb';
