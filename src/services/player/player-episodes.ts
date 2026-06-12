/**
 * 选集管理模块
 */

import { TIMING } from '../../core/timing';
import { PlayerManager } from './player-manager';
import {
  art,
  currentEpisodes,
  currentEpisodeIndex,
  currentVideoTitle,
  episodesReversed,
  episodeSwitchTimeout,
  setCurrentEpisodeIndex,
  setCurrentVideoUrl,
  setVideoHasEnded,
  setEpisodeSwitchTimeout,
  setEpisodesReversed,
} from './player-state';

// ==================== 剧集信息 ====================

export function updateEpisodeInfo(): void {
  const el = document.getElementById('episodeInfo');
  if (!el) return;
  el.textContent =
    currentEpisodes.length > 0
      ? `第 ${currentEpisodeIndex + 1}/${currentEpisodes.length} 集`
      : '无集数信息';
}

export function updateButtonStates(): void {
  const prevBtn = document.getElementById('prevButton');
  const nextBtn = document.getElementById('nextButton');
  const applyBtnState = (btn: HTMLElement | null, isFirst: boolean) => {
    if (!btn) return;
    if (isFirst) {
      btn.classList.remove('bg-gray-700', 'cursor-not-allowed');
      btn.classList.add('bg-[#222]', 'hover:bg-[#333]');
      btn.removeAttribute('disabled');
    } else {
      btn.classList.add('bg-gray-700', 'cursor-not-allowed');
      btn.classList.remove('bg-[#222]', 'hover:bg-[#333]');
      btn.setAttribute('disabled', '');
    }
  };
  applyBtnState(prevBtn, currentEpisodeIndex > 0);
  applyBtnState(nextBtn, currentEpisodeIndex < currentEpisodes.length - 1);
}

export function renderEpisodes(): void {
  const list = document.getElementById('episodesList');
  if (!list) return;
  if (!currentEpisodes?.length) {
    list.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">没有可用的集数</div>';
    return;
  }

  const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
  list.innerHTML = episodes
    .map((_, i) => {
      const realIdx = episodesReversed ? currentEpisodes.length - 1 - i : i;
      const active = realIdx === currentEpisodeIndex;
      return `<button id="episode-${realIdx}" data-action="play-episode" data-index="${realIdx}" 
        class="px-4 py-2 ${active ? 'episode-active' : '!bg-[rgba(34,34,34,0.5)] hover:!bg-[rgba(255,255,255,0.1)] hover:!shadow-none'} !border ${active ? '!border-transparent' : '!border-[var(--color-border-default)]'} rounded-lg transition-all text-center episode-btn">${realIdx + 1}</button>`;
    })
    .join('');
}

// ==================== 切换剧集 ====================

export function playEpisode(index: number): void {
  if ((window as any).isSwitchingVideo) return;
  (window as any).isSwitchingVideo = true;
  if (index < 0 || index >= currentEpisodes.length) {
    (window as any).isSwitchingVideo = false;
    return;
  }

  // 保存进度
  if (art?.video && !art.video.paused) saveCurrentProgress();
  clearProgressTimer();

  document.getElementById('error')!.style.display = 'none';
  const loadingEl = document.getElementById('player-loading');
  if (loadingEl) {
    loadingEl.style.display = 'flex';
    loadingEl.innerHTML = '<div class="loading-spinner"></div><div>正在加载视频...</div>';
  }

  const url = currentEpisodes[index];
  setCurrentEpisodeIndex(index);
  setCurrentVideoUrl(url);
  setVideoHasEnded(false);

  // 更新 URL
  const u = new URL(window.location.href);
  u.searchParams.set('index', String(index));
  u.searchParams.set('url', url);
  u.searchParams.delete('position');
  window.history.replaceState({}, '', u.toString());

  updateEpisodeInfo();
  updateButtonStates();
  renderEpisodes();
  updateMediaSession();

  if (art) {
    // 切换超时兜底
    const timeout = setTimeout(() => {
      setEpisodeSwitchTimeout(null);
      (window as any).isSwitchingVideo = false;
      const el = document.getElementById('player-loading');
      if (el && el.style.display !== 'none') {
        PlayerManager.destroy();
        import('./player-core').then((m) => m.initPlayer(url));
      }
    }, 12000);
    setEpisodeSwitchTimeout(timeout);
    art.url = url;
  } else {
    import('./player-core').then((m) => m.initPlayer(url));
    (window as any).isSwitchingVideo = false;
  }

  setTimeout(() => saveToHistory(), TIMING.SAVE_HISTORY_DELAY);
}

export function playPreviousEpisode(): void {
  if (currentEpisodeIndex > 0) playEpisode(currentEpisodeIndex - 1);
}

export function playNextEpisode(): void {
  if (currentEpisodeIndex < currentEpisodes.length - 1) playEpisode(currentEpisodeIndex + 1);
}

// ==================== 排序 ====================

export function toggleEpisodeOrder(): void {
  const v = !episodesReversed;
  setEpisodesReversed(v);
  localStorage.setItem('episodesReversed', String(v));
  renderEpisodes();
  const icon = document.getElementById('orderIcon');
  if (icon) icon.style.transform = v ? 'rotate(180deg)' : '';
}

// ==================== History / MediaSession ====================

function saveCurrentProgress(): void {
  if (!art?.video || !currentVideoTitle) return;
  try {
    const key = 'videoProgress_' + getVideoId();
    localStorage.setItem(
      key,
      JSON.stringify({ position: art.video.currentTime, timestamp: Date.now() })
    );
  } catch {
    /* 静默 */
  }
}

function clearProgressTimer(): void {
  const { progressSaveInterval, setProgressSaveInterval } =
    require('../player-state') || {};
}

export function saveToHistory(): void {
  if (!currentVideoTitle) return;
  try {
    const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
    const entry = {
      title: currentVideoTitle,
      episodeIndex: currentEpisodeIndex,
      timestamp: Date.now(),
      url: window.location.href,
    };
    const idx = history.findIndex((h: any) => h.title === currentVideoTitle);
    if (idx >= 0) history[idx] = entry;
    else history.unshift(entry);
    if (history.length > 200) history.length = 200;
    localStorage.setItem('viewingHistory', JSON.stringify(history));
  } catch {
    /* 静默 */
  }
}

export function updateMediaSession(): void {
  if (!navigator.mediaSession || !currentVideoTitle) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentVideoTitle,
    artist: 'LeLeTV',
  });
}

function getVideoId(): string {
  return new URLSearchParams(window.location.search).get('id') || currentVideoTitle || 'unknown';
}

function require(p: string): any {
  return {};
}
