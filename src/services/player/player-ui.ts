/**
 * 播放器 UI 控件模块
 * 快捷键提示 + 进度条 + 覆盖层 + 资源切换
 */

import { TIMING } from '../../core/timing';
import { PlayerManager } from './player-manager';
import {
  art,
  currentVideoTitle,
  currentEpisodes,
  currentEpisodeIndex,
  shortcutHintTimeout,
  setShortcutHintTimeout,
  setProgressSaveInterval,
} from './player-state';

// ==================== Toast 工具 ====================

export function showToast(message: string, type: string = 'info', duration?: number): void {
  if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type, duration);
  }
}

export function showLoading(): void {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'flex';
}

export function hideLoading(): void {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}

// ==================== 错误显示 ====================

export function showError(message: string): void {
  if (art?.video?.currentTime > 1) return;
  const loadingEl = document.getElementById('player-loading');
  if (loadingEl) loadingEl.style.display = 'none';
  const errorEl = document.getElementById('error');
  if (errorEl) errorEl.style.display = 'flex';
  const msgEl = document.getElementById('error-message');
  if (msgEl) msgEl.textContent = message;
}

// ==================== 快捷键提示 ====================

export function showShortcutHint(
  text: string,
  direction?: string
): void {
  const hintEl = document.getElementById('shortcutHint');
  const textEl = document.getElementById('shortcutText');
  const iconEl = document.getElementById('shortcutIcon');
  if (!hintEl || !textEl || !iconEl) return;

  if (shortcutHintTimeout) clearTimeout(shortcutHintTimeout);
  textEl.textContent = text;

  const icons: Record<string, string> = {
    left: 'M15 19l-7-7 7-7',
    right: 'M9 5l7 7-7 7',
    up: 'M5 15l7-7 7 7',
    down: 'M19 9l-7 7-7-7',
    fullscreen: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5',
    play: 'M5 3l14 9-14 9V3z',
  };
  iconEl.innerHTML = icons[direction || ''] || icons.play;

  hintEl.classList.add('show');
  setShortcutHintTimeout(setTimeout(() => hintEl.classList.remove('show'), 2000));
}

// ==================== 进度条精确点击 ====================

export function setupProgressBarPreciseClicks(): void {
  if (!art?.controls) return;
  const bar = art.controls.querySelector('.artplayer-control-progress');
  if (!bar) return;
  bar.addEventListener('click', () => {
    /* ArtPlayer 已处理 */
  });
}

// ==================== 进度保存 ====================

export function startProgressSaveInterval(): void {
  const id = setInterval(() => {
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
  }, TIMING.PROGRESS_SAVE_INTERVAL);
  setProgressSaveInterval(id);
}

export function clearVideoProgress(): void {
  const key = 'videoProgress_' + getVideoId();
  localStorage.removeItem(key);
}

function getVideoId(): string {
  return new URLSearchParams(window.location.search).get('id') || currentVideoTitle || 'unknown';
}

// ==================== 播放进度恢复提示 ====================

export function showPositionRestoreHint(position: number): void {
  const minutes = Math.floor(position / 60);
  const seconds = Math.floor(position % 60);
  const hint = document.createElement('div');
  hint.className = 'position-restore-hint';
  hint.textContent = `⏱ 已恢复至 ${minutes}:${seconds.toString().padStart(2, '0')}`;
  hint.style.cssText =
    'position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;padding:6px 14px;border-radius:8px;font-size:13px;z-index:60;pointer-events:none;transition:opacity 0.5s';
  const container = document.getElementById('playerContainer');
  if (container) {
    container.appendChild(hint);
    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 500);
    }, 3000);
  }
}

// ==================== "下一集"按钮注入 ====================

export function addNextEpisodeDirectly(player: any): void {
  if (!player?.controls) return;
  try {
    const btn = document.querySelector('.art-next-episode-btn');
    if (btn) return; // 已存在
    if (currentEpisodeIndex >= currentEpisodes.length - 1) return;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'art-next-episode-btn art-control-icon';
    nextBtn.innerHTML = `<span style="font-size:12px;white-space:nowrap;padding:0 6px;">下一集</span>`;
    nextBtn.title = '下一集';
    nextBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      import('./player-episodes').then((m) => m.playNextEpisode());
    });

    const right = player.controls.querySelector('.art-control-right');
    if (right) {
      right.prepend(nextBtn);
    } else {
      player.controls.appendChild(nextBtn);
    }
  } catch {
    /* 静默 */
  }
}

// ==================== 锁定悬浮按钮 ====================

export function addLockFloatingButton(player: any): void {
  if (!player?.controls) return;
  try {
    const existing = document.querySelector('.art-lock-btn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.className = 'art-lock-btn art-control-icon';
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
    btn.title = '锁定/解锁悬浮';

    let locked = false;
    btn.addEventListener('click', () => {
      locked = !locked;
      btn.style.opacity = locked ? '0.5' : '1';
      showToast(locked ? '已锁定悬浮' : '已解锁悬浮', 'info');
    });

    const right = player.controls.querySelector('.art-control-right');
    if (right) right.prepend(btn);
  } catch {
    /* 静默 */
  }
}

// ==================== 长按倍速控制 ====================

export function setupLongPressSpeedControl(): void {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  const onDown = () => {
    pressTimer = setTimeout(() => {
      if (art?.video) art.video.playbackRate = 2.0;
    }, TIMING.LONG_PRESS_INTERVAL);
  };

  const onUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (art?.video) art.video.playbackRate = 1.0;
  };

  document.addEventListener('mousedown', onDown);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchstart', onDown);
  document.addEventListener('touchend', onUp);
}

// ==================== 缩略图捕获 ====================

export function setupThumbnailCapture(): void {
  // 功能保留但暂无实现
}

// ==================== 控制栏行为 ====================

export function setupControlsBehavior(): void {
  // 由 ArtPlayer 原生控制
}

// ==================== 资源切换弹窗 ====================

export function showResourceSwitchModal(
  sources: { code: string; name: string; count: number }[],
  onSelect: (code: string) => void
): void {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const content = document.getElementById('modalContent')?.querySelector('.grid');
  if (!modal || !title || !content) return;

  title.textContent = '切换资源';
  content.innerHTML = sources
    .map(
      (s) =>
        `<button data-source="${s.code}" class="resource-switch-btn px-3 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-sm text-center transition-colors">${s.name} (${s.count})</button>`
    )
    .join('');

  content.querySelectorAll('[data-source]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onSelect((btn as HTMLElement).dataset.source || '');
      modal.style.display = 'none';
    });
  });

  modal.style.display = 'flex';
}

// ==================== 复制链接 ====================

export function copyLinks(): void {
  const url = new URLSearchParams(window.location.search).get('url') || '';
  if (url) {
    navigator.clipboard
      .writeText(url)
      .then(() => showToast('播放链接已复制', 'success'))
      .catch(() => showToast('复制失败', 'error'));
  }
}

// ==================== 导出所有 UI 函数供 core 模块调用 ====================

export default {
  showToast,
  showLoading,
  hideLoading,
  showError,
  showShortcutHint,
  setupProgressBarPreciseClicks,
  startProgressSaveInterval,
  clearVideoProgress,
  showPositionRestoreHint,
  addNextEpisodeDirectly,
  addLockFloatingButton,
  setupLongPressSpeedControl,
  setupThumbnailCapture,
  setupControlsBehavior,
  showResourceSwitchModal,
  copyLinks,
  saveToHistory: () => {
    import('./player-episodes').then((m) => m.saveToHistory());
  },
};
