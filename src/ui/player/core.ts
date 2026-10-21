// LeLeTV — 播放器核心模块
// HLS + ArtPlayer + 全屏 + 事件处理

// 阶段 5B-2：状态从 ui/player/state.ts 读取，选集推进改为回调，core 不再反向依赖 episodes。
import {
    art,
    autoFullscreened,
    autoplayEnabled,
    currentEpisodeIndex,
    currentEpisodes,
    currentVideoTitle,
    episodeSwitchTimeout,
    videoHasEnded,
    advanceEpisode,
    setArt,
    setAutoFullscreened,
    setEpisodeSwitchTimeout,
    setVideoHasEnded,
} from './state';

interface HlsInstance {
    loadSource(url: string): void;
    attachMedia(video: HTMLVideoElement): void;
    on(event: string, handler: (...args: never[]) => void): void;
    startLoad(): void;
    recoverMediaError(): void;
    destroy(): void;
}

interface HlsStatic {
    new (config: Record<string, unknown>): HlsInstance;
    isSupported(): boolean;
    DefaultConfig: { loader: unknown };
    Events: Record<string, string>;
    ErrorTypes: Record<string, string>;
}

interface HlsErrorData {
    details?: string;
    fatal?: boolean;
    type?: string;
}

interface ArtplayerInstance {
    on(event: string, handler: (...args: never[]) => void): void;
    controls: { show: boolean };
    fullscreen: boolean;
    currentTime: number;
    duration: number;
}

interface ArtplayerStatic {
    new (options: Record<string, unknown>): ArtplayerInstance;
    CONTROL_HIDE_TIME: number;
}

interface FullScreenController {
    hideControls(): void;
    showBackBtn(): void;
    hideBackBtn(): void;
    resetHideTimer(): void;
    handleFullScreen(isFullScreen: boolean): void;
}

interface FailoverApi {
    markPlaying(): void;
    watch(art: unknown): void;
    autoSwitchLine(reason: string): Promise<boolean>;
}

interface PlayerCoreWindow extends Window {
    LeLeFailover?: FailoverApi;
    isSwitchingVideo?: boolean;
}

declare const Hls: HlsStatic;
declare const Artplayer: ArtplayerStatic;

const playerCoreWindow = window as PlayerCoreWindow;

/**
 * iOS/iPadOS 判定。
 * iOS 上 Safari / Chrome / Firefox 全部是 WebKit 内核，表现一致；
 * iPadOS 13+ 的 UA 会伪装成 Macintosh，用触点数兜底区分。
 */
function isIOSDevice(): boolean {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * 是否该把 m3u8 交给系统原生 HLS 播放（不创建 hls.js 实例）。
 *
 * - iOS 全系：一律原生。iOS ≤16 没有 MSE（Hls.isSupported() 为 false，hls.js
 *   根本无法 attachMedia）；iOS 17.1+ 虽然有 ManagedMediaSource，但限制多
 *   （与 AirPlay 互斥、依赖 disableRemotePlayback 等），原生 HLS 更稳、省电、
 *   支持 AirPlay/画中画。代价是失去 hls.js 的清晰度切换按钮。
 * - 其他平台：有 MSE 仍走 hls.js；没有 MSE 但能原生播 m3u8（如桌面 Safari）
 *   则回退原生，避免和老 iOS 一样卡在加载中。
 */
export function shouldUseNativeHls(): boolean {
    if (isIOSDevice()) return true;
    if (typeof Hls === 'undefined' || !Hls.isSupported()) {
        return !!document.createElement('video').canPlayType('application/vnd.apple.mpegurl');
    }
    return false;
}

function createHlsConfig(): Record<string, unknown> {
    return {
        debug: false,
        loader: Hls.DefaultConfig.loader,
        enableWorker: true,
        lowLatencyMode: true,                   // 低延迟模式加速起播
        // 坏线路要快点失败，自动换线才接得上：清单 / 分片各只等 6～8s、只重试一次
        manifestLoadingTimeOut: 6000,
        levelLoadingTimeOut: 6000,
        fragLoadingTimeOut: 8000,
        startFragPrefetch: true,                // manifest 加载时预取首个分片（v1.4.0+）
        backBufferLength: 30,                   // 后向缓冲30秒，释放内存
        maxBufferLength: 30,                    // 前向缓冲30秒（约7~8个分片），抗跨境链路抖动
        maxMaxBufferLength: 300,
        maxBufferSize: 20 * 1000 * 1000,
        maxBufferHole: 0.3,                     // 减小缓冲空洞容忍度
        fragLoadingMaxRetry: 3,                 // 减少重试次数
        fragLoadingMaxRetryTimeout: 15000,
        fragLoadingRetryDelay: 500,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        startLevel: 1,                          // 从第二档清晰度起播（平衡速度与画质）
        abrEwmaDefaultEstimate: 2000000,        // 初始预估带宽2Mbps
        abrEwmaFastDefault: 3000000,            // 快速ABR默认3Mbps，更快切到高画质
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: true,
        stretchShortVideoTrack: true,
        appendErrorMaxRetry: 3,
        liveSyncDurationCount: 2,
        liveDurationInfinity: false
    };
}

function setupHlsCustomType(video: HTMLVideoElement, url: string, hlsConfig: Record<string, unknown>): void {
    // 由 PlayerManager 管理 HLS 生命周期
    PlayerManager.setHlsInstance(null);

    const hls = new Hls(hlsConfig);
    PlayerManager.setHlsInstance(hls);

    // 设置清晰度切换
    if (typeof setupQualitySwitcher === "function") setupQualitySwitcher(hls);

    let errorDisplayed = false;
    let errorCount = 0;
    let playbackStarted = false;
    let bufferAppendErrorCount = 0;

    video.addEventListener('playing', function () {
        playbackStarted = true;
        if (playerCoreWindow.LeLeFailover) playerCoreWindow.LeLeFailover.markPlaying();

        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
            setEpisodeSwitchTimeout(null);
        }
        playerCoreWindow.isSwitchingVideo = false;

        document.getElementById('error').style.display = 'none';
    });

    // 首次播放后隐藏错误提示，然后移除自身
    video.addEventListener('timeupdate', function onFirstTimeUpdate() {
        if (video.currentTime > 1) {
            document.getElementById('error').style.display = 'none';
            video.removeEventListener('timeupdate', onFirstTimeUpdate);
        }
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    // 注意：不要往 <video> 注入 <source>。
    // hls.js 已通过 attachMedia 设置 video.src = blob:（MSE），
    // 而 Chrome 不支持原生 HLS，多余的 <source> 只会引发一次注定失败的 m3u8 请求。
    //
    // 注意：不要写 video.disableRemotePlayback = false。
    // hls.js 在使用 ManagedMediaSource（iOS 17.1+ / 桌面 Safari）时会在 attachMedia
    // 内部把它置为 true（该模式与 AirPlay 远程播放互斥），而这行写在 attachMedia
    // 之后，会把 hls.js 的设置覆盖掉，导致 MSE 起播失败。

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(function (e: Error) {
            console.warn('[LeLeTV] 自动播放被浏览器阻止:', e.message);
        });
    });

    hls.on(Hls.Events.ERROR, function (event: unknown, data: HlsErrorData) {
        errorCount++;

        if (data.details === 'bufferAppendError') {
            bufferAppendErrorCount++;
            if (playbackStarted) {
                return;
            }
            if (bufferAppendErrorCount >= 3) {
                hls.recoverMediaError();
            }
        }

        if (data.fatal && !playbackStarted) {
            // 起播前线路就坏了：清单取不到（跨域被拦、404、超时）直接换线；分片连着失败两次也换；
            // 换不了（没有别的线路、已换满次数）才走原来的重试与报错
            const failover = playerCoreWindow.LeLeFailover;
            const manifestDead = /^(manifest|level)(Load|Parsing)/.test(data.details || '');
            const fragDead = /^frag(Load|Parsing)/.test(data.details || '') && errorCount >= 2;
            if (failover && data.type === Hls.ErrorTypes.NETWORK_ERROR && (manifestDead || fragDead)) {
                failover.autoSwitchLine('当前线路无法加载').then(function (switched) {
                    if (!switched) hls.startLoad();
                });
                return;
            }
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    if (failover && errorCount >= 3) {
                        failover.autoSwitchLine('当前线路的视频无法解码').then(function (switched) {
                            if (!switched) hls.recoverMediaError();
                        });
                        return;
                    }
                    hls.recoverMediaError();
                    break;
                default:
                    if (errorCount > 3 && !errorDisplayed) {
                        errorDisplayed = true;
                        showError('视频加载失败，可能是格式不兼容或源不可用');
                    }
                    break;
            }
        }
    });

    hls.on(Hls.Events.FRAG_LOADED, function () {

        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
            setEpisodeSwitchTimeout(null);
        }
        playerCoreWindow.isSwitchingVideo = false;

    });

    hls.on(Hls.Events.LEVEL_LOADED, function () {

        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
            setEpisodeSwitchTimeout(null);
        }
        playerCoreWindow.isSwitchingVideo = false;

    });
}

function createArtPlayerInstance(videoUrl: string, hlsConfig: Record<string, unknown>): ArtplayerInstance {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const useNativeHls = shouldUseNativeHls();

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
        autoMini: false,
        screenshot: true,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true,
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: !isMobile,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        hotkey: false,
        theme: (typeof themeColor === 'function') ? themeColor() : '#ec4899',
        lang: navigator.language.toLowerCase(),
        // 原生 HLS 路径不能带 crossOrigin：原生 <video> 会按 CORS 模式请求 m3u8，
        // 视频源未返回 Access-Control-Allow-Origin 时会被浏览器直接拦掉。
        moreVideoAttr: useNativeHls ? {} : {
            crossOrigin: 'anonymous',
        },
        // 不注册 customType.m3u8 时，ArtPlayer 会把 url 直接赋给 <video src>，
        // 交给系统原生 HLS 播放（见 shouldUseNativeHls）。
        customType: useNativeHls ? {} : {
            m3u8: function (video: HTMLVideoElement, url: string) {
                setupHlsCustomType(video, url, hlsConfig);
            }
        }
    });
}

function createFullScreenController(): FullScreenController {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let backBtnHideTimer: ReturnType<typeof setTimeout> | undefined;

    function hideControls(): void {
        if (art && art.controls) {
            art.controls.show = false;
        }
        hideBackBtn();
    }

    function showBackBtn(): void {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.add('show');
        clearTimeout(backBtnHideTimer);
        backBtnHideTimer = setTimeout(() => {
            hideBackBtn();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    function hideBackBtn(): void {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.remove('show');
        clearTimeout(backBtnHideTimer);
    }

    function resetHideTimer(): void {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hideControls();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    function handleMouseOut(e: MouseEvent): void {
        if (e && !e.relatedTarget) {
            resetHideTimer();
        }
    }

    function handleFullScreen(isFullScreen: boolean): void {
        const container = document.getElementById('playerContainer');
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

    return {
        hideControls,
        showBackBtn,
        hideBackBtn,
        resetHideTimer,
        handleFullScreen
    };
}

function onPlayerReady(art: ArtplayerInstance, fullScreenController: FullScreenController): void {
    fullScreenController.hideControls();

    const playerArea = document.querySelector('.player-layout-left');
    if (playerArea) {
        playerArea.addEventListener('mousemove', fullScreenController.showBackBtn);
    }

    if (window.screen && window.screen.orientation) {
        window.screen.orientation.addEventListener('change', function onOrientationChange() {
            if (window.innerWidth > 640 || window.innerHeight > 640) return;
            const isLandscape = window.screen.orientation.type.includes('landscape');
            if (isLandscape && !art.fullscreen) {
                setAutoFullscreened(true);
                art.fullscreen = true;
            } else if (!isLandscape && art.fullscreen && autoFullscreened) {
                art.fullscreen = false;
                setAutoFullscreened(false);
            }
        });
    }

    addNextEpisodeDirectly(art);
    addLockFloatingButton(art);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_TERTIARY);
}

function handleFullScreenChange(art: ArtplayerInstance, fullScreenController: FullScreenController, isFullScreen: boolean): void {
    fullScreenController.handleFullScreen(isFullScreen);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
}

function onPlayerRestart(art: ArtplayerInstance): void {
    if (episodeSwitchTimeout) {
        clearTimeout(episodeSwitchTimeout);
        setEpisodeSwitchTimeout(null);
    }
    playerCoreWindow.isSwitchingVideo = false;
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
}

function onVideoLoadedMetadata(art: ArtplayerInstance): void {

    if (episodeSwitchTimeout) {
        clearTimeout(episodeSwitchTimeout);
        setEpisodeSwitchTimeout(null);
    }
    playerCoreWindow.isSwitchingVideo = false;

    setVideoHasEnded(false);

    const urlParams = new URLSearchParams(window.location.search);
    const savedPosition = parseInt(urlParams.get('position') || '0');
    // 时长未知时不能 seek：iOS 原生 HLS / 事件型 m3u8 在 loadedmetadata 阶段还拿不到时长
    // （NaN / 0 / Infinity），此时设置 currentTime 会让播放器卡在加载中
    const duration = Number(art.duration);
    const durationKnown = Number.isFinite(duration) && duration > 0;
    const canRestore = (position: number) => durationKnown && position > 10 && position < duration - 2;

    if (canRestore(savedPosition)) {
        art.currentTime = savedPosition;
        showPositionRestoreHint(savedPosition);
    } else {
        try {
            const progressKey = 'videoProgress_' + getVideoId();
            const progressStr = localStorage.getItem(progressKey);
            if (progressStr) {
                const progress = JSON.parse(progressStr) as { position?: unknown };
                if (progress && typeof progress.position === 'number' && canRestore(progress.position)) {
                    art.currentTime = progress.position;
                    showPositionRestoreHint(progress.position);
                }
            }
        } catch (e) {
            console.warn('[LeLeTV] 解析本地播放进度失败:', e);
        }
    }

    setupProgressBarPreciseClicks();
    setTimeout(saveToHistory, TIMING.SAVE_HISTORY_DELAY);
    startProgressSaveInterval();
    updateMediaSession();
}

function onVideoError(error: { message?: string }): void {
    if (playerCoreWindow.isSwitchingVideo) {
        return;
    }

    showError('视频播放失败: ' + (error.message || '未知错误'));
}

function syncMediaSessionState(state: MediaSessionPlaybackState): void {
    if (navigator.mediaSession) {
        navigator.mediaSession.playbackState = state;
    }
}

function onVideoEnded(art: ArtplayerInstance): void {
    setVideoHasEnded(true);

    clearVideoProgress();

    if (autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1) {
        setTimeout(() => {
            advanceEpisode();
            setVideoHasEnded(false);
        }, 1000);
    } else {
        art.fullscreen = false;
    }
}

function setupPlayerEventListeners(art: ArtplayerInstance, fullScreenController: FullScreenController): void {
    art.on('ready', () => {
        onPlayerReady(art, fullScreenController);
    });

    art.on('fullscreenWeb', function (isFullScreen: boolean) {
        handleFullScreenChange(art, fullScreenController, isFullScreen);
    });

    art.on('fullscreen', function (isFullScreen: boolean) {
        // 浏览器全屏 API（requestFullscreen）由浏览器管理全屏元素
        // 不切换 fullscreen-active，避免 main.container display:none 影响恢复
        // 只需处理下一集按钮
        setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
        setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
    });

    art.on('restart', () => {
        onPlayerRestart(art);
    });

    art.on('video:loadedmetadata', function () {
        onVideoLoadedMetadata(art);
    });

    art.on('video:error', function (error: { message?: string }) {
        onVideoError(error);
    });

    art.on('video:pause', () => {
        syncMediaSessionState('paused');
    });

    art.on('video:playing', () => {
        syncMediaSessionState('playing');
    });

    art.on('video:ended', function () {
        onVideoEnded(art);
    });
}

/**
 * 监听浏览器原生全屏变化（区别于 ArtPlayer 的 fullscreen/fullscreenWeb）
 * 用于在华为等浏览器原生视频播放器全屏时关闭高耗 CSS 效果，防止卡顿和屏闪
 */
function setupNativeFullscreenHandler(): void {
    function onNativeFullScreenChange(): void {
        const fsElement = document.fullscreenElement
            || (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
        const isNativeFullscreen = !!fsElement;

        // 排除 ArtPlayer 自身的全屏：ArtPlayer 在播放器容器上调用 requestFullscreen
        if (isNativeFullscreen) {
            const playerContainer = document.getElementById('playerContainer') || document.getElementById('player');
            if (playerContainer && (playerContainer === fsElement || playerContainer.contains(fsElement))) {
                return;
            }
        }

        document.body.classList.toggle('native-fs-active', isNativeFullscreen);
    }

    document.addEventListener('fullscreenchange', onNativeFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onNativeFullScreenChange);
}

export function initPlayer(videoUrl: string): void {
    if (!videoUrl) {
        return
    }

    // 由 PlayerManager 统一销毁旧实例
    PlayerManager.destroy();

    const hlsConfig = createHlsConfig();

    setArt(createArtPlayerInstance(videoUrl, hlsConfig));
    PlayerManager.setInstance(art);
    if (playerCoreWindow.LeLeFailover) playerCoreWindow.LeLeFailover.watch(art);

    const fullScreenController = createFullScreenController();

    setupPlayerEventListeners(art, fullScreenController);

    setupNativeFullscreenHandler();

    setupLongPressSpeedControl();

    setupControlsBehavior();
}

// 阶段 5A-6 过渡期兼容桥：player bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  shouldUseNativeHls,
  initPlayer
});

// 阶段 5B-2 过渡期类型桥：core.ts 已成为 ESM 模块，未改造的 player 模块仍以裸名
// 访问这些函数与类型（运行时由上方 window 兼容桥提供）。5B-3 改为 import 后删除。
declare global {
  function shouldUseNativeHls(): boolean;
  function initPlayer(videoUrl: string): void;
  interface HlsInstance {
    loadSource(url: string): void;
    attachMedia(video: HTMLVideoElement): void;
    on(event: string, handler: (...args: never[]) => void): void;
    startLoad(): void;
    recoverMediaError(): void;
    destroy(): void;
  }
  interface ArtplayerInstance {
    on(event: string, handler: (...args: never[]) => void): void;
    controls: { show: boolean };
    fullscreen: boolean;
    currentTime: number;
    duration: number;
  }
  interface ArtplayerStatic {
    new (options: Record<string, unknown>): ArtplayerInstance;
    CONTROL_HIDE_TIME: number;
  }
  interface HlsStatic {
    new (config: Record<string, unknown>): HlsInstance;
    isSupported(): boolean;
    DefaultConfig: { loader: unknown };
    Events: Record<string, string>;
    ErrorTypes: Record<string, string>;
  }
  const Hls: HlsStatic;
  const Artplayer: ArtplayerStatic;
  interface FailoverApi {
    markPlaying(): void;
    watch(art: unknown): void;
    autoSwitchLine(reason: string): Promise<boolean>;
  }
}
