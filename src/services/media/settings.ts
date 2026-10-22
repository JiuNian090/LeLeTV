/**
 * 元数据源设置（主源 / 自动降级）
 *
 * 存 localStorage，与播放源设置分开。元数据源是全局行为，不随私密模式切换，
 * 因此不使用 core/state 的 scopedKey。
 */

import type { SourceId } from './types';

export interface MediaSettings {
  /** 主数据源 */
  primarySource: SourceId;
  /** 主源失败时是否自动切到另一个源 */
  autoFailover: boolean;
}

export const MEDIA_SETTINGS_KEY = 'leletv:media:settings';
export const MEDIA_SETTINGS_CHANGED_EVENT = 'leletv:media-settings-changed';

export const DEFAULT_MEDIA_SETTINGS: Readonly<MediaSettings> = Object.freeze({
  primarySource: 'douban',
  autoFailover: true,
});

function isSourceId(value: unknown): value is SourceId {
  return value === 'douban' || value === 'tmdb';
}

function readStore(): string | null {
  try {
    return window.localStorage.getItem(MEDIA_SETTINGS_KEY);
  } catch {
    return null;
  }
}

/** 读取设置；损坏或缺失时回落默认值，不抛错 */
export function loadMediaSettings(): MediaSettings {
  const raw = readStore();
  if (!raw) return { ...DEFAULT_MEDIA_SETTINGS };

  try {
    const parsed = JSON.parse(raw) as Partial<MediaSettings> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_MEDIA_SETTINGS };
    return {
      primarySource: isSourceId(parsed.primarySource) ? parsed.primarySource : DEFAULT_MEDIA_SETTINGS.primarySource,
      autoFailover: typeof parsed.autoFailover === 'boolean' ? parsed.autoFailover : DEFAULT_MEDIA_SETTINGS.autoFailover,
    };
  } catch {
    return { ...DEFAULT_MEDIA_SETTINGS };
  }
}

/** 合并写入设置，返回写入后的完整值 */
export function saveMediaSettings(patch: Partial<MediaSettings>): MediaSettings {
  const next: MediaSettings = {
    ...loadMediaSettings(),
    ...(isSourceId(patch.primarySource) ? { primarySource: patch.primarySource } : {}),
    ...(typeof patch.autoFailover === 'boolean' ? { autoFailover: patch.autoFailover } : {}),
  };

  try {
    window.localStorage.setItem(MEDIA_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent<MediaSettings>(MEDIA_SETTINGS_CHANGED_EVENT, { detail: next }));
  } catch (e) {
    console.warn('[media] 保存元数据源设置失败:', e);
  }

  return next;
}

/** 恢复默认设置（主源豆瓣、自动降级开启） */
export function resetMediaSettings(): MediaSettings {
  try {
    window.localStorage.removeItem(MEDIA_SETTINGS_KEY);
  } catch (e) {
    console.warn('[media] 重置元数据源设置失败:', e);
  }
  const next = { ...DEFAULT_MEDIA_SETTINGS };
  try {
    window.dispatchEvent(new CustomEvent<MediaSettings>(MEDIA_SETTINGS_CHANGED_EVENT, { detail: next }));
  } catch {
    /* 事件派发失败不影响设置本身 */
  }
  return next;
}

/** 返回另一个源，供降级使用 */
export function alternateSource(source: SourceId): SourceId {
  return source === 'douban' ? 'tmdb' : 'douban';
}
