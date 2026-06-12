/**
 * 播放器核心模块
 * HLS + ArtPlayer + 全屏 + 事件处理
 *
 * 通过 player-state.ts 共享状态，避免循环依赖。
 */

import { TIMING } from '../../core/timing';
import { PlayerManager } from './player-manager';
import {
  art,
  currentVideoTitle,
  currentEpisodeIndex,
  currentEpisodes as eps,
  adFilteringEnabled,
  episodeSwitchTimeout,
  autoFullscreened,
  currentVideoUrl,
  setArt,
  setVideoHasEnded,
  setAutoFullscreened,
  setEpisodeSwitchTimeout,
  setCurrentVideoUrl,
} from './player-state';

// ==================== 全局声明 ====================

declare const Hls: any;
declare const Artplayer: any;

// ==================== HLS 配置 ====================

export function createHlsConfig() {
  return {
    debug: false,
    loader: adFilteringEnabled
      ? (window as any).CustomHlsJsLoader
      : Hls.DefaultConfig.loader,
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 60,
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
    maxBufferSize: 20 * 1000 * 1000,
    maxBufferHole: 0.3,
    fragLoadingMaxRetry: 3,
    fragLoadingMaxRetryTimeout: 15000,
    fragLoadingRetryDelay: 500,
    manifestLoadingMaxRetry: 2,
    manifestLoadingRetryDelay: 500,
    levelLoadingMaxRetry: 3,
    levelLoadingRetryDelay: 500,
    startLevel: 1,
    abrEwmaDefaultEstimate: 2000000,
    abrBandWidthFactor: 0.9,
    abrBandWidthUpFactor: 0.7,
    abrMaxWithRealBitrate: true,
    stretchShortVideoTrack: true,
    appendErrorMaxRetry: 3,
    liveSyncDurationCount: 2,
    liveDurationInfinity: false,
  };
}

// ==================== HLS 自定义类型 ====================

export function setupHlsCustomType(
  video: HTMLVideoElement,
  url: string,
  hlsConfig: any,
  loadingWatchdog: ReturnType<typeof setTimeout>
): void {
  PlayerManager.setHlsInstance(null);

  const hls = new Hls(hlsConfig);
  PlayerManager.setHlsInstance(hls);

  let errorDisplayed = false;
  let errorCount = 0;
  let playbackStarted = false;
  let bufferAppendErrorCount = 0;

  video.addEventListener('playing', () => {
    playbackStarted = true;
    clearTimeout(loadingWatchdog);
    if (episodeSwitchTimeout) {
      clearTimeout(episodeSwitchTimeout);
      setEpisodeSwitchTimeout(null);
    }
    (window as any).isSwitchingVideo = false;
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.style.display = 'none';
  });

  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 1) {
      const errorEl = document.getElementById('error');
      if (errorEl) errorEl.style.display = 'none';
    }
  });

  hls.loadSource(url);
  hls.attachMedia(video);

  let sourceElement = video.querySelector('source');
  if (sourceElement) {
    sourceElement.src = url;
  } else {
    sourceElement = document.createElement('source');
    sourceElement.src = url;
    video.appendChild(sourceElement);
  }
  video.disableRemotePlayback = false;

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(() => {});
  });

  hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
    errorCount++;
    if (data.details === 'bufferAppendError') {
      bufferAppendErrorCount++;
      if (playbackStarted) return;
      if (bufferAppendErrorCount >= 3) hls.recoverMediaError();
    }
    if (data.fatal && !playbackStarted) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          if (errorCount > 3 && !errorDisplayed) {
            errorDisplayed = true;
            showErrorInline('视频加载失败，可能是格式不兼容或源不可用');
          }
          break;
      }
    }
  });

  [Hls.Events.FRAG_LOADED, Hls.Events.LEVEL_LOADED].forEach((evt) => {
    hls.on(evt, () => {
      clearTimeout(loadingWatchdog);
      if (episodeSwitchTimeout) {
        clearTimeout(episodeSwitchTimeout);
        setEpisodeSwitchTimeout(null);
      }
      (window as any).isSwitchingVideo = false;
      const loadingEl = document.getElementById('player-loading');
      if (loadingEl) loadingEl.style.display = 'none';
    });
  });
}

function showErrorInline(message: string): void {
  if (art && art.video && art.video.currentTime > 1) return;
  const loadingEl = document.getElementById('player-loading');
  if (loadingEl) loadingEl.style.display = 'none';
  const errorEl = document.getElementById('error');
  if (errorEl) errorEl.style.display = 'flex';
  const errorMsgEl = document.getElementById('error-message');
  if (errorMsgEl) errorMsgEl.textContent = message;
}

// ==================== ArtPlayer 实例创建 ====================

export function createArtPlayerInstance(
  videoUrl: string,
  hlsConfig: any,
  loadingWatchdog: ReturnType<typeof setTimeout>
): any {
  return new Artplayer({
    container: '#player',
    url: videoUrl,
    type: 'm3u8',
    title: currentVideoTitle,
    volume: 0.8,
    isLive: false,
    muted: false,
    autoplay: true,
    pip: true,
    autoSize: false,
    autoMini: true,
    screenshot: true,
    setting: true,
    loop: false,
    flip: false,
    playbackRate: true,
    aspectRatio: false,
    fullscreen: true,
    fullscreenWeb: true,
    subtitleOffset: false,
    miniProgressBar: true,
    mutex: true,
    backdrop: true,
    playsInline: true,
    autoPlayback: false,
    airplay: true,
    hotkey: false,
    theme: '#ec4899',
    lang: navigator.language.toLowerCase(),
    moreVideoAttr: { crossOrigin: 'anonymous' },
    customType: {
      m3u8: (video: HTMLVideoElement, url: string) => {
        setupHlsCustomType(video, url, hlsConfig, loadingWatchdog);
      },
    },
  });
}

// ==================== 全屏控制器 ====================

export function createFullScreenController() {
  let hideTimer: ReturnType<typeof setTimeout>;
  let backBtnHideTimer: ReturnType<typeof setTimeout>;

  function hideControls(): void {
    if (art?.controls) art.controls.show = false;
    hideBackBtn();
  }
  function showBackBtn(): void {
    const btn = document.querySelector('.player-back-btn') as HTMLElement;
    if (btn) btn.classList.add('show');
    clearTimeout(backBtnHideTimer);
    backBtnHideTimer = setTimeout(
      hideBackBtn,
      (window as any).Artplayer?.CONTROL_HIDE_TIME || 3000
    );
  }
  function hideBackBtn(): void {
    const btn = document.querySelector('.player-back-btn') as HTMLElement;
    if (btn) btn.classList.remove('show');
    clearTimeout(backBtnHideTimer);
  }
  function resetHideTimer(): void {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideControls, (window as any).Artplayer?.CONTROL_HIDE_TIME || 3000);
  }
  function handleMouseOut(e: MouseEvent): void {
    if (e && !e.relatedTarget) resetHideTimer();
  }
  function handleFullScreen(isFullScreen: boolean): void {
    const container = document.getElementById('playerContainer')!;
    if (isFullScreen) {
      container.classList.add('fullscreen-active');
      document.body.classList.add('fullscreen-active');
      document.addEventListener('mouseout', handleMouseOut);
    } else {
      container.classList.remove('fullscreen-active');
      document.body.classList.remove('fullscreen-active');
      document.removeEventListener('mouseout', handleMouseOut);
      clearTimeout(hideTimer);
      clearTimeout(backBtnHideTimer);
      setAutoFullscreened(false);
    }
  }

  return { hideControls, showBackBtn, hideBackBtn, resetHideTimer, handleFullScreen };
}

// ==================== 播放器事件处理 ====================

export function setupPlayerEventListeners(
  player: any,
  fsc: ReturnType<typeof createFullScreenController>,
  loadingWatchdog: ReturnType<typeof setTimeout>
): void {
  player.on('ready', () => onPlayerReady(player, fsc));
  player.on('fullscreenWeb', (v: boolean) => onFullScreenChange(player, fsc, v));
  player.on('fullscreen', (v: boolean) => onFullScreenChange(player, fsc, v));
  player.on('restart', () => onPlayerRestart(player));
  player.on('video:loadedmetadata', () => onVideoLoaded(player, loadingWatchdog));
  player.on('video:error', (err: Error) => onVideoError(err));
  player.on('video:pause', () => syncMediaSessionState('paused'));
  player.on('video:playing', () => syncMediaSessionState('playing'));
  player.on('video:ended', () => onVideoEnded(player));
}

export function onPlayerReady(
  player: any,
  fsc: ReturnType<typeof createFullScreenController>
): void {
  fsc.hideControls();
  const area = document.querySelector('.player-layout-left');
  if (area) area.addEventListener('mousemove', fsc.showBackBtn);

  if (window.screen && (window.screen as any).orientation) {
    (window.screen as any).orientation.addEventListener('change', () => {
      if (window.innerWidth > 640 || window.innerHeight > 640) return;
      const isLandscape = (window.screen as any).orientation.type.includes('landscape');
      if (isLandscape && !player.fullscreen) {
        setAutoFullscreened(true);
        player.fullscreen = true;
      } else if (!isLandscape && player.fullscreen && autoFullscreened) {
        player.fullscreen = false;
        setAutoFullscreened(false);
      }
    });
  }

  injectUiButtons(player);
}

export function onFullScreenChange(
  player: any,
  fsc: ReturnType<typeof createFullScreenController>,
  isFullScreen: boolean
): void {
  fsc.handleFullScreen(isFullScreen);
  setTimeout(() => injectNextEpisodeBtn(player), TIMING.NEXT_EPISODE_BTN_DELAY);
}

export function onPlayerRestart(player: any): void {
  if (episodeSwitchTimeout) {
    clearTimeout(episodeSwitchTimeout);
    setEpisodeSwitchTimeout(null);
  }
  (window as any).isSwitchingVideo = false;
  setTimeout(() => injectNextEpisodeBtn(player), TIMING.NEXT_EPISODE_BTN_DELAY);
}

export function onVideoLoaded(
  player: any,
  loadingWatchdog: ReturnType<typeof setTimeout>
): void {
  clearTimeout(loadingWatchdog);
  if (episodeSwitchTimeout) {
    clearTimeout(episodeSwitchTimeout);
    setEpisodeSwitchTimeout(null);
  }
  (window as any).isSwitchingVideo = false;
  const loadingEl = document.getElementById('player-loading');
  if (loadingEl) loadingEl.style.display = 'none';
  setVideoHasEnded(false);

  // 恢复播放进度
  restorePlaybackPosition(player);

  // 延迟调用 UI 模块函数
  setTimeout(() => injectUIFeatures(), 0);
}

function restorePlaybackPosition(player: any): void {
  const urlParams = new URLSearchParams(window.location.search);
  const savedPosition = parseInt(urlParams.get('position') || '0');

  if (savedPosition > 10 && savedPosition < player.duration - 2) {
    player.currentTime = savedPosition;
    showRestoreHintInline(savedPosition);
    return;
  }

  try {
    const progressKey = 'videoProgress_' + (urlParams.get('id') || currentVideoTitle || 'unknown');
    const progressStr = localStorage.getItem(progressKey);
    if (progressStr && player.duration > 0) {
      const progress = JSON.parse(progressStr);
      if (
        progress &&
        typeof progress.position === 'number' &&
        progress.position > 10 &&
        progress.position < player.duration - 2
      ) {
        player.currentTime = progress.position;
        showRestoreHintInline(progress.position);
      }
    }
  } catch {
    /* 静默 */
  }
}

function showRestoreHintInline(position: number): void {
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

export function onVideoError(error: Error): void {
  if ((window as any).isSwitchingVideo) return;
  document
    .querySelectorAll('#player-loading, .player-loading-container')
    .forEach((el) => ((el as HTMLElement).style.display = 'none'));
  showErrorInline('视频播放失败: ' + (error.message || '未知错误'));
}

export function syncMediaSessionState(state: string): void {
  if (navigator.mediaSession) {
    navigator.mediaSession.playbackState = state as MediaSessionPlaybackState;
  }
}

export function onVideoEnded(player: any): void {
  setVideoHasEnded(true);
  clearProgressInline();
  // 自动连播
  if (
    localStorage.getItem('autoplayEnabled') !== 'false' &&
    currentEpisodeIndex < eps.length - 1
  ) {
    setTimeout(() => {
      import('./player-episodes').then((ep) => {
        ep.playNextEpisode();
        setVideoHasEnded(false);
      });
    }, 1000);
  } else {
    player.fullscreen = false;
  }
}

function clearProgressInline(): void {
  const id = new URLSearchParams(window.location.search).get('id') || currentVideoTitle || 'unknown';
  localStorage.removeItem('videoProgress_' + id);
}

// ==================== UI 工具函数注入 ====================

// 这些函数通过 window 调用 player-ui 模块的函数
function injectUiButtons(player: any): void {
  const ui = (window as any).__playerUI;
  if (!ui) {
    // 延迟重试
    setTimeout(() => injectUiButtons(player), 100);
    return;
  }
  ui.addNextEpisodeDirectly(player);
  ui.addLockFloatingButton(player);
  setTimeout(() => ui.addNextEpisodeDirectly(player), 300);
  setTimeout(() => ui.addNextEpisodeDirectly(player), 800);
  setTimeout(() => ui.addNextEpisodeDirectly(player), 1500);
}

function injectNextEpisodeBtn(player: any): void {
  const ui = (window as any).__playerUI;
  if (ui) ui.addNextEpisodeDirectly(player);
}

function injectUIFeatures(): void {
  const ui = (window as any).__playerUI;
  if (!ui) return;
  ui.setupProgressBarPreciseClicks();
  setTimeout(ui.saveToHistory, TIMING.SAVE_HISTORY_DELAY);
  ui.startProgressSaveInterval();
  import('./player-episodes').then((ep) => ep.updateMediaSession());
}

// ==================== 播放器初始化 ====================

export function initPlayer(videoUrl: string): void {
  if (!videoUrl) return;

  const loadingWatchdog = setTimeout(() => {
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl && loadingEl.style.display !== 'none') {
      loadingEl.style.display = 'none';
    }
  }, TIMING.PLAYER_LOADING_WATCHDOG);

  PlayerManager.destroy();

  const hlsConfig = createHlsConfig();
  const player = createArtPlayerInstance(videoUrl, hlsConfig, loadingWatchdog);
  setArt(player);
  PlayerManager.setInstance(player);

  const fsc = createFullScreenController();
  setupPlayerEventListeners(player, fsc, loadingWatchdog);

  // 加载 UI 模块并注册到 window 供 core 调用
  import('./player-ui').then((ui) => {
    (window as any).__playerUI = ui;
    injectUiButtons(player);
    ui.setupLongPressSpeedControl();
    ui.setupThumbnailCapture();
    ui.setupControlsBehavior();
  });

  setupLongLoadingWarning();
}

// ==================== 超时加载提醒 ====================

export function setupLongLoadingWarning(): void {
  setTimeout(() => {
    if (art?.video?.currentTime > 0) return;
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl && loadingEl.style.display !== 'none') {
      loadingEl.innerHTML = `
        <div class="loading-spinner"></div>
        <div>视频加载时间较长，请耐心等待...</div>
        <div style="font-size: 12px; color: #aaa; margin-top: 10px;">如长时间无响应，请尝试其他视频源</div>
      `;
    }
  }, 10000);
}
