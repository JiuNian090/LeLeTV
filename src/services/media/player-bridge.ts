/**
 * 播放页元数据补全桥（services → UI）
 *
 * UI 层不能 import services，因此由 player bundle 导入本模块，
 * 把 enrich 挂到 window；detail.ts 只通过 window 调用。
 *
 * 播放数据仍来自采集站；这里只补展示字段：简介、主演、导演、年份、地区、类型、封面。
 */

import { getMediaProvider } from './index';
import { loadLastPickedMedia } from './context';
import type { MediaDetail, MediaItem, MediaType } from './types';

export interface PlayerEnrichmentInput {
  title: string;
  info: Record<string, unknown>;
  episodeCount: number;
}

function normalizeTitle(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s　·•・:：,，.。!！?？'"“”‘’()（）【】\[\]《》<>—~～]/g, '');
}

function guessMediaType(info: Record<string, unknown>, episodeCount: number): MediaType {
  const typeText = String(info.type || '');
  if (episodeCount > 1 || /剧|动漫|综艺|电视|纪录/.test(typeText)) return 'tv';
  return 'movie';
}

function matchMediaItem(candidates: MediaItem[], title: string, year: string): MediaItem | null {
  const want = normalizeTitle(title);
  if (!want) return null;

  const exact = candidates.filter(candidate => normalizeTitle(candidate.title) === want);
  if (exact.length) {
    const withYear = exact.find(candidate => !year || !candidate.year || candidate.year === year);
    return withYear || exact[0];
  }

  // 豆瓣标题可能带副标题/季数；只在唯一候选时接受前缀匹配，避免补错片
  const loose = candidates.filter(candidate => {
    const value = normalizeTitle(candidate.title);
    return value.startsWith(want) || want.startsWith(value);
  });
  return loose.length === 1 ? loose[0] : null;
}

/** 返回合并后的 currentVideoInfo；失败返回 null，由 UI 保留采集站信息 */
export async function enrichPlayerVideoInfo(input: PlayerEnrichmentInput): Promise<Record<string, unknown> | null> {
  const title = String(input.title || '').trim();
  if (!title || title === '未知视频') return null;

  const info: Record<string, unknown> = input.info || {};
  if (info.mediaSource === 'douban' || info.mediaSource === 'tmdb') return null;

  const year = info.year ? String(info.year) : '';
  const last = loadLastPickedMedia();
  const picked = last
    && normalizeTitle(last.title) === normalizeTitle(title)
    && (!last.year || !year || last.year === year)
    ? last
    : null;

  const type: MediaType = picked ? picked.type : guessMediaType(info, input.episodeCount);

  try {
    const provider = getMediaProvider();
    let detail: MediaDetail | null = null;

    if (picked) {
      detail = await provider.getDetail({
        source: picked.source,
        sourceId: picked.sourceId,
        type: picked.type,
        category: picked.category || picked.type,
        title: picked.title,
        year: picked.year,
      });
    } else {
      const candidates = await provider.search({ keyword: title, type, page: 1 });
      const match = matchMediaItem(candidates, title, year);
      if (match) detail = await provider.getDetail(match);
    }

    if (!detail) return null;

    const merged: Record<string, unknown> = { ...info };
    if (detail.summary) merged.desc = detail.summary;
    if (detail.casts.length) merged.actor = detail.casts.join(' / ');
    if (detail.directors.length) merged.director = detail.directors.join(' / ');
    if (detail.year) merged.year = detail.year;
    if (detail.countries && detail.countries.length) merged.area = detail.countries.join(' / ');
    if (detail.genres.length) merged.type = detail.genres.join(' / ');
    if (detail.poster) merged.cover = detail.poster;
    merged.mediaSource = detail.source;
    return merged;
  } catch (e) {
    console.warn('[LeLeTV] 元数据补全失败，保留采集站详情:', e);
    return null;
  }
}

interface MediaPlayerBridgeWindow extends Window {
  LeLeMediaPlayer?: {
    enrich: (input: PlayerEnrichmentInput) => Promise<Record<string, unknown> | null>;
  };
}

(window as MediaPlayerBridgeWindow).LeLeMediaPlayer = {
  enrich: enrichPlayerVideoInfo,
};
