// 全屏时退出全屏返回播放页，非全屏时返回首页
function goHome(event) {
    if (event) event.preventDefault();

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        autoFullscreened = false;
        return;
    }

    if (art) {
        art.destroy();
        art = null;
    }
    if (currentHls) {
        try { currentHls.destroy(); } catch (e) {}
        currentHls = null;
    }

    window.location.href = '/';
}

// 页面加载时保存当前播放状态
window.addEventListener('load', function () {
    // 提取当前URL中的重要参数，以便在需要时能够恢复当前页面
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    const sourceCode = urlParams.get('source');

    if (videoId && sourceCode) {
        // 保存当前播放状态
        localStorage.setItem('currentPlayingId', videoId);
        localStorage.setItem('currentPlayingSource', sourceCode);
    }
});


// =================================
// ============== PLAYER ==========
// =================================
// 全局变量
let currentVideoTitle = '';
let currentEpisodeIndex = 0;
let art = null; // 用于 ArtPlayer 实例
let currentHls = null; // 跟踪当前HLS实例
let currentEpisodes = [];
let episodesReversed = false;
let autoplayEnabled = true; // 默认开启自动连播
let videoHasEnded = false; // 跟踪视频是否已经自然结束
let userClickedPosition = null; // 记录用户点击的位置
let shortcutHintTimeout = null; // 用于控制快捷键提示显示时间
let autoFullscreened = false; // 标记是否由自动全屏进入
let adFilteringEnabled = true; // 默认开启广告过滤
let progressSaveInterval = null; // 定期保存进度的计时器
let currentVideoUrl = ''; // 记录当前实际的视频URL
Artplayer.FULLSCREEN_WEB_IN_BODY = true;

// TMDB 影片详情配置（TMDB优先，视频源API兜底）
const PLAYER_TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function getPlayerTmdbBaseUrl() {
  if (typeof TMDB_WORKER_URL !== 'undefined' && TMDB_WORKER_URL) {
    return TMDB_WORKER_URL;
  }
  return '/api/tmdb';
}

async function fetchTmdbPlayerDetail(title) {
  try {
    const baseUrl = getPlayerTmdbBaseUrl();
    if (!baseUrl) return null;

    const multiUrl = `${baseUrl}?endpoint=search/multi&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
    const res = await fetch(multiUrl);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const result = data.results.find(r => r.media_type === 'movie' || r.media_type === 'tv');
    if (!result) return null;

    const mediaType = result.media_type;
    const id = result.id;

    const [detailRes, creditsRes] = await Promise.all([
      fetch(`${baseUrl}?endpoint=${mediaType}/${id}&language=zh-CN`),
      fetch(`${baseUrl}?endpoint=${mediaType}/${id}/credits&language=zh-CN`)
    ]);

    if (!detailRes.ok) return null;

    const [detail, credits] = await Promise.all([
      detailRes.json(),
      creditsRes.ok ? creditsRes.json() : Promise.resolve({ crew: [], cast: [] })
    ]);

    const isMovie = mediaType === 'movie';
    const director = credits.crew?.find(c => c.job === 'Director')?.name || '';
    const actors = credits.cast?.slice(0, 5).map(c => c.name).join(' / ') || '';
    const genres = detail.genres?.map(g => g.name).join(' / ') || '';
    const countries = detail.production_countries?.map(c => c.name).join(' / ') || '';
    const year = isMovie
      ? (detail.release_date?.split('-')[0] || '')
      : (detail.first_air_date?.split('-')[0] || '');
    const posterPath = detail.poster_path
      ? `${PLAYER_TMDB_IMAGE_BASE}/w342${detail.poster_path}`
      : '';

    return {
      title: isMovie ? detail.title : detail.name,
      cover: posterPath,
      desc: detail.overview || '',
      type: genres,
      year: year,
      area: countries,
      director: director,
      actor: actors,
      fromTmdb: true
    };
  } catch (e) {
    console.warn('获取TMDB详情失败，使用视频源API数据:', e);
    return null;
  }
}

// 页面加载
document.addEventListener('DOMContentLoaded', function () {
    // 先检查用户是否已通过密码验证
    if (!isPasswordVerified()) {
        // 隐藏加载提示
        document.getElementById('player-loading').style.display = 'none';
        return;
    }

    initializePageContent();
});

// 监听密码验证成功事件
document.addEventListener('passwordVerified', () => {
    document.getElementById('player-loading').style.display = 'block';

    initializePageContent();
});

// 初始化页面内容
function initializePageContent() {

    // 解析URL参数
    const urlParams = new URLSearchParams(window.location.search);
    let videoUrl = urlParams.get('url');
    const title = urlParams.get('title');
    const sourceCode = urlParams.get('source');
    let index = parseInt(urlParams.get('index') || '0');
    const episodesList = urlParams.get('episodes'); // 从URL获取集数信息
    const savedPosition = parseInt(urlParams.get('position') || '0'); // 获取保存的播放位置
    // 解决历史记录问题：检查URL是否是player.html开头的链接
    // 如果是，说明这是历史记录重定向，需要解析真实的视频URL
    if (videoUrl && videoUrl.includes('player.html')) {
        try {
            // 尝试从嵌套URL中提取真实的视频链接
            const nestedUrlParams = new URLSearchParams(videoUrl.split('?')[1]);
            // 从嵌套参数中获取真实视频URL
            const nestedVideoUrl = nestedUrlParams.get('url');
            // 检查嵌套URL是否包含播放位置信息
            const nestedPosition = nestedUrlParams.get('position');
            const nestedIndex = nestedUrlParams.get('index');
            const nestedTitle = nestedUrlParams.get('title');

            if (nestedVideoUrl) {
                videoUrl = nestedVideoUrl;

                // 更新当前URL参数
                const url = new URL(window.location.href);
                if (!urlParams.has('position') && nestedPosition) {
                    url.searchParams.set('position', nestedPosition);
                }
                if (!urlParams.has('index') && nestedIndex) {
                    url.searchParams.set('index', nestedIndex);
                }
                if (!urlParams.has('title') && nestedTitle) {
                    url.searchParams.set('title', nestedTitle);
                }
                // 替换当前URL
                window.history.replaceState({}, '', url);
            } else {
                showError('历史记录链接无效，请返回首页重新访问');
            }
        } catch (e) {
        }
    }

    // 保存当前视频URL
    currentVideoUrl = videoUrl || '';

    // 从localStorage获取数据
    currentVideoTitle = title || localStorage.getItem('currentVideoTitle') || '未知视频';
    currentEpisodeIndex = index;

    // 设置自动连播开关状态
    autoplayEnabled = localStorage.getItem('autoplayEnabled') !== 'false'; // 默认为true
    document.getElementById('autoplayToggle').checked = autoplayEnabled;

    // 获取广告过滤设置
    adFilteringEnabled = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true

    // 监听自动连播开关变化
    document.getElementById('autoplayToggle').addEventListener('change', function (e) {
        autoplayEnabled = e.target.checked;
        localStorage.setItem('autoplayEnabled', autoplayEnabled);
    });

    // 优先使用URL传递的集数信息，否则从localStorage获取
    try {
        if (episodesList) {
            // 如果URL中有集数数据，优先使用它
            currentEpisodes = JSON.parse(decodeURIComponent(episodesList));

        } else {
            // 否则从localStorage获取
            currentEpisodes = JSON.parse(localStorage.getItem('currentEpisodes') || '[]');

        }

        // 检查集数索引是否有效，如果无效则调整为0
        if (index < 0 || (currentEpisodes.length > 0 && index >= currentEpisodes.length)) {
            // 如果索引太大，则使用最大有效索引
            if (index >= currentEpisodes.length && currentEpisodes.length > 0) {
                index = currentEpisodes.length - 1;
            } else {
                index = 0;
            }

            // 更新URL以反映修正后的索引
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('index', index);
            window.history.replaceState({}, '', newUrl);
        }

        // 更新当前索引为验证过的值
        currentEpisodeIndex = index;

        episodesReversed = localStorage.getItem('episodesReversed') === 'true';
    } catch (e) {
        currentEpisodes = [];
        currentEpisodeIndex = 0;
        episodesReversed = false;
    }

    // 设置页面标题
    document.title = currentVideoTitle + ' - LeLeTV播放器';
    const videoTitle = document.getElementById('videoTitle');
    if (videoTitle) videoTitle.textContent = currentVideoTitle;
    const videoTitleRight = document.getElementById('videoTitleRight');
    if (videoTitleRight) videoTitleRight.textContent = currentVideoTitle;

    // 渲染视频详情信息（先用视频源API数据）
    renderPlayerDetailInfo();

    // 异步获取TMDB数据增强详情（TMDB优先，API源数据兜底）
    fetchTmdbPlayerDetail(currentVideoTitle).then(tmdbInfo => {
      if (tmdbInfo) {
        let existingInfo = null;
        try {
          const stored = localStorage.getItem('currentVideoInfo');
          if (stored) existingInfo = JSON.parse(stored);
        } catch (e) {}

        const mergedInfo = {
          ...(existingInfo || {}),
          ...tmdbInfo,
          remarks: existingInfo?.remarks || '',
          source_name: existingInfo?.source_name || '',
          source_code: existingInfo?.source_code || ''
        };

        localStorage.setItem('currentVideoInfo', JSON.stringify(mergedInfo));
        renderPlayerDetailInfo();

        // 同步封面到观看历史记录
        if (tmdbInfo.cover) {
          try {
            const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
            const idx = history.findIndex(item => item.title === currentVideoTitle);
            if (idx !== -1) {
              history[idx].cover = tmdbInfo.cover;
              localStorage.setItem('viewingHistory', JSON.stringify(history));
            }
          } catch (e) {}
        }
      }
    });

    // 初始化播放器
    if (videoUrl) {
        initPlayer(videoUrl);
    } else {
        showError('无效的视频链接');
    }

    // 渲染源信息
    renderResourceInfoBar();

    // 更新集数信息
    updateEpisodeInfo();

    // 渲染集数列表
    renderEpisodes();

    // 初始化选集区域折叠状态（横屏展开，移动端折叠）
    updateEpisodeCollapseState();

    // 更新按钮状态
    updateButtonStates();

    // 更新排序按钮状态
    updateOrderButton();

    // 添加对进度条的监听，确保点击准确跳转
    setTimeout(() => {
        setupProgressBarPreciseClicks();
    }, 1000);

    // 添加键盘快捷键事件监听
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // 添加页面离开事件监听，保存播放位置
    window.addEventListener('beforeunload', saveCurrentProgress);

    // 新增：页面隐藏（切后台/切标签）时也保存
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            saveCurrentProgress();
        }
    });

    // 视频暂停时也保存
    const waitForVideo = setInterval(() => {
        if (art && art.video) {
            art.video.addEventListener('pause', saveCurrentProgress);

            // 新增：播放进度变化时节流保存
            let lastSave = 0;
            art.video.addEventListener('timeupdate', function() {
                const now = Date.now();
                if (now - lastSave > 5000) { // 每5秒最多保存一次
                    saveCurrentProgress();
                    lastSave = now;
                }
            });

            clearInterval(waitForVideo);
        }
    }, 200);
}

// 处理键盘快捷键
function handleKeyboardShortcuts(e) {
    // 忽略输入框中的按键事件
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
        if (currentEpisodeIndex > 0) {
            playPreviousEpisode();
            showShortcutHint('上一集', 'left');
            e.preventDefault();
        }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
        if (currentEpisodeIndex < currentEpisodes.length - 1) {
            playNextEpisode();
            showShortcutHint('下一集', 'right');
            e.preventDefault();
        }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
        if (art && art.currentTime > 5) {
            art.currentTime -= 5;
            showShortcutHint('快退', 'left');
            e.preventDefault();
        }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
        if (art && art.currentTime < art.duration - 5) {
            art.currentTime += 5;
            showShortcutHint('快进', 'right');
            e.preventDefault();
        }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
        if (art && art.volume < 1) {
            art.volume += 0.1;
            showShortcutHint('音量+', 'up');
            e.preventDefault();
        }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
        if (art && art.volume > 0) {
            art.volume -= 0.1;
            showShortcutHint('音量-', 'down');
            e.preventDefault();
        }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
        if (art) {
            art.toggle();
            showShortcutHint('播放/暂停', 'play');
            e.preventDefault();
        }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
        if (art) {
            art.fullscreen = !art.fullscreen;
            showShortcutHint('切换全屏', 'fullscreen');
            e.preventDefault();
        }
    }
}

// 显示快捷键提示
function showShortcutHint(text, direction) {
    const hintElement = document.getElementById('shortcutHint');
    const textElement = document.getElementById('shortcutText');
    const iconElement = document.getElementById('shortcutIcon');

    // 清除之前的超时
    if (shortcutHintTimeout) {
        clearTimeout(shortcutHintTimeout);
    }

    // 设置文本和图标方向
    textElement.textContent = text;

    if (direction === 'left') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>';
    } else if (direction === 'right') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
    }  else if (direction === 'up') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>';
    } else if (direction === 'down') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    } else if (direction === 'fullscreen') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5"></path>';
    } else if (direction === 'play') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>';
    }

    // 显示提示
    hintElement.classList.add('show');

    // 两秒后隐藏
    shortcutHintTimeout = setTimeout(() => {
        hintElement.classList.remove('show');
    }, 2000);
}

// 初始化播放器
function initPlayer(videoUrl) {
    if (!videoUrl) {
        return
    }

    // 销毁旧实例
    if (art) {
        art.destroy();
        art = null;
    }

    // 配置HLS.js选项
    const hlsConfig = {
        debug: false,
        loader: adFilteringEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferHole: 0.5,
        fragLoadingMaxRetry: 6,
        fragLoadingMaxRetryTimeout: 64000,
        fragLoadingRetryDelay: 1000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        startLevel: -1,
        abrEwmaDefaultEstimate: 500000,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: true,
        stretchShortVideoTrack: true,
        appendErrorMaxRetry: 5,  // 增加尝试次数
        liveSyncDurationCount: 3,
        liveDurationInfinity: false
    };

    // Create new ArtPlayer instance
    art = new Artplayer({
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
                // 清理之前的HLS实例
                if (currentHls && currentHls.destroy) {
                    try {
                        currentHls.destroy();
                    } catch (e) {
                    }
                }

                // 创建新的HLS实例
                const hls = new Hls(hlsConfig);
                currentHls = hls;

                // 跟踪是否已经显示错误
                let errorDisplayed = false;
                // 跟踪是否有错误发生
                let errorCount = 0;
                // 跟踪视频是否开始播放
                let playbackStarted = false;
                // 跟踪视频是否出现bufferAppendError
                let bufferAppendErrorCount = 0;

                // 监听视频播放事件
                video.addEventListener('playing', function () {
                    playbackStarted = true;
                    document.getElementById('player-loading').style.display = 'none';
                    document.getElementById('error').style.display = 'none';
                });

                // 监听视频进度事件
                video.addEventListener('timeupdate', function () {
                    if (video.currentTime > 1) {
                        // 视频进度超过1秒，隐藏错误（如果存在）
                        document.getElementById('error').style.display = 'none';
                    }
                });

                hls.loadSource(url);
                hls.attachMedia(video);

                // enable airplay, from https://github.com/video-dev/hls.js/issues/5989
                // 检查是否已存在source元素，如果存在则更新，不存在则创建
                let sourceElement = video.querySelector('source');
                if (sourceElement) {
                    // 更新现有source元素的URL
                    sourceElement.src = videoUrl;
                } else {
                    // 创建新的source元素
                    sourceElement = document.createElement('source');
                    sourceElement.src = videoUrl;
                    video.appendChild(sourceElement);
                }
                video.disableRemotePlayback = false;

                hls.on(Hls.Events.MANIFEST_PARSED, function () {
                    video.play().catch(e => {
                    });
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    // 增加错误计数
                    errorCount++;

                    // 处理bufferAppendError
                    if (data.details === 'bufferAppendError') {
                        bufferAppendErrorCount++;
                        // 如果视频已经开始播放，则忽略这个错误
                        if (playbackStarted) {
                            return;
                        }

                        // 如果出现多次bufferAppendError但视频未播放，尝试恢复
                        if (bufferAppendErrorCount >= 3) {
                            hls.recoverMediaError();
                        }
                    }

                    // 如果是致命错误，且视频未播放
                    if (data.fatal && !playbackStarted) {
                        // 尝试恢复错误
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                // 仅在多次恢复尝试后显示错误
                                if (errorCount > 3 && !errorDisplayed) {
                                    errorDisplayed = true;
                                    showError('视频加载失败，可能是格式不兼容或源不可用');
                                }
                                break;
                        }
                    }
                });

                // 监听分段加载事件
                hls.on(Hls.Events.FRAG_LOADED, function () {
                    document.getElementById('player-loading').style.display = 'none';
                });

                // 监听级别加载事件
                hls.on(Hls.Events.LEVEL_LOADED, function () {
                    document.getElementById('player-loading').style.display = 'none';
                });
            }
        }
    });

    // artplayer 没有 'fullscreenWeb:enter', 'fullscreenWeb:exit' 等事件
    // 所以原控制栏隐藏代码并没有起作用
    // 实际起作用的是 artplayer 默认行为，它支持自动隐藏工具栏
    // 但有一个 bug： 在副屏全屏时，鼠标移出副屏后不会自动隐藏工具栏
    // 下面进一并重构和修复：
    let hideTimer;
    let backBtnHideTimer;

    // 隐藏控制栏和返回按钮
    function hideControls() {
        if (art && art.controls) {
            art.controls.show = false;
        }
        hideBackBtn();
    }

    // 显示返回按钮
    function showBackBtn() {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.add('show');
        clearTimeout(backBtnHideTimer);
        backBtnHideTimer = setTimeout(() => {
            hideBackBtn();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    // 隐藏返回按钮
    function hideBackBtn() {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.remove('show');
        clearTimeout(backBtnHideTimer);
    }

    // 重置计时器，计时器超时时间与 artplayer 保持一致
    function resetHideTimer() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hideControls();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    // 处理鼠标离开浏览器窗口
    function handleMouseOut(e) {
        if (e && !e.relatedTarget) {
            resetHideTimer();
        }
    }

    // 全屏状态切换时注册/移除 mouseout 事件，监听鼠标移出屏幕事件
    // 从而对播放器状态栏进行隐藏倒计时
    function handleFullScreen(isFullScreen, isWeb) {
        if (isFullScreen) {
            document.addEventListener('mouseout', handleMouseOut);
        } else {
            document.removeEventListener('mouseout', handleMouseOut);
            // 退出全屏时清理计时器
            clearTimeout(hideTimer);
            clearTimeout(backBtnHideTimer);
            autoFullscreened = false;
        }
    }

    // 播放器加载完成后初始隐藏工具栏，并添加下一集按钮
    art.on('ready', () => {
        hideControls();

        // 鼠标滑过播放区域时显示返回按钮
        const playerArea = document.querySelector('.player-layout-left');
        if (playerArea) {
            playerArea.addEventListener('mousemove', showBackBtn);
        }

        // 手机横屏自动全屏
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

        // 直接尝试添加按钮
        addNextEpisodeDirectly(art);
        // 延迟后再次尝试
        setTimeout(() => addNextEpisodeDirectly(art), 300);
        setTimeout(() => addNextEpisodeDirectly(art), 800);
        setTimeout(() => addNextEpisodeDirectly(art), 1500);
    });

    // 全屏 Web 模式处理
    art.on('fullscreenWeb', function (isFullScreen) {
        handleFullScreen(isFullScreen, true);
        // 全屏切换后 ArtPlayer 会重建控制栏 DOM，重新插入下一集按钮
        setTimeout(() => addNextEpisodeDirectly(art), 300);
        setTimeout(() => addNextEpisodeDirectly(art), 800);
    });

    // 全屏模式处理
    art.on('fullscreen', function (isFullScreen) {
        handleFullScreen(isFullScreen, false);
        // 全屏切换后 ArtPlayer 会重建控制栏 DOM，重新插入下一集按钮
        setTimeout(() => addNextEpisodeDirectly(art), 300);
        setTimeout(() => addNextEpisodeDirectly(art), 800);
    });

    // URL 切换（切集/换源）后也检查一遍
    art.on('restart', () => {
        setTimeout(() => addNextEpisodeDirectly(art), 300);
        setTimeout(() => addNextEpisodeDirectly(art), 800);
    });

    art.on('video:loadedmetadata', function() {
        document.getElementById('player-loading').style.display = 'none';
        videoHasEnded = false; // 视频加载时重置结束标志
        // 优先使用URL传递的position参数
        const urlParams = new URLSearchParams(window.location.search);
        const savedPosition = parseInt(urlParams.get('position') || '0');

        if (savedPosition > 10 && savedPosition < art.duration - 2) {
            // 如果URL中有有效的播放位置参数，直接使用它
            art.currentTime = savedPosition;
            showPositionRestoreHint(savedPosition);
        } else {
            // 否则尝试从本地存储恢复播放进度
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

        // 设置进度条点击监听
        setupProgressBarPreciseClicks();

        // 视频加载成功后，在稍微延迟后将其添加到观看历史
        setTimeout(saveToHistory, 3000);

        // 启动定期保存播放进度
        startProgressSaveInterval();
        
        // 更新 Media Session 信息
        updateMediaSession();
        

    })

    // 错误处理
    art.on('video:error', function (error) {
        // 如果正在切换视频，忽略错误
        if (window.isSwitchingVideo) {
            return;
        }

        // 隐藏所有加载指示器
        const loadingElements = document.querySelectorAll('#player-loading, .player-loading-container');
        loadingElements.forEach(el => {
            if (el) el.style.display = 'none';
        });

        showError('视频播放失败: ' + (error.message || '未知错误'));
    });

    // 添加移动端长按三倍速播放功能
    setupLongPressSpeedControl();

    // 添加缩略图预览功能（从播放中视频渐进抓帧）
    setupThumbnailCapture();

    // 添加点击/双击控制行为（单击切换控制栏，双击暂停/播放）
    setupControlsBehavior();

    // 同步暂停状态到 Media Session
    art.on('video:pause', () => {
        if (navigator.mediaSession) {
            navigator.mediaSession.playbackState = 'paused';
        }
    });

    // 视频播放结束事件
    art.on('video:ended', function () {
        videoHasEnded = true;

        clearVideoProgress();

        // 如果自动播放下一集开启，且确实有下一集
        if (autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1) {
            // 稍长延迟以确保所有事件处理完成
            setTimeout(() => {
                // 确认不是因为用户拖拽导致的假结束事件
                playNextEpisode();
                videoHasEnded = false; // 重置标志
            }, 1000);
        } else {
            art.fullscreen = false;
        }
    });

    // 同步播放状态到 Media Session
    art.on('video:playing', () => {
        // 更新 Media Session（容错：如果 loadedmetadata 没触发）
        if (navigator.mediaSession) {
            navigator.mediaSession.playbackState = 'playing';
        }
    });

    // 10秒后如果仍在加载，但不立即显示错误
    setTimeout(function () {
        // 如果视频已经播放开始，则不显示错误
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

// 自定义M3U8 Loader用于过滤广告
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

// 过滤可疑的广告内容
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


// 显示错误
function showError(message) {
    // 在视频已经播放的情况下不显示错误
    if (art && art.video && art.video.currentTime > 1) {
        return;
    }
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.style.display = 'flex';
    const errorMsgEl = document.getElementById('error-message');
    if (errorMsgEl) errorMsgEl.textContent = message;
}

// 更新集数信息
function updateEpisodeInfo() {
    const el = document.getElementById('episodeInfo');
    if (!el) return;
    if (currentEpisodes.length > 0) {
        el.textContent = `第 ${currentEpisodeIndex + 1}/${currentEpisodes.length} 集`;
    } else {
        el.textContent = '无集数信息';
    }
}

// 更新按钮状态
function updateButtonStates() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    if (!prevButton && !nextButton) return;

    if (prevButton) {
        if (currentEpisodeIndex > 0) {
            prevButton.classList.remove('bg-gray-700', 'cursor-not-allowed');
            prevButton.classList.add('bg-[#222]', 'hover:bg-[#333]');
            prevButton.removeAttribute('disabled');
        } else {
            prevButton.classList.add('bg-gray-700', 'cursor-not-allowed');
            prevButton.classList.remove('bg-[#222]', 'hover:bg-[#333]');
            prevButton.setAttribute('disabled', '');
        }
    }

    if (nextButton) {
        if (currentEpisodeIndex < currentEpisodes.length - 1) {
            nextButton.classList.remove('bg-gray-700', 'cursor-not-allowed');
            nextButton.classList.add('bg-[#222]', 'hover:bg-[#333]');
            nextButton.removeAttribute('disabled');
        } else {
            nextButton.classList.add('bg-gray-700', 'cursor-not-allowed');
            nextButton.classList.remove('bg-[#222]', 'hover:bg-[#333]');
            nextButton.setAttribute('disabled', '');
        }
    }
}

// 渲染集数按钮
function renderEpisodes() {
    const episodesList = document.getElementById('episodesList');
    if (!episodesList) return;

    if (!currentEpisodes || currentEpisodes.length === 0) {
        episodesList.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">没有可用的集数</div>';
        return;
    }

    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    let html = '';

    episodes.forEach((episode, index) => {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        const isActive = realIndex === currentEpisodeIndex;

        html += `
            <button id="episode-${realIndex}" 
                    onclick="playEpisode(${realIndex})" 
                    class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333] hover:!shadow-none'} !border ${isActive ? '!border-blue-500' : '!border-[#333]'} rounded-lg transition-colors text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    });

    episodesList.innerHTML = html;
}

// 播放指定集数
function playEpisode(index) {
    // 确保index在有效范围内
    if (index < 0 || index >= currentEpisodes.length) {
        return;
    }

    // 保存当前播放进度（如果正在播放）
    if (art && art.video && !art.video.paused && !videoHasEnded) {
        saveCurrentProgress();
    }

    // 清除进度保存计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        progressSaveInterval = null;
    }

    // 首先隐藏之前可能显示的错误
    document.getElementById('error').style.display = 'none';
    // 显示加载指示器
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-loading').innerHTML = `
        <div class="loading-spinner"></div>
        <div>正在加载视频...</div>
    `;

    // 获取 sourceCode
    const urlParams2 = new URLSearchParams(window.location.search);
    const sourceCode = urlParams2.get('source_code');

    // 准备切换剧集的URL
    const url = currentEpisodes[index];

    // 更新当前剧集索引
    currentEpisodeIndex = index;
    currentVideoUrl = url;
    videoHasEnded = false; // 重置视频结束标志

    clearVideoProgress();

    // 更新URL参数（不刷新页面）
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('index', index);
    currentUrl.searchParams.set('url', url);
    currentUrl.searchParams.delete('position');
    window.history.replaceState({}, '', currentUrl.toString());

    // 使用 switchUrl 实现无缝切换，不销毁重建播放器
    art.switchUrl = url;

    // 更新UI
    updateEpisodeInfo();
    updateButtonStates();
    renderEpisodes();
    
    // 更新 Media Session 信息
    updateMediaSession();

    // 重置用户点击位置记录
    userClickedPosition = null;

    // 三秒后保存到历史记录
    setTimeout(() => saveToHistory(), 3000);
}

// 播放上一集
function playPreviousEpisode() {
    if (currentEpisodeIndex > 0) {
        playEpisode(currentEpisodeIndex - 1);
    }
}

// 播放下一集
function playNextEpisode() {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
    }
}

// 复制播放链接
function copyLinks() {
    // 尝试从URL中获取参数
    const urlParams = new URLSearchParams(window.location.search);
    const linkUrl = urlParams.get('url') || '';
    if (linkUrl !== '') {
        navigator.clipboard.writeText(linkUrl).then(() => {
            showToast('播放链接已复制', 'success');
        }).catch(err => {
            showToast('复制失败，请检查浏览器权限', 'error');
        });
    }
}

// 切换集数排序
function toggleEpisodeOrder() {
    episodesReversed = !episodesReversed;

    // 保存到localStorage
    localStorage.setItem('episodesReversed', episodesReversed);

    // 重新渲染集数列表
    renderEpisodes();

    // 更新排序按钮
    updateOrderButton();
}

// 更新排序按钮状态
function updateOrderButton() {
    const orderIcon = document.getElementById('orderIcon');

    if (orderIcon) {
        orderIcon.style.transform = episodesReversed ? 'rotate(180deg)' : '';
    }
}

// 设置进度条准确点击和拖动处理（桌面点击 + 移动端触摸滑动）
function setupProgressBarPreciseClicks() {
    // 查找ArtPlayer的进度条元素（.art-progress 在 .art-bottom 内部）
    const progressBar = document.querySelector('.art-progress');
    if (!progressBar || !art || !art.video) return;

    let isDragging = false;

    // 统一的跳转处理函数
    function seekByClientX(clientX, target) {
        if (!art || !art.video) return;
        const rect = target.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const duration = art.video.duration;
        let seekTime = percentage * duration;
        // 处理视频接近结尾的情况：离结尾1秒内则跳到结尾前1.5秒
        if (duration - seekTime < 1) {
            seekTime = Math.max(0, duration - 1.5);
        }
        userClickedPosition = seekTime;
        art.seek = seekTime;
    }

    // --- 桌面端：mousedown 点击跳转 + 拖动 ---
    function handleMouseDown(e) {
        if (!art || !art.video) return;
        isDragging = true;
        e.preventDefault();
        e.stopPropagation();
        seekByClientX(e.clientX, e.currentTarget);
    }

    function handleMouseMove(e) {
        if (!isDragging) return;
        seekByClientX(e.clientX, progressBar);
    }

    function handleMouseUp() {
        isDragging = false;
    }

    progressBar.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // --- 移动端：touchstart 点击 + touchmove 滑动 ---
    function handleTouchStart(e) {
        if (!art || !art.video || !e.touches[0]) return;
        isDragging = true;
        e.stopPropagation();
        seekByClientX(e.touches[0].clientX, e.currentTarget);
    }

    function handleTouchMove(e) {
        if (!isDragging || !e.touches[0]) return;
        e.preventDefault();
        seekByClientX(e.touches[0].clientX, progressBar);
    }

    function handleTouchEnd() {
        isDragging = false;
    }

    progressBar.addEventListener('touchstart', handleTouchStart, { passive: false });
    progressBar.addEventListener('touchmove', handleTouchMove, { passive: false });
    progressBar.addEventListener('touchend', handleTouchEnd);
    progressBar.addEventListener('touchcancel', handleTouchEnd);
}

// 在播放器初始化后添加视频到历史记录
function saveToHistory() {
    // 确保 currentEpisodes 非空且有当前视频URL
    if (!currentEpisodes || currentEpisodes.length === 0 || !currentVideoUrl) {
        return;
    }

    // 尝试从URL中获取参数
    const urlParams = new URLSearchParams(window.location.search);
    const sourceName = urlParams.get('source') || '';
    const sourceCode = urlParams.get('source') || '';
    const id_from_params = urlParams.get('id'); // Get video ID from player URL (passed as 'id')

    // 获取当前播放进度
    let currentPosition = 0;
    let videoDuration = 0;

    if (art && art.video) {
        currentPosition = art.video.currentTime;
        videoDuration = art.video.duration;
    }

    // Define a show identifier: Prioritize sourceName_id, fallback to first episode URL or current video URL
    let show_identifier_for_video_info;
    if (sourceName && id_from_params) {
        show_identifier_for_video_info = `${sourceName}_${id_from_params}`;
    } else {
        show_identifier_for_video_info = (currentEpisodes && currentEpisodes.length > 0) ? currentEpisodes[0] : currentVideoUrl;
    }

    // 尝试获取当前视频的封面信息
    let currentVideoCover = '';
    try {
        const storedVideoInfo = localStorage.getItem('currentVideoInfo');
        if (storedVideoInfo) {
            const parsedInfo = JSON.parse(storedVideoInfo);
            currentVideoCover = parsedInfo.cover || parsedInfo.vod_pic || '';
        }
    } catch (e) {
    }

    // 构建要保存的视频信息对象
    const videoInfo = {
        title: currentVideoTitle,
        directVideoUrl: currentVideoUrl, // Current episode's direct URL
        url: `player.html?url=${encodeURIComponent(currentVideoUrl)}&title=${encodeURIComponent(currentVideoTitle)}&source=${encodeURIComponent(sourceName)}&source_code=${encodeURIComponent(sourceCode)}&id=${encodeURIComponent(id_from_params || '')}&index=${currentEpisodeIndex}&position=${Math.floor(currentPosition || 0)}`,
        episodeIndex: currentEpisodeIndex,
        sourceName: sourceName,
        vod_id: id_from_params || '', // Store the ID from params as vod_id in history item
        sourceCode: sourceCode,
        showIdentifier: show_identifier_for_video_info, // Identifier for the show/series
        timestamp: Date.now(),
        playbackPosition: currentPosition,
        duration: videoDuration,
        episodes: currentEpisodes && currentEpisodes.length > 0 ? [...currentEpisodes] : [],
        cover: currentVideoCover // 添加封面信息
    };
    
    try {
        const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');

        // 查找相同标题的剧集（不管播放源如何，只保留最新播放源）
        const existingIndex = history.findIndex(item => 
            item.title === videoInfo.title
        );

        if (existingIndex !== -1) {
            // 找到相同标题的剧集：更新为最新播放源的信息
            const existingItem = history[existingIndex];
            
            // 强制更新所有信息为最新播放源的
            existingItem.episodeIndex = videoInfo.episodeIndex;
            existingItem.timestamp = videoInfo.timestamp;
            existingItem.sourceName = videoInfo.sourceName; // 强制更新为最新播放源
            existingItem.sourceCode = videoInfo.sourceCode; // 强制更新为最新播放源
            existingItem.vod_id = videoInfo.vod_id; // 强制更新为最新播放源
            
            // 强制更新URL信息
            existingItem.directVideoUrl = videoInfo.directVideoUrl;
            existingItem.url = videoInfo.url;

            // 更新播放进度信息
            existingItem.playbackPosition = videoInfo.playbackPosition > 10 ? videoInfo.playbackPosition : (existingItem.playbackPosition || 0);
            existingItem.duration = videoInfo.duration || existingItem.duration;
            
            // 更新showIdentifier为最新播放源的标识符
            if (videoInfo.sourceName && videoInfo.vod_id) {
                existingItem.showIdentifier = `${videoInfo.sourceName}_${videoInfo.vod_id}`;
            }
            
            // 更新封面信息
            if (videoInfo.cover) {
                existingItem.cover = videoInfo.cover;
            }
            
            // 更新集数列表
            if (videoInfo.episodes && videoInfo.episodes.length > 0) {
                existingItem.episodes = [...videoInfo.episodes];
            }
            
            // 移到最前面
            history.splice(existingIndex, 1);
            history.unshift(existingItem);
        } else {
            // 没有找到相同标题：添加为新记录
            history.unshift(videoInfo);
        }

        // 限制历史记录数量为50条
        if (history.length > 50) history.splice(50);

        localStorage.setItem('viewingHistory', JSON.stringify(history));
    } catch (e) {
    }
}

// 显示恢复位置提示
function showPositionRestoreHint(position) {
    if (!position || position < 10) return;

    // 创建提示元素
    const hint = document.createElement('div');
    hint.className = 'position-restore-hint';
    hint.innerHTML = `
        <div class="hint-content">
            已从 ${formatTime(position)} 继续播放
        </div>
    `;

    // 尝试添加到播放器容器或body
    let container;
    if (document.getElementById('player')) {
        container = document.getElementById('player');
    } else if (document.querySelector('.player-container')) {
        container = document.querySelector('.player-container');
    } else {
        container = document.body;
        // 如果添加到body，使用fixed定位
        hint.style.position = 'fixed';
    }

    if (container) {
        container.appendChild(hint);
    } else {
        console.error('未找到合适的容器来显示恢复位置提示');
        return;
    }

    // 确保提示使用正确的样式
    hint.style.zIndex = '1000';

    // 显示提示
    setTimeout(() => {
        hint.classList.add('show');

        // 3秒后隐藏
        setTimeout(() => {
            hint.classList.remove('show');
            setTimeout(() => {
                if (hint.parentNode) {
                    hint.parentNode.removeChild(hint);
                }
            }, 300);
        }, 3000);
    }, 100);
}

// 格式化时间为 mm:ss 格式
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 开始定期保存播放进度
function startProgressSaveInterval() {
    // 清除可能存在的旧计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
    }

    // 每30秒保存一次播放进度
    progressSaveInterval = setInterval(saveCurrentProgress, 30000);
}

// 保存当前播放进度
let _lastHistoryWriteTime = 0;
function saveCurrentProgress() {
    if (!art || !art.video) return;
    const currentTime = art.video.currentTime;
    const duration = art.video.duration;
    if (!duration || currentTime < 1) return;

    // 在localStorage中保存进度（轻量操作，每次执行）
    const progressKey = `videoProgress_${getVideoId()}`;
    const progressData = {
        position: currentTime,
        duration: duration,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem(progressKey, JSON.stringify(progressData));
        
        // 防抖：viewingHistory 写入最多每30秒一次
        const now = Date.now();
        if (now - _lastHistoryWriteTime < 30000) return;
        _lastHistoryWriteTime = now;

        // 更新 viewingHistory 中的进度
        try {
            const historyRaw = localStorage.getItem('viewingHistory');
            if (historyRaw) {
                const history = JSON.parse(historyRaw);
                
                // 用更精确的匹配方式：sourceName + vod_id + episodeIndex
                let idx = -1;
                
                // 尝试从URL获取source和id参数
                const urlParams = new URLSearchParams(window.location.search);
                const sourceName = urlParams.get('source') || '';
                const vod_id = urlParams.get('id') || '';
                
                // 优先使用sourceName + vod_id匹配
                if (sourceName && vod_id) {
                    idx = history.findIndex(item => 
                        item.sourceName === sourceName && 
                        item.vod_id === vod_id &&
                        (item.episodeIndex === undefined || item.episodeIndex === currentEpisodeIndex)
                    );
                }
                
                // 如果没有匹配到，使用title + episodeIndex作为备选匹配方式
                if (idx === -1 && currentVideoTitle) {
                    idx = history.findIndex(item =>
                        item.title === currentVideoTitle &&
                        (item.episodeIndex === undefined || item.episodeIndex === currentEpisodeIndex)
                    );
                }
                
                // 如果找到了匹配项，更新播放进度
                if (idx !== -1) {
                    // 只在进度有明显变化时才更新，减少写入
                    if (
                        Math.abs((history[idx].playbackPosition || 0) - currentTime) > 2 ||
                        Math.abs((history[idx].duration || 0) - duration) > 2
                    ) {
                        history[idx].playbackPosition = currentTime;
                        history[idx].duration = duration;
                        history[idx].timestamp = Date.now();
                        localStorage.setItem('viewingHistory', JSON.stringify(history));
                    }
                } else if (currentVideoTitle && currentVideoUrl) {
                    // 如果找不到匹配项，并且有足够信息，创建一个新的历史记录项
                    addToViewingHistory({
                        title: currentVideoTitle,
                        url: currentVideoUrl,
                        sourceName: sourceName || '',
                        vod_id: vod_id || '',
                        episodeIndex: currentEpisodeIndex,
                        playbackPosition: currentTime,
                        duration: duration,
                        episodes: currentEpisodes || []
                    });
                }
            }
        } catch (e) {
            console.error('更新历史记录进度时出错:', e);
        }
    } catch (e) {
        console.error('保存播放进度时出错:', e);
    }
}

// 设置长按二倍速播放功能（桌面鼠标长按 + 移动端触摸长按）
function setupLongPressSpeedControl() {
    if (!art || !art.video) return;

    const playerElement = document.getElementById('player');
    let longPressTimer = null;
    let originalPlaybackRate = 1.0;
    let isLongPress = false;

    // 显示倍速提示
    function showSpeedHint(speed) {
        showShortcutHint(`${speed}倍速`, 'right');
    }

    // 移动端禁用右键菜单（防止长按弹出原生菜单）
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        playerElement.oncontextmenu = () => false;
    }

    // 核心：开始长按倒计时
    function startLongPress() {
        if (art.video.paused) return;
        originalPlaybackRate = art.video.playbackRate;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            if (art.video.paused) return;
            art.video.playbackRate = 2.0;
            isLongPress = true;
            showSpeedHint(2.0);
        }, 500);
    }

    // 核心：结束长按，恢复速度
    function endLongPress(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
            showSpeedHint(originalPlaybackRate);
            if (e) e.preventDefault();
        }
    }

    // --- 桌面端：鼠标长按 ---
    playerElement.addEventListener('mousedown', startLongPress);
    playerElement.addEventListener('mouseup', endLongPress);
    playerElement.addEventListener('mouseleave', endLongPress);

    // --- 移动端：触摸长按 ---
    playerElement.addEventListener('touchstart', startLongPress, { passive: true });
    playerElement.addEventListener('touchend', endLongPress);
    playerElement.addEventListener('touchcancel', endLongPress);

    // 触摸移动时，如果处于长按状态则阻止页面滚动
    playerElement.addEventListener('touchmove', function (e) {
        if (isLongPress) e.preventDefault();
    }, { passive: false });

    // 视频暂停时取消长按状态
    art.video.addEventListener('pause', function () {
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
        }
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}

// 从播放中的视频渐进抓帧，构建进度条缩略图预览（兼容 HLS）
function setupThumbnailCapture() {
    if (!art || !art.video) return;

    const CAPTURE_INTERVAL = 1;
    const THUMBNAIL_WIDTH = 160;
    const TOTAL_THUMBNAILS = 100;
    const COLUMNS = 10;

    let lastCapture = 0;
    let captured = 0;
    let canvas = null;
    let ctx = null;
    let frameH = 90;
    let thumbnailUrl = null;

    function ensureCanvas() {
        if (canvas) return true;
        const vh = art.video.videoHeight || art.video.height || 90;
        const vw = art.video.videoWidth || art.video.width || 160;
        if (!vh || !vw) return false;

        frameH = Math.round(THUMBNAIL_WIDTH * vh / vw);
        const rows = Math.ceil(TOTAL_THUMBNAILS / COLUMNS);
        canvas = document.createElement('canvas');
        canvas.width = THUMBNAIL_WIDTH * COLUMNS;
        canvas.height = frameH * rows;
        ctx = canvas.getContext('2d');
        return true;
    }

    function flushSprite() {
        if (!canvas || captured === 0) return;
        canvas.toBlob(function (blob) {
            if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
            thumbnailUrl = URL.createObjectURL(blob);
            art.thumbnails = {
                url: thumbnailUrl,
                number: captured,
                column: COLUMNS,
                width: THUMBNAIL_WIDTH,
                height: frameH,
            };
        }, 'image/jpeg');
    }

    function onTimeUpdate() {
        if (!art || !art.video || captured >= TOTAL_THUMBNAILS) return;
        const ct = art.video.currentTime;
        if (ct - lastCapture < CAPTURE_INTERVAL) return;
        if (!ensureCanvas() || !ctx) return;
        lastCapture = ct;

        const col = captured % COLUMNS;
        const row = Math.floor(captured / COLUMNS);
        try {
            ctx.drawImage(art.video, col * THUMBNAIL_WIDTH, row * frameH, THUMBNAIL_WIDTH, frameH);
            captured++;
            // 每抓满一行（10帧）或全部抓完才刷新雪碧图
            if (captured % COLUMNS === 0 || captured >= TOTAL_THUMBNAILS) {
                flushSprite();
            }
        } catch (e) {}
    }

    art.video.addEventListener('timeupdate', onTimeUpdate);
}

// 设置点击/双击控制行为：单击切换控制栏（含返回按钮+进度条），双击切换暂停/播放，2秒自动收起
function setupControlsBehavior() {
    if (!art) return;

    const container = document.getElementById('playerContainer');
    const playerEl = document.getElementById('player');
    if (!container || !playerEl) return;

    let controlsVisible = true;
    let hideTimer = null;
    let clickTimer = null;

    function showControls(resetTimer) {
        controlsVisible = true;
        container.classList.remove('controls-hidden');
        if (resetTimer !== false) resetAutoHide();
    }

    function hideControls() {
        controlsVisible = false;
        container.classList.add('controls-hidden');
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    function toggleControls() {
        if (controlsVisible) hideControls();
        else showControls();
    }

    function resetAutoHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(hideControls, 2000);
    }

    // 在视频元素上方覆盖透明点击层（仅覆盖视频区域，不遮挡控件）
    const videoWrapper = art.video && art.video.parentElement;
    if (!videoWrapper) return;

    const overlay = document.createElement('div');
    overlay.className = 'player-click-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:5;cursor:pointer';
    videoWrapper.style.position = 'relative';
    videoWrapper.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            if (art.video.paused) art.play();
            else art.pause();
            e.stopPropagation();
            return;
        }
        clickTimer = setTimeout(function () {
            clickTimer = null;
            toggleControls();
        }, 250);
        e.stopPropagation();
    });

    playerEl.addEventListener('mousemove', function () {
        if (!controlsVisible) showControls();
        else resetAutoHide();
    });

    playerEl.addEventListener('mouseleave', function () {
        if (controlsVisible) resetAutoHide();
    });

    setTimeout(hideControls, 3000);
}

// 清除视频进度记录
function clearVideoProgress() {
    const progressKey = `videoProgress_${getVideoId()}`;
    try {
        localStorage.removeItem(progressKey);
    } catch (e) {
    }
}

// 获取视频唯一标识
function getVideoId() {
    // 使用视频标题和集数索引作为唯一标识
    // If currentVideoUrl is available and more unique, prefer it. Otherwise, fallback.
    if (currentVideoUrl) {
        return `${encodeURIComponent(currentVideoUrl)}`;
    }
    return `${encodeURIComponent(currentVideoTitle)}_${currentEpisodeIndex}`;
}

// ========== Media Session API ==========
function getVideoCover() {
    try {
        const stored = localStorage.getItem('currentVideoInfo');
        if (stored) {
            const info = JSON.parse(stored);
            if (info.cover && info.cover.startsWith('http')) return info.cover;
        }
    } catch (e) {}
    return '/image/logo-black.png';
}

function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;

    const coverUrl = getVideoCover();
    const episodeStr = currentEpisodes.length > 1
        ? `第${currentEpisodeIndex + 1}/${currentEpisodes.length}集`
        : '';

    navigator.mediaSession.metadata = new MediaMetadata({
        title: currentVideoTitle,
        artist: 'LeLeTV',
        album: episodeStr || '乐乐影视',
        artwork: [
            { src: coverUrl, sizes: '256x256', type: 'image/png' },
            { src: coverUrl, sizes: '512x512', type: 'image/png' },
        ]
    });

    // 只在第一次设置 action handlers
    if (window._mediaSessionHandlersSet) return;
    window._mediaSessionHandlersSet = true;

    const handlers = {
        play() { if (art) art.play(); },
        pause() { if (art) art.pause(); },
        previoustrack() { playPreviousEpisode(); },
        nexttrack() { playNextEpisode(); },
        seekforward() { if (art) art.currentTime = Math.min(art.duration, art.currentTime + 30); },
        seekbackward() { if (art) art.currentTime = Math.max(0, art.currentTime - 10); },
        seekto(details) { if (art && details.seekTime != null) art.currentTime = details.seekTime; },
    };

    for (const [action, handler] of Object.entries(handlers)) {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            // 某些浏览器不支持所有 action，静默跳过
        }
    }
}

// ========== 下一集按钮（直接 DOM 注入） ==========
function addNextEpisodeDirectly(art) {
    
    // 检查是否已存在
    if (document.querySelector('.custom-next-episode-btn')) {
        return;
    }
    
    // 获取播放器容器
    const playerEl = document.getElementById('player');
    if (!playerEl) {
        return;
    }
    
    // 查找控制栏
    const controlsContainer = playerEl.querySelector('.art-controls') || document.querySelector('.art-controls');
    if (!controlsContainer) {
        return;
    }
    
    // 查找左侧控制区
    const leftControls = controlsContainer.querySelector('.art-controls-left');
    const targetContainer = leftControls || controlsContainer;
    
    // 查找播放按钮（暂停按钮）
    const playBtn = targetContainer.querySelector('.art-control-playAndPause');
    
    // 创建按钮
    const nextBtn = document.createElement('div');
    nextBtn.className = 'custom-next-episode-btn art-control';
    nextBtn.title = '下一集 (Alt+→)';
    nextBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>';
    
    // 应用样式，和其他控制按钮一致
    nextBtn.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 40px !important;
        height: 40px !important;
        cursor: pointer !important;
        color: white !important;
        opacity: 0.9 !important;
        transition: opacity 0.2s !important;
        padding: 8px !important;
        box-sizing: border-box !important;
        position: relative !important;
    `;
    
    nextBtn.addEventListener('mouseenter', function() {
        this.style.opacity = '1 !important';
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.1) !important';
        this.style.borderRadius = '50% !important';
    });
    
    nextBtn.addEventListener('mouseleave', function() {
        this.style.backgroundColor = 'transparent !important';
    });
    
    nextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (typeof playNextEpisode === 'function') {
            playNextEpisode();
        }
    });
    
    // 插入到播放按钮后面
    if (playBtn && playBtn.nextSibling) {
        targetContainer.insertBefore(nextBtn, playBtn.nextSibling);
    } else if (playBtn) {
        // 如果播放按钮是最后一个元素
        targetContainer.appendChild(nextBtn);
    } else {
        // 如果找不到播放按钮，就插到开头
        targetContainer.insertBefore(nextBtn, targetContainer.firstChild);
    }
}

let controlsLocked = false;
function toggleControlsLock() {
    const container = document.getElementById('playerContainer');
    controlsLocked = !controlsLocked;
    container.classList.toggle('controls-locked', controlsLocked);
    const icon = document.getElementById('lockIcon');
    // 切换图标：锁 / 解锁
    icon.innerHTML = controlsLocked
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d=\"M12 15v2m0-8V7a4 4 0 00-8 0v2m8 0H4v8h16v-8H6v-6z\"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d=\"M15 11V7a3 3 0 00-6 0v4m-3 4h12v6H6v-6z\"/>';
}

function renderPlayerDetailInfo() {
    const container = document.getElementById('playerDetailInfo');
    if (!container) return;

    const metaContainer = document.getElementById('detailMetaContainer');
    const descBody = document.getElementById('detailDescBody');
    const arrow = container.querySelector('.detail-toggle-arrow');

    let videoInfo = null;
    try {
        const stored = localStorage.getItem('currentVideoInfo');
        if (stored) {
            videoInfo = JSON.parse(stored);
        }
    } catch (e) {
        // ignore
    }

    const descriptionText = videoInfo && videoInfo.desc ? videoInfo.desc.replace(/<[^>]+>/g, '').trim() : '';
    const hasMeta = videoInfo && (videoInfo.type || videoInfo.year || videoInfo.area || videoInfo.director || videoInfo.remarks);
    const hasActorOrDesc = videoInfo && (videoInfo.actor || descriptionText);

    container.style.display = 'block';

    // 渲染基本信息（始终显示）- 不含主演
    if (metaContainer && hasMeta) {
        let metaHtml = '<div class="detail-meta">';
        if (videoInfo.type) {
            metaHtml += `<div class="detail-meta-item"><span class="detail-meta-label">类型:</span><span class="detail-meta-value">${videoInfo.type}</span></div>`;
        }
        if (videoInfo.year) {
            metaHtml += `<div class="detail-meta-item"><span class="detail-meta-label">年份:</span><span class="detail-meta-value">${videoInfo.year}</span></div>`;
        }
        if (videoInfo.area) {
            metaHtml += `<div class="detail-meta-item"><span class="detail-meta-label">地区:</span><span class="detail-meta-value">${videoInfo.area}</span></div>`;
        }
        if (videoInfo.director) {
            metaHtml += `<div class="detail-meta-item"><span class="detail-meta-label">导演:</span><span class="detail-meta-value">${videoInfo.director}</span></div>`;
        }
        if (videoInfo.remarks) {
            metaHtml += `<div class="detail-meta-item"><span class="detail-meta-label">备注:</span><span class="detail-meta-value">${videoInfo.remarks}</span></div>`;
        }
        metaHtml += '</div>';
        metaContainer.innerHTML = metaHtml;
    } else if (metaContainer) {
        metaContainer.innerHTML = '';
    }

    // 渲染详情部分（可折叠）- 包含主演和简介
    if (descBody) {
        let detailHtml = '';
        
        // 先添加主演
        if (videoInfo.actor) {
            detailHtml += '<div class="detail-meta detail-meta-collapsible">';
            detailHtml += `<div class="detail-meta-item"><span class="detail-meta-label">主演:</span><span class="detail-meta-value">${videoInfo.actor}</span></div>`;
            detailHtml += '</div>';
        }
        
        // 再添加简介
        if (descriptionText) {
            detailHtml += `<div class="detail-desc-content"><span class="detail-meta-label">简介:</span>${descriptionText}</div>`;
        }

        if (detailHtml) {
            descBody.innerHTML = detailHtml;
            if (arrow) arrow.style.display = '';
        } else {
            descBody.innerHTML = '';
            if (arrow) arrow.style.display = 'none';
        }
    }

    // 详情默认收起
    if (hasActorOrDesc) {
        container.classList.add('detail-collapsed');
    }
}

function toggleDetailInfo() {
    const container = document.getElementById('playerDetailInfo');
    if (!container) return;
    const body = container.querySelector('.detail-collapse-body');
    if (!body || !body.innerHTML.trim()) return;
    container.classList.toggle('detail-collapsed');
}

// 选集区域折叠切换
function toggleEpisodeSection() {
    const section = document.getElementById('episodeSection');
    if (!section) return;
    section.classList.toggle('episode-collapsed');
}

// 选集默认展开
function updateEpisodeCollapseState() {
    const section = document.getElementById('episodeSection');
    if (!section) return;
    section.classList.remove('episode-collapsed');
}

function renderResourceInfoBar() {
    // 获取容器元素
    const container = document.getElementById('resourceInfoBarContainer');
    if (!container) {
        console.error('找不到资源信息卡片容器');
        return;
    }
    
    // 获取当前视频 source_code
    const urlParams = new URLSearchParams(window.location.search);
    const currentSource = urlParams.get('source') || '';
    
    // 显示临时加载状态
    container.innerHTML = `
      <div class="resource-info-bar-left flex">
        <span>加载中...</span>
        <span class="resource-info-bar-videos">-</span>
      </div>
      <button class="resource-switch-btn flex" id="switchResourceBtn" onclick="showSwitchResourceModal()">
        <span class="resource-switch-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        切换资源
      </button>
    `;

    // 查找当前源名称，从 API_SITES 和 custom_api 中查找即可
    let resourceName = currentSource
    if (currentSource && API_SITES[currentSource]) {
        resourceName = API_SITES[currentSource].name;
    }
    if (resourceName === currentSource) {
        const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        const customIndex = parseInt(currentSource.replace('custom_', ''), 10);
        if (customAPIs[customIndex]) {
            resourceName = customAPIs[customIndex].name || '自定义资源';
        }
    }

    container.innerHTML = `
      <div class="resource-info-bar-left flex">
        <span>${resourceName}</span>
        <span class="resource-info-bar-videos">${currentEpisodes.length} 个视频</span>
      </div>
      <button class="resource-switch-btn flex" id="switchResourceBtn" onclick="showSwitchResourceModal()">
        <span class="resource-switch-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        切换资源
      </button>
    `;
}

// 测试视频源速率的函数
async function testVideoSourceSpeed(sourceKey, vodId) {
    try {
        const startTime = performance.now();
        
        // 构建API参数
        let apiParams = '';
        if (sourceKey.startsWith('custom_')) {
            const customIndex = sourceKey.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                return { speed: -1, error: 'API配置无效' };
            }
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            apiParams = '&source=' + sourceKey;
        }
        
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        
        // 获取视频详情
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`, {
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            return { speed: -1, error: '获取失败' };
        }
        
        const data = await response.json();
        
        if (!data.episodes || data.episodes.length === 0) {
            return { speed: -1, error: '无播放源' };
        }
        
        // 测试第一个播放链接的响应速度
        const firstEpisodeUrl = data.episodes[0];
        if (!firstEpisodeUrl) {
            return { speed: -1, error: '链接无效' };
        }
        
        // 测试视频链接响应时间
        const videoTestStart = performance.now();
        try {
            const videoResponse = await fetch(firstEpisodeUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: AbortSignal.timeout(5000) // 5秒超时
            });
            
            const videoTestEnd = performance.now();
            const totalTime = videoTestEnd - startTime;
            
            // 返回总响应时间（毫秒）
            return { 
                speed: Math.round(totalTime),
                episodes: data.episodes.length,
                error: null 
            };
        } catch (videoError) {
            // 如果视频链接测试失败，只返回API响应时间
            const apiTime = performance.now() - startTime;
            return { 
                speed: Math.round(apiTime),
                episodes: data.episodes.length,
                error: null,
                note: 'API响应' 
            };
        }
        
    } catch (error) {
        return { 
            speed: -1, 
            error: error.name === 'AbortError' ? '超时' : '测试失败' 
        };
    }
}

// 格式化速度显示
function formatSpeedDisplay(speedResult) {
    if (speedResult.speed === -1) {
        return `<span class="speed-indicator error">❌ ${speedResult.error}</span>`;
    }
    
    const speed = speedResult.speed;
    let className = 'speed-indicator good';
    let icon = '🟢';
    
    if (speed > 500) {
        className = 'speed-indicator poor';
        icon = '🔴';
    } else if (speed > 200) {
        className = 'speed-indicator medium';
        icon = '🟡';
    }
    
    const note = speedResult.note ? ` (${speedResult.note})` : '';
    return `<span class="${className}">${icon} ${speed}ms${note}</span>`;
}

async function showSwitchResourceModal() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentSourceCode = urlParams.get('source');
    const currentVideoId = urlParams.get('id');

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    modalTitle.innerHTML = `<span class="break-words">${currentVideoTitle}</span>`;
    modalContent.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;grid-column:1/-1;">正在加载资源列表...</div>';
    modal.classList.remove('hidden');

    // 搜索
    const localSelectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
    const localCustomAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
    const resourceOptions = localSelectedAPIs.map((curr) => {
        if (API_SITES[curr]) {
            return { key: curr, name: API_SITES[curr].name };
        }
        const customIndex = parseInt(curr.replace('custom_', ''), 10);
        if (localCustomAPIs[customIndex]) {
            return { key: curr, name: localCustomAPIs[customIndex].name || '自定义资源' };
        }
        return { key: curr, name: '未知资源' };
    });
    let allResults = {};
    await Promise.all(resourceOptions.map(async (opt) => {
        let queryResult = await searchByAPIAndKeyWord(opt.key, currentVideoTitle);
        if (queryResult.length == 0) {
            return 
        }
        // 优先取完全同名资源，否则默认取第一个
        let result = queryResult[0]
        queryResult.forEach((res) => {
            if (res.vod_name == currentVideoTitle) {
                result = res;
            }
        })
        allResults[opt.key] = result;
    }));

    // 更新状态显示：开始速率测试
    modalContent.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;grid-column:1/-1;">正在测试各资源速率...</div>';

    // 同时测试所有资源的速率
    const speedResults = {};
    await Promise.all(Object.entries(allResults).map(async ([sourceKey, result]) => {
        if (result) {
            speedResults[sourceKey] = await testVideoSourceSpeed(sourceKey, result.vod_id);
        }
    }));

    // 对结果进行排序
    const sortedResults = Object.entries(allResults).sort(([keyA, resultA], [keyB, resultB]) => {
        // 当前播放的源放在最前面
        const isCurrentA = String(keyA) === String(currentSourceCode) && String(resultA.vod_id) === String(currentVideoId);
        const isCurrentB = String(keyB) === String(currentSourceCode) && String(resultB.vod_id) === String(currentVideoId);
        
        if (isCurrentA && !isCurrentB) return -1;
        if (!isCurrentA && isCurrentB) return 1;
        
        // 其余按照速度排序，速度快的在前面（速度为-1表示失败，排到最后）
        const speedA = speedResults[keyA]?.speed || 99999;
        const speedB = speedResults[keyB]?.speed || 99999;
        
        if (speedA === -1 && speedB !== -1) return 1;
        if (speedA !== -1 && speedB === -1) return -1;
        if (speedA === -1 && speedB === -1) return 0;
        
        return speedA - speedB;
    });

    // 渲染资源列表
    let html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">';
    
    for (const [sourceKey, result] of sortedResults) {
        if (!result) continue;
        
        // 修复 isCurrentSource 判断，确保类型一致
        const isCurrentSource = String(sourceKey) === String(currentSourceCode) && String(result.vod_id) === String(currentVideoId);
        const sourceName = resourceOptions.find(opt => opt.key === sourceKey)?.name || '未知资源';
        const speedResult = speedResults[sourceKey] || { speed: -1, error: '未测试' };
        
        html += `
            <div class="relative group ${isCurrentSource ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 transition-transform'}" 
                 ${!isCurrentSource ? `onclick="switchToResource('${sourceKey}', '${result.vod_id}')"` : ''}>
                <div class="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative image-container">
                    <img src="${result.vod_pic}" 
                         alt="${result.vod_name}"
                         class="w-full h-full object-cover"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjE3IDggMTIgMyA3IDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEyIDN2MTIiPjwvcGF0aD48L3N2Zz4='">
                    
                    <!-- 速率显示在图片右上角 -->
                    <div class="absolute top-1 right-1 speed-badge bg-black bg-opacity-75">
                        ${formatSpeedDisplay(speedResult)}
                    </div>
                </div>
                <div class="mt-2">
                    <div class="text-xs font-medium text-gray-200 truncate">${result.vod_name}</div>
                    <div class="text-[10px] text-gray-400 truncate">${sourceName}</div>
                    <div class="text-[10px] text-gray-500 mt-1">
                        ${speedResult.episodes ? `${speedResult.episodes}集` : ''}
                    </div>
                </div>
                ${isCurrentSource ? `
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="bg-blue-600 bg-opacity-75 rounded-lg px-2 py-0.5 text-xs text-white font-medium">
                            当前播放
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    modalContent.innerHTML = html;
    
}

// 切换资源的函数
async function switchToResource(sourceKey, vodId) {
    // 关闭模态框
    document.getElementById('modal').classList.add('hidden');
    
    showLoading();
    try {
        // 保存当前播放进度
        let currentPosition = 0;
        if (art && art.video) {
            currentPosition = art.video.currentTime;
        }
        
        // 构建API参数
        let apiParams = '';
        
        // 处理自定义API源
        if (sourceKey.startsWith('custom_')) {
            const customIndex = sourceKey.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                showToast('自定义API配置无效', 'error');
                hideLoading();
                return;
            }
            // 传递 detail 字段
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            // 内置API
            apiParams = '&source=' + sourceKey;
        }
        
        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`);
        
        const data = await response.json();
        
        if (!data.episodes || data.episodes.length === 0) {
            showToast('未找到播放资源', 'error');
            hideLoading();
            return;
        }

        // 获取当前播放的集数索引
        const currentIndex = currentEpisodeIndex;
        
        // 确定要播放的集数索引
        let targetIndex = 0;
        if (currentIndex < data.episodes.length) {
            // 如果当前集数在新资源中存在，则使用相同集数
            targetIndex = currentIndex;
        }
        
        // 获取目标集数的URL
        const targetUrl = data.episodes[targetIndex];
        
        // 构建播放页面URL，包含当前播放进度
        const watchUrl = `player.html?id=${vodId}&source=${sourceKey}&url=${encodeURIComponent(targetUrl)}&index=${targetIndex}&title=${encodeURIComponent(currentVideoTitle)}&position=${currentPosition}`;
        
        // 保存当前状态到localStorage
        try {
            localStorage.setItem('currentVideoTitle', data.vod_name || '未知视频');
            localStorage.setItem('currentEpisodes', JSON.stringify(data.episodes));
            localStorage.setItem('currentEpisodeIndex', targetIndex);
            localStorage.setItem('currentSourceCode', sourceKey);
            localStorage.setItem('lastPlayTime', Date.now());
            
            // 保存视频详细信息，包括封面
            if (data.videoInfo) {
                localStorage.setItem('currentVideoInfo', JSON.stringify(data.videoInfo));
            }
        } catch (e) {
            console.error('保存播放状态失败:', e);
        }

        // 更新历史记录中的源信息而不是创建新记录
        try {
            const historyRaw = localStorage.getItem('viewingHistory');
            if (historyRaw) {
                const history = JSON.parse(historyRaw);
                
                // 查找当前视频的历史记录项（通过标题和集数索引）
                const currentUrlParams = new URLSearchParams(window.location.search);
                const currentVodId = currentUrlParams.get('id') || '';
                
                let idx = -1;
                if (currentVodId) {
                    // 先尝试通过ID匹配
                    idx = history.findIndex(item => item.vod_id === currentVodId);
                }
                
                if (idx === -1) {
                    // 如果没有找到ID匹配，尝试通过标题和集数索引匹配
                    idx = history.findIndex(item => 
                        item.title === currentVideoTitle && 
                        item.episodeIndex === currentEpisodeIndex
                    );
                }
                
                if (idx !== -1) {
                    // 更新现有记录的源信息和位置
                    history[idx].sourceName = sourceKey;
                    history[idx].timestamp = Date.now();
                    if (currentPosition > 0) {
                        history[idx].playbackPosition = currentPosition;
                    }
                    
                    // 移动到最近观看的位置
                    const updatedItem = history.splice(idx, 1)[0];
                    history.unshift(updatedItem);
                    
                    localStorage.setItem('viewingHistory', JSON.stringify(history));
                }
            }
        } catch (e) {
            console.error('更新历史记录源信息时出错:', e);
        }

        // 跳转到播放页面
        window.location.href = watchUrl;
        
    } catch (error) {
        console.error('切换资源失败:', error);
        showToast('切换资源失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}