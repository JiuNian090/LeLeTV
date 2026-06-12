// LeLeTV — 播放器核心模块
// HLS + ArtPlayer + 全屏 + 事件处理

function createHlsConfig() {
    return {
        debug: false,
        loader: adFilteringEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
        enableWorker: true,
        lowLatencyMode: true,           // 低延迟模式加速起播
        backBufferLength: 60,           // 减小后向缓冲释放内存
        maxBufferLength: 20,            // 减小前向缓冲，更快开始播放
        maxMaxBufferLength: 40,
        maxBufferSize: 20 * 1000 * 1000,
        maxBufferHole: 0.3,             // 减小缓冲空洞容忍度
        fragLoadingMaxRetry: 3,         // 减少重试次数
        fragLoadingMaxRetryTimeout: 15000,
        fragLoadingRetryDelay: 500,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        startLevel: 1,                  // 从第二档清晰度起播（平衡速度与画质）
        abrEwmaDefaultEstimate: 2000000, // 预估带宽从2Mbps开始，提升初始画质
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: true,
        stretchShortVideoTrack: true,
        appendErrorMaxRetry: 3,
        liveSyncDurationCount: 2,
        liveDurationInfinity: false
    };
}

function setupHlsCustomType(video, url, hlsConfig, loadingWatchdog) {
    // 由 PlayerManager 管理 HLS 生命周期
    PlayerManager.setHlsInstance(null);

    const hls = new Hls(hlsConfig);
    PlayerManager.setHlsInstance(hls);

    let errorDisplayed = false;
    let errorCount = 0;
    let playbackStarted = false;
    let bufferAppendErrorCount = 0;

    video.addEventListener('playing', function () {
        playbackStarted = true;
        clearTimeout(loadingWatchdog);
        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
            episodeSwitchTimeout = null;
        }
        window.isSwitchingVideo = false;
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
    });

    video.addEventListener('timeupdate', function () {
        if (video.currentTime > 1) {
            document.getElementById('error').style.display = 'none';
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

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(e => {
        });
    });

    hls.on(Hls.Events.ERROR, function (event, data) {
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
                        showError('视频加载失败，可能是格式不兼容或源不可用');
                    }
                    break;
            }
        }
    });

    hls.on(Hls.Events.FRAG_LOADED, function () {
        clearTimeout(loadingWatchdog);
        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
            episodeSwitchTimeout = null;
        }
        window.isSwitchingVideo = false;
        document.getElementById('player-loading').style.display = 'none';
    });

    hls.on(Hls.Events.LEVEL_LOADED, function () {
        clearTimeout(loadingWatchdog);
        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
            episodeSwitchTimeout = null;
        }
        window.isSwitchingVideo = false;
        document.getElementById('player-loading').style.display = 'none';
    });
}

function createArtPlayerInstance(videoUrl, hlsConfig, loadingWatchdog) {
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
        moreVideoAttr: {
            crossOrigin: 'anonymous',
        },
        customType: {
            m3u8: function (video, url) {
                setupHlsCustomType(video, url, hlsConfig, loadingWatchdog);
            }
        }
    });
}

function createFullScreenController() {
    let hideTimer;
    let backBtnHideTimer;

    function hideControls() {
        if (art && art.controls) {
            art.controls.show = false;
        }
        hideBackBtn();
    }

    function showBackBtn() {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.add('show');
        clearTimeout(backBtnHideTimer);
        backBtnHideTimer = setTimeout(() => {
            hideBackBtn();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    function hideBackBtn() {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.remove('show');
        clearTimeout(backBtnHideTimer);
    }

    function resetHideTimer() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hideControls();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    function handleMouseOut(e) {
        if (e && !e.relatedTarget) {
            resetHideTimer();
        }
    }

    function handleFullScreen(isFullScreen) {
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
            autoFullscreened = false;
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

function onPlayerReady(art, fullScreenController) {
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
                autoFullscreened = true;
                art.fullscreen = true;
            } else if (!isLandscape && art.fullscreen && autoFullscreened) {
                art.fullscreen = false;
                autoFullscreened = false;
            }
        });
    }

    addNextEpisodeDirectly(art);
    addLockFloatingButton(art);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_TERTIARY);
}

function handleFullScreenChange(art, fullScreenController, isFullScreen) {
    fullScreenController.handleFullScreen(isFullScreen);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
}

function onPlayerRestart(art) {
    if (episodeSwitchTimeout) {
        clearTimeout(episodeSwitchTimeout);
        episodeSwitchTimeout = null;
    }
    window.isSwitchingVideo = false;
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_DELAY);
    setTimeout(() => addNextEpisodeDirectly(art), TIMING.NEXT_EPISODE_BTN_SECONDARY);
}

function onVideoLoadedMetadata(art, loadingWatchdog) {
    clearTimeout(loadingWatchdog);
    if (episodeSwitchTimeout) {
        clearTimeout(episodeSwitchTimeout);
        episodeSwitchTimeout = null;
    }
    window.isSwitchingVideo = false;
    document.getElementById('player-loading').style.display = 'none';
    videoHasEnded = false;

    const urlParams = new URLSearchParams(window.location.search);
    const savedPosition = parseInt(urlParams.get('position') || '0');

    if (savedPosition > 10 && savedPosition < art.duration - 2) {
        art.currentTime = savedPosition;
        showPositionRestoreHint(savedPosition);
    } else {
        try {
            const progressKey = 'videoProgress_' + getVideoId();
            const progressStr = localStorage.getItem(progressKey);
            if (progressStr && art.duration > 0) {
                const progress = JSON.parse(progressStr);
                if (
                    progress &&
                    typeof progress.position === 'number' &&
                    progress.position > 10 &&
                    progress.position < art.duration - 2
                ) {
                    art.currentTime = progress.position;
                    showPositionRestoreHint(progress.position);
                }
            }
        } catch (e) {
        }
    }

    setupProgressBarPreciseClicks();
    setTimeout(saveToHistory, TIMING.SAVE_HISTORY_DELAY);
    startProgressSaveInterval();
    updateMediaSession();
}

function onVideoError(error) {
    if (window.isSwitchingVideo) {
        return;
    }

    const loadingElements = document.querySelectorAll('#player-loading, .player-loading-container');
    loadingElements.forEach(el => {
        if (el) el.style.display = 'none';
    });

    showError('视频播放失败: ' + (error.message || '未知错误'));
}

function syncMediaSessionState(state) {
    if (navigator.mediaSession) {
        navigator.mediaSession.playbackState = state;
    }
}

function onVideoEnded(art) {
    videoHasEnded = true;

    clearVideoProgress();

    if (autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1) {
        setTimeout(() => {
            playNextEpisode();
            videoHasEnded = false;
        }, 1000);
    } else {
        art.fullscreen = false;
    }
}

function setupPlayerEventListeners(art, fullScreenController, loadingWatchdog) {
    art.on('ready', () => {
        onPlayerReady(art, fullScreenController);
    });

    art.on('fullscreenWeb', function (isFullScreen) {
        handleFullScreenChange(art, fullScreenController, isFullScreen);
    });

    art.on('fullscreen', function (isFullScreen) {
        handleFullScreenChange(art, fullScreenController, isFullScreen);
    });

    art.on('restart', () => {
        onPlayerRestart(art);
    });

    art.on('video:loadedmetadata', function() {
        onVideoLoadedMetadata(art, loadingWatchdog);
    });

    art.on('video:error', function (error) {
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

function setupLongLoadingWarning() {
    setTimeout(function () {
        if (art && art.video && art.video.currentTime > 0) {
            return;
        }

        const loadingElement = document.getElementById('player-loading');
        if (loadingElement && loadingElement.style.display !== 'none') {
            loadingElement.innerHTML = `
                <div class="loading-spinner"></div>
                <div>视频加载时间较长，请耐心等待...</div>
                <div style="font-size: 12px; color: #aaa; margin-top: 10px;">如长时间无响应，请尝试其他视频源</div>
            `;
        }
    }, 10000);
}

function initPlayer(videoUrl) {
    if (!videoUrl) {
        return
    }

    const loadingWatchdog = setTimeout(function () {
        const loadingEl = document.getElementById('player-loading');
        if (loadingEl && loadingEl.style.display !== 'none' && loadingEl.style.display !== '') {
            loadingEl.style.display = 'none';
        }
    }, TIMING.PLAYER_LOADING_WATCHDOG);

    // 由 PlayerManager 统一销毁旧实例
    PlayerManager.destroy();

    const hlsConfig = createHlsConfig();

    art = createArtPlayerInstance(videoUrl, hlsConfig, loadingWatchdog);
    PlayerManager.setInstance(art);

    const fullScreenController = createFullScreenController();

    setupPlayerEventListeners(art, fullScreenController, loadingWatchdog);

    setupLongPressSpeedControl();

    setupThumbnailCapture();

    setupControlsBehavior();

    setupLongLoadingWarning();
}

class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (context, config, callbacks) {
            // 拦截manifest和level请求
            if (context.type === 'manifest' || context.type === 'level') {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function (response, stats, context) {
                    // 如果是m3u8文件，处理内容以移除广告分段
                    if (response.data && typeof response.data === 'string') {
                        // 过滤掉广告段 - 实现更精确的广告过滤逻辑
                        response.data = filterAdsFromM3U8(response.data, true);
                    }
                    return onSuccess(response, stats, context);
                };
            }
            // 执行原始load方法
            load(context, config, callbacks);
        };
    }
}

function filterAdsFromM3U8(m3u8Content, strictMode = false) {
    if (!m3u8Content) return '';

    // 按行分割M3U8内容
    const lines = m3u8Content.split('\n');
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 只过滤#EXT-X-DISCONTINUITY标识
        if (!line.includes('#EXT-X-DISCONTINUITY')) {
            filteredLines.push(line);
        }
    }

    return filteredLines.join('\n');
}