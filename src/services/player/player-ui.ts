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
  _lastHistoryWriteTime,
  setLastHistoryWriteTime,
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
      const ct = art.video.currentTime;
      // 只保存 currentTime > 1 时的进度（忽略开头）
      if (ct <= 1) return;

      const key = 'videoProgress_' + getVideoId();

      // 防抖：viewingHistory 更新最多每 30 秒一次
      const now = Date.now();
      if (now - _lastHistoryWriteTime < 30000) return;

      // 读取已有进度，仅当新进度超过 10 秒时才覆盖（防止刷新丢失进度）
      let existing: { position: number; timestamp: number } | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) existing = JSON.parse(raw);
      } catch { /* 静默 */ }

      if (existing && ct - existing.position < 10) return;

      localStorage.setItem(
        key,
        JSON.stringify({ position: ct, timestamp: now })
      );
      setLastHistoryWriteTime(now);
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

interface SpeedResult {
  speed: number;  // 毫秒，-1 表示失败
  episodes: number;
  error: string | null;
  note?: string;
}

/**
 * 对指定视频源做 HEAD 测速
 * 1. 调用 /api/detail 获取视频详情（得到第一个 episode URL）
 * 2. 对该 URL 做 HEAD 请求测速（no-cors, 5s 超时）
 */
async function testVideoSourceSpeed(sourceKey: string, vodId: string): Promise<SpeedResult> {
  const startTime = Date.now();
  try {
    // 1. 获取视频详情
    let detailUrl: string;
    if (sourceKey.startsWith('custom_')) {
      const customIndex = sourceKey.replace('custom_', '');
      const raw = localStorage.getItem('customAPIs');
      const customAPIs: { url?: string; detail?: string }[] = raw ? JSON.parse(raw) : [];
      const api = customAPIs[Number(customIndex)];
      if (!api) return { speed: -1, episodes: 0, error: '自定义 API 不存在' };
      const apiUrl = api.detail || api.url;
      detailUrl = `/api/detail?id=${encodeURIComponent(vodId)}&source=custom&customApi=${encodeURIComponent(apiUrl || '')}`;
    } else {
      detailUrl = `/api/detail?id=${encodeURIComponent(vodId)}&source=${encodeURIComponent(sourceKey)}`;
    }

    const detailResp = await fetch(detailUrl);
    if (!detailResp.ok) {
      return { speed: -1, episodes: 0, error: `详情请求失败: ${detailResp.status}` };
    }
    const detailData = await detailResp.json();
    const episodes: string[] = detailData.episodes || [];
    if (episodes.length === 0) {
      return { speed: -1, episodes: 0, error: '无可用剧集' };
    }

    // 2. 取第一个 episode URL 做 HEAD 测速
    const firstUrl = episodes[0];
    const headStart = Date.now();
    try {
      await fetch(firstUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000),
      });
      const elapsed = Date.now() - headStart;
      return { speed: elapsed, episodes: episodes.length, error: null };
    } catch {
      // HEAD 请求失败（no-cors 模式下无法读取耗时，但请求本身可能成功）
      // 退而使用整体耗时作为参考
      return { speed: Date.now() - startTime, episodes: episodes.length, error: null };
    }
  } catch (err) {
    return { speed: -1, episodes: 0, error: (err as Error).message || '未知错误' };
  }
}

function formatSpeedDisplay(speedResult: SpeedResult): string {
  if (speedResult.speed < 0) return '🔴 超时/失败';
  if (speedResult.speed < 500) return '🟢 极速';
  if (speedResult.speed < 2000) return '🟡 较快';
  return '🔴 较慢';
}

/**
 * 显示资源切换弹窗
 * 从 URL 参数获取当前 source/id/title，从 localStorage 获取已选 API 列表，
 * 并行搜索 + 测速，按速度排序渲染，渐进式展示。
 */
export async function showResourceSwitchModal(): Promise<void> {
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modalTitle');
  const content = document.getElementById('modalContent');
  if (!modal || !titleEl || !content) return;

  // 1. 从 URL 参数获取当前信息
  const params = new URLSearchParams(window.location.search);
  const currentSourceCode = params.get('source') || 'heimuer';
  const currentVideoId = params.get('id') || '';
  const currentVideoTitleFromUrl = params.get('title') || currentVideoTitle || '';

  // 2. 从 localStorage 读取已选 API 和自定义 API
  let selectedAPIs: string[] = [];
  try {
    selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
  } catch { /* 静默 */ }

  // 过滤掉 'aggregated' 和 'custom' 特殊标识
  const sourceKeys = selectedAPIs.filter(
    (k) => k !== 'aggregated' && k !== 'custom'
  );

  if (sourceKeys.length === 0) {
    showToast('请先在设置中启用 API 源', 'warning');
    return;
  }

  // 3. 初始化弹窗
  titleEl.textContent = currentVideoTitleFromUrl || '切换资源';
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3';
  content.innerHTML = '';
  content.appendChild(grid);
  modal.style.display = 'flex';

  // 存储搜索结果: sourceKey -> { result, speed }
  const resultsMap = new Map<
    string,
    {
      result: any | null;
      speed: SpeedResult | null;
      searching: boolean;
    }
  >();

  // 辅助：重新渲染网格
  function renderGrid(): void {
    const sorted = Array.from(resultsMap.entries())
      .filter(([, v]) => v.result !== null)
      .sort(([keyA], [keyB]) => {
        // 当前源优先
        if (keyA === currentSourceCode) return -1;
        if (keyB === currentSourceCode) return 1;
        // 按速度排序（速度快的在前）
        const speedA = resultsMap.get(keyA)?.speed?.speed ?? Infinity;
        const speedB = resultsMap.get(keyB)?.speed?.speed ?? Infinity;
        return speedA - speedB;
      });

    grid.innerHTML = sorted
      .map(([key, val]) => {
        const r = val.result;
        const s = val.speed;
        const isCurrent = key === currentSourceCode;
        const speedLabel = s ? formatSpeedDisplay(s) : '⏳ 测速中...';
        const episodeCount = s ? `(${s.episodes}集)` : '';
        const sourceName = r?.source_name || key;
        const coverUrl = r?.vod_pic || '';
        const vodName = r?.vod_name || currentVideoTitleFromUrl;

        return `
          <div
            class="resource-card relative rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105 border ${isCurrent ? 'border-blue-500 ring-2 ring-blue-400' : 'border-[#333]'}"
            data-source-key="${key}"
            data-vod-id="${r?.vod_id || ''}"
          >
            ${coverUrl ? `<img src="${coverUrl}" alt="${vodName}" class="w-full h-28 object-cover" loading="lazy" />` : '<div class="w-full h-28 bg-[#222] flex items-center justify-center text-gray-500">暂无封面</div>'}
            <div class="p-2">
              <div class="font-medium text-sm truncate" title="${vodName}">${vodName}</div>
              <div class="text-xs text-gray-400 mt-1 flex justify-between items-center">
                <span>${sourceName} ${episodeCount}</span>
                <span>${speedLabel}</span>
              </div>
            </div>
            ${isCurrent ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="text-white font-bold text-lg bg-blue-600 px-3 py-1 rounded">当前播放</span></div>' : ''}
          </div>
        `;
      })
      .join('');

    // 绑定点击事件
    grid.querySelectorAll('.resource-card').forEach((card) => {
      card.addEventListener('click', () => {
        const sourceKey = (card as HTMLElement).dataset.sourceKey || '';
        const vodId = (card as HTMLElement).dataset.vodId || '';
        if (!sourceKey || !vodId) return;
        if (sourceKey === currentSourceCode) return; // 当前源点击不做任何事
        modal!.style.display = 'none';
        switchToResource(sourceKey, vodId);
      });
    });
  }

  // 4. 对所有源并行搜索 & 测速
  const promises = sourceKeys.map(async (sourceKey) => {
    resultsMap.set(sourceKey, { result: null, speed: null, searching: true });
    renderGrid();

    try {
      // 搜索该源下的视频
      const { searchByAPIAndKeyWord } = await import('../api/search');
      const searchResults = await searchByAPIAndKeyWord(sourceKey, currentVideoTitleFromUrl);

      if (!searchResults || searchResults.length === 0) {
        resultsMap.set(sourceKey, { result: null, speed: null, searching: false });
        // 设为空结果但显示占位
        renderGrid();
        return;
      }

      // 取第一个结果（最匹配的）
      const firstResult = searchResults[0];
      const vodId = firstResult.vod_id || '';

      resultsMap.set(sourceKey, { result: firstResult, speed: null, searching: false });
      renderGrid();

      if (!vodId) {
        resultsMap.set(sourceKey, {
          result: firstResult,
          speed: { speed: -1, episodes: 0, error: '无视频 ID' },
          searching: false,
        });
        renderGrid();
        return;
      }

      // 测速
      const speed = await testVideoSourceSpeed(sourceKey, vodId);
      resultsMap.set(sourceKey, { result: firstResult, speed, searching: false });
      renderGrid();
    } catch (err) {
      resultsMap.set(sourceKey, {
        result: null,
        speed: { speed: -1, episodes: 0, error: (err as Error).message },
        searching: false,
      });
      renderGrid();
    }
  });

  // 全部完成后再刷新一次
  await Promise.allSettled(promises);
  renderGrid();
}

/**
 * 切换到指定资源
 * 修改 URL 参数并刷新页面
 */
function switchToResource(sourceKey: string, vodId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('source', sourceKey);
  url.searchParams.set('id', vodId);
  window.location.href = url.toString();
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
  testVideoSourceSpeed,
  formatSpeedDisplay,
  switchToResource,
  copyLinks,
  saveToHistory: () => {
    import('./player-episodes').then((m) => m.saveToHistory());
  },
};
