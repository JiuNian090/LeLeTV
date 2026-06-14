// LeLeTV — 播放器核心模块
// HLS + ArtPlayer + 全屏 + 事件处理

function createHlsConfig() {
    return {
        debug: false,
        loader: adFilteringEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
        enableWorker: true,
        lowLatencyMode: true,                   // 低延迟模式加速起播
        startFragPrefetch: true,                // manifest 加载时预取首个分片（v1.4.0+）
        backBufferLength: 30,                   // 后向缓冲30秒，释放内存
        maxBufferLength: 20,                    // 减小前向缓冲，更快开始播放
        maxMaxBufferLength: 40,
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

/* ===== 每集元数据：由 playEpisode() 在切集前写入，createArtPlayerInstance 读取 ===== */
// 画质选项：[{ label: '1080P', url: 'xxx.m3u8', default: true }]
var currentEpisodeQualities = [];
// 章节标记：[{ time: 90, text: '片头曲结束' }]
var currentEpisodeHighlights = [];
// 跳过片头/片尾配置
var skipIntroEnabled = true;
var skipIntroTime = 90;         // 片头秒数，从 0s 跳到此时间
var skipEndingEnabled = true;
var skipEndingTime = 120;       // 片尾开始前的秒数（distance from duration）

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
        autoPlayback: true,          // 原生记忆播放位置/倍速
        airplay: true,
        hotkey: true,                // 原生快捷键（空格/方向键/F/M 等）
        theme: '#ec4899',
        lang: navigator.language.toLowerCase(),
        moreVideoAttr: {
            crossOrigin: 'anonymous',
        },
        // ===== 原生设置面板扩展项 =====
        settings: [
            {
                html: '自动连播下一集',
                tooltip: autoplayEnabled ? '已开启' : '已关闭',
                switch: !!autoplayEnabled,
                onSwitch: function (item) {
                    autoplayEnabled = item.switch;
                    item.tooltip = item.switch ? '已开启' : '已关闭';
                }
            },
            {
                html: '跳过片头',
                tooltip: skipIntroEnabled ? '已开启（' + skipIntroTime + 's）' : '已关闭',
                switch: skipIntroEnabled,
                onSwitch: function (item) {
                    skipIntroEnabled = item.switch;
                    item.tooltip = skipIntroEnabled ? '已开启（' + skipIntroTime + 's）' : '已关闭';
                }
            },
            {
                html: '跳过片尾',
                tooltip: skipEndingEnabled ? '已开启（' + skipEndingTime + 's）' : '已关闭',
                switch: skipEndingEnabled,
                onSwitch: function (item) {
                    skipEndingEnabled = item.switch;
                    item.tooltip = skipEndingEnabled ? '已开启（' + skipEndingTime + 's）' : '已关闭';
                }
            },
            {
                html: '播放速度',
                tooltip: '1.0x',
                selector: [0.5, 0.75, 1, 1.25, 1.5, 2],
                onSelect: function (item) {
                    if (art && art.video) art.video.playbackRate = item.html;
                    item.tooltip = item.html + 'x';
                    return item.html;
                }
            }
        ],
        // ===== 章节标记（由 playEpisode 填充，没数据就不显示）=====
        highlight: currentEpisodeHighlights && currentEpisodeHighlights.length ? currentEpisodeHighlights : [],
        // ===== 画质选项（由 playEpisode 填充，没数据就不显示切换）=====
        quality: currentEpisodeQualities && currentEpisodeQualities.length ? currentEpisodeQualities : [],
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

    // 用 ArtPlayer 原生 API 注册自定义控件（一次性，不再需要反复重建）
    if (typeof setupCustomControls === 'function') {
        setupCustomControls(art);
    }
    if (typeof refreshEpisodeButtons === 'function') {
        refreshEpisodeButtons(art);
    }
}

function handleFullScreenChange(art, fullScreenController, isFullScreen) {
    fullScreenController.handleFullScreen(isFullScreen);
    // 原生控件由 ArtPlayer 生命周期管理，无需在全屏切换后重建
}

function onPlayerRestart(art) {
    if (episodeSwitchTimeout) {
        clearTimeout(episodeSwitchTimeout);
        episodeSwitchTimeout = null;
    }
    window.isSwitchingVideo = false;
    // 刷新集数按钮状态（切源后确保禁用逻辑正确）
    if (typeof refreshEpisodeButtons === 'function') {
        refreshEpisodeButtons(art);
    }
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
        // 原生控件由 ArtPlayer 管理，无需重建按钮
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

/**
 * 监听浏览器原生全屏变化（区别于 ArtPlayer 的 fullscreen/fullscreenWeb）
 * 用于在华为等浏览器原生视频播放器全屏时关闭高耗 CSS 效果，防止卡顿和屏闪
 */
function setupNativeFullscreenHandler() {
    function onNativeFullScreenChange() {
        const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
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

    setupNativeFullscreenHandler();

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