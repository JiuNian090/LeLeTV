/**
 * 播放页「相关推荐」数据。
 *
 * 只从当前播放源里找可播放的条目，按与当前影片的关系排序：
 *   1. 同一系列的其他季 / 续集（「庆余年 第二季」「流浪地球2」）
 *   2. 同名同源的不同条目（其它版本）
 *   3. 同类型（采集站的 type_name 与当前影片类型相同）
 *
 * 优先复用搜索页留在 sessionStorage 的结果快照，避免播放页再发一次搜索；
 * 快照不够时再按片名搜索，仍不够再按分类补一批同类型条目。
 */

import { searchByAPIAndKeyWord, searchByCategory } from './search';

const SEARCH_CACHE_KEY = 'leletv_search_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
const RESULT_LIMIT = 20;
const MIN_BEFORE_TYPE_FILL = 8;

interface RawRelatedItem {
  [key: string]: unknown;
  vod_id?: string | number;
  vod_name?: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_year?: string;
  type_name?: string;
  source_code?: string;
}

export interface RelatedVideoContext {
  title: string;
  sourceCode: string;
  vodId?: string;
  type?: string;
  year?: string;
}

export interface RelatedVideo {
  id: string;
  title: string;
  cover: string;
  sourceCode: string;
  typeName: string;
  year: string;
  remarks: string;
}

const CN_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9
};

function cnNumber(value: string): number {
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const tenAt = value.indexOf('十');
  if (tenAt < 0) return CN_DIGITS[value] || 0;
  const tens = tenAt === 0 ? 1 : (CN_DIGITS[value[0]] || 0);
  const ones = tenAt === value.length - 1 ? 0 : (CN_DIGITS[value[value.length - 1]] || 0);
  return tens * 10 + ones;
}

/** 去掉空白、标点、别名后的片名，用于判断「是不是同一部」 */
function normTitle(name: unknown): string {
  return String(name || '').split('$')[0].toLowerCase()
    .replace(/[（(【\[][^）)】\]]*[）)】\]]\s*$/, '')
    .replace(/[\s　·•・:：,，.。!！?？'"“”‘’()（）【】\[\]《》<>\-—_~～]/g, '');
}

/** 卡片上显示的片名：站点常把别名接在后面（「片名$别名」） */
function displayName(name: unknown): string {
  return String(name || '').split('$')[0].trim();
}

/** 片名里的季 / 部序号：「第二季 / 第2部 / S2 / Season 2」 */
function seasonInfo(name: string): { base: string; season: number | null } {
  const cn = name.match(/第\s*([0-9一二三四五六七八九十两]+)\s*[季部]/);
  if (cn) {
    return { base: name.replace(cn[0], ' ').replace(/\s+/g, ' ').trim(), season: cnNumber(cn[1]) };
  }
  const en = name.match(/(?:^|[\s\-_·])S(\d{1,2})(?=$|[\s\-_·])/i) || name.match(/season\s*(\d{1,2})/i);
  if (en) {
    return { base: name.replace(en[0], ' ').replace(/\s+/g, ' ').trim(), season: parseInt(en[1], 10) };
  }
  return { base: name, season: null };
}

/** 系列名：剧集去掉季序，电影去掉结尾 1–3 位的续集序号（「流浪地球2」→「流浪地球」） */
function seriesBase(name: string): string {
  const info = seasonInfo(name);
  if (info.season != null) return info.base;
  const stripped = name.replace(/[\s:：·\-—_]*[0-9一二三四五六七八九十]{1,3}$/, '').trim();
  return stripped.length >= 2 ? stripped : name;
}

function typeTokens(value: unknown): string[] {
  return String(value || '').split(/[\/,，、|·;；\s]+/).map(token => token.trim()).filter(Boolean);
}

function typeMatches(itemType: unknown, wantType: unknown): boolean {
  const want = typeTokens(wantType);
  if (!want.length) return false;
  const have = typeTokens(itemType);
  return have.some(h => want.some(w => h === w || h.indexOf(w) >= 0 || w.indexOf(h) >= 0));
}

/** 预告、花絮、解说这类条目不算推荐 */
const SKIP_NAME = /预告|花絮|特辑|解说|混剪|片段|专访|reaction/i;

function scoreOf(item: RawRelatedItem, ctx: RelatedVideoContext): number {
  const name = displayName(item.vod_name);
  const currentName = String(ctx.title || '').trim();
  if (!name || !currentName || SKIP_NAME.test(name)) return 0;

  const nameNorm = normTitle(name);
  const currentNorm = normTitle(currentName);
  const seriesNorm = normTitle(seriesBase(currentName));
  const itemSeriesNorm = normTitle(seriesBase(name));
  if (!nameNorm || !seriesNorm) return 0;

  if (itemSeriesNorm === seriesNorm) {
    if (nameNorm === currentNorm) return 80; // 同一部片的其它条目
    const currentSeason = seasonInfo(currentName).season;
    const itemSeason = seasonInfo(name).season;
    if (itemSeason != null && currentSeason != null && itemSeason !== currentSeason) return 100; // 其他季
    return 90; // 同系列续集 / 衍生
  }
  if (nameNorm === currentNorm) return 80;
  if (seriesNorm.length >= 2 && nameNorm.indexOf(seriesNorm) === 0) return 70;
  if (typeMatches(item.type_name, ctx.type)) return 60;
  return 0;
}

function isCurrent(item: RawRelatedItem, ctx: RelatedVideoContext): boolean {
  if (!ctx.vodId || String(item.vod_id == null ? '' : item.vod_id) !== String(ctx.vodId)) return false;
  return !item.source_code || !ctx.sourceCode || item.source_code === ctx.sourceCode;
}

function toVideo(item: RawRelatedItem, fallbackSource: string): RelatedVideo | null {
  const id = String(item.vod_id == null ? '' : item.vod_id);
  const title = displayName(item.vod_name);
  if (!id || !title) return null;
  const pic = typeof item.vod_pic === 'string' ? item.vod_pic.trim() : '';
  return {
    id,
    title,
    cover: /^https?:\/\//i.test(pic) ? pic : '',
    sourceCode: String(item.source_code || fallbackSource),
    typeName: String(item.type_name || '').trim(),
    year: String(item.vod_year || '').trim(),
    remarks: String(item.vod_remarks || '').replace(/<[^>]+>/g, '').trim()
  };
}

function rank(raw: RawRelatedItem[], ctx: RelatedVideoContext): RelatedVideo[] {
  const seen = new Set<string>();
  const scored: { video: RelatedVideo; score: number }[] = [];
  // 直链播放没有 vod_id：同源同名只剩一条时，它就是当前片，不推荐自己
  const currentNorm = normTitle(ctx.title);
  const sameNameCount = raw.filter(item => item.vod_id
    && normTitle(displayName(item.vod_name)) === currentNorm).length;
  const skipSelfByName = !ctx.vodId && sameNameCount === 1;

  raw.forEach(item => {
    if (isCurrent(item, ctx)) return;
    const name = displayName(item.vod_name);
    if (skipSelfByName && normTitle(name) === currentNorm) return;
    const score = scoreOf(item, ctx);
    if (score <= 0) return;
    const video = toVideo(item, ctx.sourceCode);
    if (!video) return;
    const key = video.sourceCode + '|' + video.id;
    if (seen.has(key)) return;
    seen.add(key);
    scored.push({ video, score });
  });
  // sort 是稳定的：同分保持搜索结果的原始顺序
  scored.sort((a, b) => b.score - a.score);
  return scored.map(entry => entry.video);
}

/** 搜索页缓存的快照，只取当前源的结果 */
function cachedSearchResults(sourceCode: string): RawRelatedItem[] {
  try {
    const payload = JSON.parse(sessionStorage.getItem(SEARCH_CACHE_KEY) || 'null') as { results?: unknown } | null;
    if (!payload || !Array.isArray(payload.results)) return [];
    return (payload.results as RawRelatedItem[]).filter(item => item && item.source_code === sourceCode);
  } catch (e) {
    return [];
  }
}

/** 按同源分类补一批同类型条目：先试原始分类名，没有再试「动作片」这种写法 */
async function fetchByType(sourceCode: string, type: string): Promise<RawRelatedItem[]> {
  const first = typeTokens(type)[0];
  if (!first) return [];
  const classes = [first];
  if (!/[片剧]$/.test(first)) classes.push(first + '片');
  for (const className of classes) {
    const list = await searchByCategory(sourceCode, className, 1);
    if (list.length) return list as RawRelatedItem[];
  }
  return [];
}

const resultCache = new Map<string, { items: RelatedVideo[]; time: number }>();
const pending = new Map<string, Promise<RelatedVideo[]>>();

async function collect(ctx: RelatedVideoContext): Promise<RelatedVideo[]> {
  const sourceCode = String(ctx.sourceCode || '').trim();
  const title = String(ctx.title || '').trim();
  const pool: RawRelatedItem[] = cachedSearchResults(sourceCode);
  let ranked = rank(pool, ctx);

  if (ranked.length < MIN_BEFORE_TYPE_FILL) {
    const keyword = seriesBase(title) || title;
    const found = await searchByAPIAndKeyWord(sourceCode, keyword);
    pool.push(...(found as RawRelatedItem[]));
    ranked = rank(pool, ctx);
  }

  if (ranked.length < MIN_BEFORE_TYPE_FILL && ctx.type) {
    const byType = await fetchByType(sourceCode, ctx.type);
    pool.push(...byType);
    ranked = rank(pool, ctx);
  }

  return ranked.slice(0, RESULT_LIMIT);
}

/** 加载相关推荐；同一部片 + 同一源在 10 分钟内复用结果 */
export function loadRelatedVideos(ctx: RelatedVideoContext): Promise<RelatedVideo[]> {
  const sourceCode = String(ctx.sourceCode || '').trim();
  const title = String(ctx.title || '').trim();
  if (!sourceCode || !title) return Promise.resolve([]);

  const key = [sourceCode, ctx.vodId || '', title, ctx.type || ''].join('|');
  const hit = resultCache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) return Promise.resolve(hit.items);

  const running = pending.get(key);
  if (running) return running;

  const task = collect({ ...ctx, sourceCode, title })
    .then(items => {
      resultCache.set(key, { items, time: Date.now() });
      return items;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, task);
  return task;
}
