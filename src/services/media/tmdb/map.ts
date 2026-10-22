/**
 * TMDB 字段 → MediaItem / MediaDetail
 */

import type { MediaCategory, MediaDetail, MediaItem, MediaType } from '../types';
import type { TmdbDetailRaw, TmdbRawItem } from './client';

export const TMDB_SOURCE = 'tmdb' as const;

// 与 services/tmdb.ts 的 TMDB_CONFIG 保持一致；这里独立定义以避免
// tmdb.ts → media → tmdb.map 的循环依赖。
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const POSTER_SIZE = 'w342';
const BACKDROP_SIZE = 'w780';

function imageUrl(path: string | undefined, size: string): string | undefined {
  if (!path) return undefined;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

function yearOf(date: string | undefined): string | undefined {
  return date ? String(date).slice(0, 4) : undefined;
}

export function categoryType(type: MediaCategory): MediaType {
  return type === 'movie' ? 'movie' : 'tv';
}

export function mapTmdbItem(raw: TmdbRawItem, category: MediaCategory): MediaItem {
  const type = categoryType(category);
  return {
    source: TMDB_SOURCE,
    sourceId: raw.id === undefined ? '' : String(raw.id),
    type,
    category,
    title: String(raw.title || raw.name || '').trim(),
    originalTitle: raw.original_title || raw.original_name || undefined,
    year: yearOf(raw.release_date || raw.first_air_date),
    poster: imageUrl(raw.poster_path, POSTER_SIZE),
    rating: typeof raw.vote_average === 'number' && raw.vote_average > 0 ? raw.vote_average : undefined,
    overview: raw.overview || undefined,
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids : undefined,
    originalLanguage: raw.original_language || undefined,
  };
}

export function mapTmdbDetail(raw: TmdbDetailRaw, item: MediaItem): MediaDetail {
  const type = item.type;
  const credits = raw.credits;
  const cast = (credits && credits.cast ? credits.cast : [])
    .map(person => String(person.name || '').trim())
    .filter(Boolean);
  const directors = (credits && credits.crew ? credits.crew : [])
    .filter(person => person.job === 'Director')
    .map(person => String(person.name || '').trim())
    .filter(Boolean);

  const genres = (raw.genres || []).map(g => String(g.name || '').trim()).filter(Boolean);
  const countries = (raw.production_countries || [])
    .map(c => String(c.name || '').trim()).filter(Boolean);
  const languages = (raw.spoken_languages || [])
    .map(l => String(l.name || '').trim()).filter(Boolean);

  const runtime = type === 'movie'
    ? (typeof raw.runtime === 'number' && raw.runtime > 0 ? `${raw.runtime}分钟` : undefined)
    : (Array.isArray(raw.episode_run_time) && raw.episode_run_time[0] > 0
      ? `${raw.episode_run_time[0]}分钟`
      : undefined);

  const releaseDate = raw.release_date || raw.first_air_date;

  return {
    ...item,
    sourceId: raw.id === undefined ? item.sourceId : String(raw.id),
    title: String(raw.title || raw.name || item.title).trim(),
    originalTitle: raw.original_title || raw.original_name || item.originalTitle,
    year: yearOf(releaseDate) || item.year,
    poster: imageUrl(raw.poster_path, POSTER_SIZE) || item.poster,
    backdrop: imageUrl(raw.backdrop_path, BACKDROP_SIZE),
    rating: typeof raw.vote_average === 'number' && raw.vote_average > 0 ? raw.vote_average : item.rating,
    summary: String(raw.overview || '').trim(),
    genres,
    directors: Array.from(new Set(directors)),
    casts: Array.from(new Set(cast)).slice(0, 20),
    credits: cast.length
      ? cast.slice(0, 20).map(name => ({ name }))
      : undefined,
    countries: countries.length ? countries : (raw.origin_country && raw.origin_country.length ? raw.origin_country : undefined),
    languages: languages.length ? languages : undefined,
    runtime,
    releaseDates: releaseDate ? [releaseDate] : undefined,
  };
}
