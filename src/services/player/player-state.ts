/**
 * 播放器共享状态
 *
 * 所有播放器模块共享的状态变量，避免循环依赖。
 */

// ==================== 播放器实例 ====================

export let art: any = null;
export let currentHlsInstance: any = null;

export function setArt(instance: any): void {
  art = instance;
  (window as any).art = instance;
}

export function setCurrentHls(instance: any): void {
  currentHlsInstance = instance;
}

// ==================== 视频信息 ====================

export let currentVideoTitle = '';
export let currentEpisodes: string[] = [];
export let currentEpisodeIndex = 0;
export let currentVideoUrl = '';
export let videoHasEnded = false;
export let episodesReversed = false;

export function setCurrentVideoTitle(title: string): void {
  currentVideoTitle = title;
}

export function setCurrentEpisodes(episodes: string[]): void {
  currentEpisodes = episodes;
}

export function setCurrentEpisodeIndex(index: number): void {
  currentEpisodeIndex = index;
}

export function setCurrentVideoUrl(url: string): void {
  currentVideoUrl = url;
}

export function setVideoHasEnded(ended: boolean): void {
  videoHasEnded = ended;
}

export function setEpisodesReversed(reversed: boolean): void {
  episodesReversed = reversed;
}

// ==================== 播放设置 ====================

export let autoplayEnabled = true;
export let adFilteringEnabled = true;
export let autoFullscreened = false;

export function setAutoplayEnabled(enabled: boolean): void {
  autoplayEnabled = enabled;
}

export function setAdFilteringEnabled(enabled: boolean): void {
  adFilteringEnabled = enabled;
}

export function setAutoFullscreened(value: boolean): void {
  autoFullscreened = value;
}

// ==================== 定时器 ====================

export let episodeSwitchTimeout: ReturnType<typeof setTimeout> | null = null;
export let progressSaveInterval: ReturnType<typeof setInterval> | null = null;
export let shortcutHintTimeout: ReturnType<typeof setTimeout> | null = null;

export function setEpisodeSwitchTimeout(t: ReturnType<typeof setTimeout> | null): void {
  episodeSwitchTimeout = t;
}

export function setProgressSaveInterval(i: ReturnType<typeof setInterval> | null): void {
  progressSaveInterval = i;
}

export function setShortcutHintTimeout(t: ReturnType<typeof setTimeout> | null): void {
  shortcutHintTimeout = t;
}

// ==================== 用户交互 ====================

export let userClickedPosition: number | null = null;

export function setUserClickedPosition(pos: number | null): void {
  userClickedPosition = pos;
}

// ==================== 全局状态同步 ====================

/** 暴露所有状态到 window 对象（向后兼容） */
export function syncToWindow(): void {
  const w = window as any;
  w.art = art;
  w.currentVideoTitle = currentVideoTitle;
  w.currentEpisodes = currentEpisodes;
  w.currentEpisodeIndex = currentEpisodeIndex;
  w.currentVideoUrl = currentVideoUrl;
  w.videoHasEnded = videoHasEnded;
  w.episodesReversed = episodesReversed;
  w.autoplayEnabled = autoplayEnabled;
  w.adFilteringEnabled = adFilteringEnabled;
  w.autoFullscreened = autoFullscreened;
  w.userClickedPosition = userClickedPosition;
}
