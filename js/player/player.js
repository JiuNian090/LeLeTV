// 返回键：全屏时退出全屏，否则返回上一页
function goHome(event) {
    if (event) event.preventDefault();

    if (art && art.fullscreen) {
        art.fullscreen = false;
        autoFullscreened = false;
        return;
    }

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        autoFullscreened = false;
        return;
    }

    // 优先使用 URL back 参数（来自历史记录等外部跳转带入），否则交由浏览器处理历史栈
    const urlParams = new URLSearchParams(window.location.search);
    const backUrl = urlParams.get('back');

    if (backUrl) {
        localStorage.removeItem('lastSearchPage');
        window.location.href = backUrl;
    } else {
        window.history.back();
    }

    // 兜底：5 秒后如果还在当前页，强制跳转首页
    setTimeout(() => {
        if (document.getElementById('playerContainer')) {
            window.location.href = '/index.html';
        }
    }, TIMING.FALLBACK_NAVIGATION_DELAY);
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

// 处理移动端滑动返回/前进时的 bfcache 恢复
// 当页面从 bfcache 恢复时（浏览器缓存了页面状态但网络连接已断开），
// HLS.js 实例可能处于失效状态，加载指示器会卡住无法消失
window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        // 页面从 bfcache 恢复，强制刷新以确保播放器干净初始化
        window.location.reload();
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
let episodeSwitchTimeout = null; // 集数切换超时定时器（用于兜底重建）
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
          existingInfo = StorageService.getCurrentVideoInfo();
        } catch (e) {}

        const mergedInfo = {
          ...(existingInfo || {}),
          ...tmdbInfo,
          remarks: existingInfo?.remarks || '',
          source_name: existingInfo?.source_name || '',
          source_code: existingInfo?.source_code || ''
        };

        StorageService.setCurrentVideoInfo(mergedInfo);
        renderPlayerDetailInfo();

        // 同步封面到观看历史记录
        if (tmdbInfo.cover) {
          try {
            const history = StorageService.getViewingHistory();
            const idx = history.findIndex(item => item.title === currentVideoTitle);
            if (idx !== -1) {
              history[idx].cover = tmdbInfo.cover;
              StorageService.setViewingHistory(history);
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
        } else if (document.visibilityState === 'visible') {
            // 页面恢复可见时，检查加载状态是否卡住
            const loadingEl = document.getElementById('player-loading');
            if (loadingEl && loadingEl.style.display !== 'none' && loadingEl.style.display !== '') {
                // 如果视频已初始化但加载状态卡住，尝试隐藏
                if (art && art.video && art.video.currentTime > 0) {
                    loadingEl.style.display = 'none';
                }
            }
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
                if (now - lastSave > TIMING.PROGRESS_SAVE_THROTTLE) { // 每5秒最多保存一次
                    saveCurrentProgress();
                    lastSave = now;
                }
            });

            clearInterval(waitForVideo);
        }
    }, 200);

    // 全局 data-action 事件委托（替代 player.html onclick）
    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        switch (el.dataset.action) {
            case 'go-home': goHome(e); break;
            case 'toggle-detail': toggleDetailInfo(); break;
            case 'toggle-episodes': toggleEpisodeSection(); break;
            case 'toggle-episode-order': e.stopPropagation(); toggleEpisodeOrder(); break;
            case 'copy-links': copyLinks(); break;
            case 'close-modal': closeModal(); break;
            // ---- onclick→data-action 迁移新增 ----
            case 'play-episode': playEpisode(parseInt(el.dataset.index)); break;
            case 'play-video': {
                const url = el.dataset.url;
                const name = el.dataset.name;
                const source = el.dataset.source;
                const index = parseInt(el.dataset.index);
                const vodId = el.dataset.vodId;
                if (url && name) playVideo(url, name, source, index, vodId);
                break;
            }
            case 'show-switch-resource': showSwitchResourceModal(); break;
            case 'switch-to-resource': switchToResource(el.dataset.key, el.dataset.vodId); break;
        }
    });
}

// 处理键盘快捷键
function handleKeyboardShortcuts(e) {
    // 忽略输入框中的按键事件
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // 锁定状态下禁用所有键盘快捷键
    if (controlsLocked) return;

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

// ========== HLS 配置模块 ==========

// ========== HLS 自定义类型模块 ==========

// ========== 播放器实例创建模块 ==========

// ========== 全屏控制模块 ==========

// ========== 播放器事件处理模块 ==========








// ========== 长时间加载提示模块 ==========

// ========== 播放器初始化函数（重构版）==========

// 自定义M3U8 Loader用于过滤广告

// 过滤可疑的广告内容


// 显示错误

// 更新集数信息

// 更新按钮状态

// 渲染集数按钮

// 播放指定集数

// 播放上一集

// 播放下一集

// 复制播放链接

// 切换集数排序

// 更新排序按钮状态

// 设置进度条准确点击和拖动处理（桌面点击 + 移动端触摸滑动）

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
        const parsedInfo = StorageService.getCurrentVideoInfo();
        if (parsedInfo) {
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
        const history = StorageService.getViewingHistory();

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

        StorageService.setViewingHistory(history);
    } catch (e) {
    }
}

// 显示恢复位置提示

// 格式化时间为 mm:ss 格式

// 开始定期保存播放进度
function startProgressSaveInterval() {
    // 清除可能存在的旧计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
    }

    // 每30秒保存一次播放进度
    progressSaveInterval = setInterval(saveCurrentProgress, TIMING.PROGRESS_SAVE_INTERVAL);
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
            const history = StorageService.getViewingHistory();
            if (history.length > 0) {
                
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
                        StorageService.setViewingHistory(history);
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

// 从播放中的视频渐进抓帧，构建进度条缩略图预览（兼容 HLS）

// 设置点击/双击控制行为：单击切换控制栏（含返回按钮+进度条），双击切换暂停/播放，2秒自动收起

// 清除视频进度记录

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

let controlsLocked = false;

// ========== 播放器浮动锁定按钮（右侧居中） ==========






// 选集区域折叠切换

// 选集默认展开


// 测试视频源速率的函数

// 格式化速度显示


// 切换资源的函数