import { goHome } from './navigation';

// 返回导航已迁至 src/ui/player/navigation.ts（阶段 5B-2d）

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
window.addEventListener('pageshow', function (event: PageTransitionEvent) {
    if (event.persisted) {
        // 页面从 bfcache 恢复，强制刷新以确保播放器干净初始化
        window.location.reload();
    }
});


// =================================
// ============== PLAYER ==========
// =================================
// 全局变量
// 阶段 5B-2：播放器状态已迁至 src/ui/player/state.ts。
// 读方沿用变量名（ESM live binding），写方改为 setXxx()。
import {
    art,
    currentEpisodeIndex,
    currentEpisodes,
    currentHls,
    currentVideoTitle,
    currentVideoUrl,
    episodesReversed,
    autoplayEnabled,
    videoHasEnded,
    userClickedPosition,
    shortcutHintTimeout,
    autoFullscreened,
    progressSaveInterval,
    episodeSwitchTimeout,
    controlsLocked,
    setArt,
    setCurrentEpisodeIndex,
    setCurrentEpisodes,
    setCurrentHls,
    setCurrentVideoTitle,
    setCurrentVideoUrl,
    setEpisodesReversed,
    setAutoplayEnabled,
    setVideoHasEnded,
    setUserClickedPosition,
    setShortcutHintTimeout,
    setAutoFullscreened,
    setProgressSaveInterval,
    setEpisodeSwitchTimeout,
    setControlsLocked,
} from './state';
import type { PlayerArtInstance } from './state';
import { getVideoId } from './session';

export type { PlayerArtInstance };

interface ArtplayerStaticExt extends ArtplayerStatic {
    FULLSCREEN_WEB_IN_BODY: boolean;
    REMOVE_SRC_WHEN_DESTROY: boolean;
}

(Artplayer as ArtplayerStaticExt).FULLSCREEN_WEB_IN_BODY = true;
(Artplayer as ArtplayerStaticExt).REMOVE_SRC_WHEN_DESTROY = true;

interface PlayerIndexWindow extends Window {
    _mediaSessionHandlersSet?: boolean;
}

const playerIndexWindow = window as PlayerIndexWindow;

// TMDB 影片详情配置（TMDB优先，视频源API兜底）
const PLAYER_TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TmdbSearchResult {
    media_type?: string;
    id: number;
}

interface TmdbSearchResponse {
    results?: TmdbSearchResult[];
}

interface TmdbNamedItem {
    name?: string;
}

interface TmdbDetailResponse {
    genres?: TmdbNamedItem[];
    production_countries?: TmdbNamedItem[];
    release_date?: string;
    first_air_date?: string;
    poster_path?: string;
    title?: string;
    name?: string;
    overview?: string;
    [key: string]: unknown;
}

interface TmdbCreditsResponse {
    crew?: { job?: string; name?: string }[];
    cast?: { name?: string }[];
}

interface PlayerTmdbInfo {
    title?: string;
    cover: string;
    desc: string;
    type: string;
    year: string;
    area: string;
    director: string;
    actor: string;
    fromTmdb: boolean;
}

function getPlayerTmdbBaseUrl(): string {
  if (typeof TMDB_WORKER_URL !== 'undefined' && TMDB_WORKER_URL) {
    return TMDB_WORKER_URL;
  }
  return '/api/tmdb';
}

async function fetchTmdbPlayerDetail(title: string): Promise<PlayerTmdbInfo | null> {
  try {
    const baseUrl = getPlayerTmdbBaseUrl();
    if (!baseUrl) return null;

    const multiUrl = `${baseUrl}?endpoint=search/multi&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
    const res = await fetch(multiUrl);
    if (!res.ok) return null;

    const data = await res.json() as TmdbSearchResponse;
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
      detailRes.json() as Promise<TmdbDetailResponse>,
      creditsRes.ok ? creditsRes.json() as Promise<TmdbCreditsResponse> : Promise.resolve({ crew: [], cast: [] })
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
    // 远端数据源：播放页只用本地缓存同步合并，不发起网络请求。
    // 首页已经负责拉取并写缓存；播放页为首屏速度让路（尤其从收藏直接打开播放页时）。
    if (typeof window.applyRemoteApiSitesFromCache === 'function') {
        window.applyRemoteApiSitesFromCache();
    }
    initializePageContent();
});

// 监听密码验证成功事件


// 初始化页面内容
function initializePageContent(): void {

    // 解析URL参数
    const urlParams = new URLSearchParams(window.location.search);
    let videoUrl = urlParams.get('url');
    const title = urlParams.get('title');
    const sourceCode = urlParams.get('source');
    let index = parseInt(urlParams.get('index') || '0');
    const episodesList = urlParams.get('episodes'); // 从URL获取集数信息
    const savedPosition = parseInt(urlParams.get('position') || '0'); // 获取保存的播放位置
    // 解决历史记录问题：检查URL是否是src/pages/player/index.html开头的链接
    // 如果是，说明这是历史记录重定向，需要解析真实的视频URL
    if (videoUrl && videoUrl.includes('src/pages/player/index.html')) {
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
            console.warn('[LeLeTV] 解析嵌套URL参数失败:', e);
        }
    }
    setCurrentVideoUrl(videoUrl || '');

    // 从localStorage获取数据
    setCurrentVideoTitle(title || localStorage.getItem('currentVideoTitle') || '未知视频');
    setCurrentEpisodeIndex(index);

    // 设置自动连播开关状态
    setAutoplayEnabled(localStorage.getItem('autoplayEnabled') !== 'false'); // 默认为true
    const autoplayToggle = document.getElementById('autoplayToggle') as HTMLInputElement;
    autoplayToggle.checked = autoplayEnabled;

    // 监听自动连播开关变化
    autoplayToggle.addEventListener('change', function (e) {
        setAutoplayEnabled((e.target as HTMLInputElement).checked);
        localStorage.setItem('autoplayEnabled', String(autoplayEnabled));
    });

    // 优先使用URL传递的集数信息，否则从localStorage获取
    try {
        if (episodesList) {
            // 如果URL中有集数数据，优先使用它
            setCurrentEpisodes(JSON.parse(decodeURIComponent(episodesList)) as string[]);

        } else {
            // 否则从localStorage获取
            setCurrentEpisodes(JSON.parse(localStorage.getItem('currentEpisodes') || '[]') as string[]);

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
            newUrl.searchParams.set('index', String(index));
            window.history.replaceState({}, '', newUrl);
        }

        // 更新当前索引为验证过的值
        setCurrentEpisodeIndex(index);

        setEpisodesReversed(localStorage.getItem('episodesReversed') === 'true');
    } catch (e) {
        console.warn('[LeLeTV] 解析剧集列表失败，使用默认值:', e);
        setCurrentEpisodes([]);
        setCurrentEpisodeIndex(0);
        setEpisodesReversed(false);
    }

    // 设置页面标题
    document.title = currentVideoTitle + ' - LeLeTV播放器';
    const videoTitle = document.getElementById('videoTitle');
    if (videoTitle) videoTitle.textContent = currentVideoTitle;
    const videoTitleRight = document.getElementById('videoTitleRight');
    if (videoTitleRight) videoTitleRight.textContent = currentVideoTitle;

    // 初始化播放器
    if (videoUrl) {
        // 直接视频URL（历史记录播放），立即渲染并初始化
        renderPlayerDetailInfo();
        initPlayer(videoUrl);

        // 如果有 id 和 source 参数（历史记录路径携带），异步获取详情信息更新 UI
        const vodId = urlParams.get('id');
        if (vodId && sourceCode) {
            fetchDetailInfo(vodId, sourceCode);
        }
    } else if (urlParams.get('id') && sourceCode) {
        // 从搜索卡片直接跳转（无url参数），异步加载剧集详情
        // 注意：不要在这里调用 renderPlayerDetailInfo 等渲染函数
        // fetchDetailAndInit 会处理所有渲染
        const vodId = urlParams.get('id');
        fetchDetailAndInit(vodId, sourceCode, title, index);
    } else {
        showError('无效的视频链接');
    }

    // 渲染源信息（仅对有直接URL的情况，因为搜索卡片路径由fetchDetailAndInit处理）
    if (videoUrl) {
        renderResourceInfoBar();
        updateEpisodeInfo();
        renderEpisodes();
        updateButtonStates();
        updateOrderButton();
        updateEpisodeCollapseState();
    }

    // 异步获取TMDB数据增强详情（TMDB优先，API源数据兜底）
    // 注意：搜索卡片路径的TMDB增强由fetchDetailAndInit内部处理
    if (videoUrl) {
        fetchTmdbPlayerDetail(currentVideoTitle).then(tmdbInfo => {
            if (tmdbInfo) {
                let existingInfo: Record<string, unknown> | null = null;
                try {
                    existingInfo = StorageService.getCurrentVideoInfo();
                } catch (e) {
                    console.warn('[LeLeTV] 获取 TMDB 已有详情失败:', e);
                }
                    const mergedInfo: Record<string, unknown> = {
                    ...tmdbInfo,
                    ...(existingInfo || {}),
                    // 但 TMDB 的封面通常质量更好，优先使用
                    cover: tmdbInfo.cover || existingInfo?.cover || '',
                    // 始终保留源信息
                    remarks: existingInfo?.remarks || '',
                    source_name: existingInfo?.source_name || '',
                    source_code: existingInfo?.source_code || ''
                };

                StorageService.setCurrentVideoInfo(mergedInfo);
                renderPlayerDetailInfo();

                // 同步 TMDB 元数据到观看历史：下次从历史进入可直接恢复简介/海报，不必等接口
                try {
                    const history = StorageService.getViewingHistory() as ViewingHistoryItem[];
                    const idx = history.findIndex(item => item.title === currentVideoTitle);
                    if (idx !== -1) {
                        ['cover', 'desc', 'type', 'year', 'area', 'director', 'actor'].forEach(key => {
                            if (mergedInfo[key]) history[idx][key] = mergedInfo[key];
                        });
                        StorageService.setViewingHistory(history);
                    }
                } catch (e) {
                    console.warn('[LeLeTV] 更新历史记录TMDB信息失败:', e);
                }
            }
        });
    }

    // 添加对进度条的监听，确保点击准确跳转
    setTimeout(() => {
        setupProgressBarPreciseClicks();
    }, 1000);

    // 添加键盘快捷键事件监听
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // 添加页面离开事件监听，保存播放位置（用 pagehide 而非 beforeunload，以支持 bfcache 快照恢复）
    window.addEventListener('pagehide', saveCurrentProgress);

    // 新增：页面隐藏（切后台/切标签）时也保存
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            saveCurrentProgress();
        } else if (document.visibilityState === 'visible') {
            // 页面恢复可见，不需要特殊处理
        }
    });

    // 视频暂停时也保存
    const waitForVideo = setInterval(() => {
        if (art && art.video) {
            art.video.addEventListener('pause', saveCurrentProgress);

            // 播放进度变化时节流保存（每5秒最多一次）
            let lastSaveTime = 0;
            art.video.addEventListener('timeupdate', function() {
                const now = performance.now();
                if (now - lastSaveTime > TIMING.PROGRESS_SAVE_THROTTLE) {
                    saveCurrentProgress();
                    lastSaveTime = now;
                }
            });

            clearInterval(waitForVideo);
        }
    }, 200);

    // 全局 data-action 事件委托（替代 src/pages/player/index.html onclick）
    document.addEventListener('click', function (e) {
        const target = e.target as HTMLElement;
        const el = target.closest('[data-action]') as HTMLElement | null;
        if (!el) return;
        switch (el.dataset.action) {
            case 'go-home': goHome(e); break;
            case 'toggle-detail': toggleDetailInfo(); break;
            case 'edit-video-info': showEditVideoInfoModal(); break;
            case 'toggle-episodes': toggleEpisodeSection(); break;
            case 'toggle-episode-order': e.stopPropagation(); toggleEpisodeOrder(); break;
            case 'copy-links': copyLinks(); break;
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
            case 'toggle-resource-list': toggleResourceList(); break;
            case 'switch-to-resource': switchToResource(el.dataset.key, el.dataset.vodId); break;
        }
    });
}

// 处理键盘快捷键


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
function saveToHistory(): void {
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
    let show_identifier_for_video_info: string;
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
            currentVideoCover = (parsedInfo.cover || parsedInfo.vod_pic || '') as string;
        }
    } catch (e) {
        console.warn('[LeLeTV] saveToHistory 获取封面失败:', e);
    }
    const videoInfo: ViewingHistoryItem = {
        title: currentVideoTitle,
        directVideoUrl: currentVideoUrl, // Current episode's direct URL
        url: `src/pages/player/index.html?url=${encodeURIComponent(currentVideoUrl)}&title=${encodeURIComponent(currentVideoTitle)}&source=${encodeURIComponent(sourceName)}&source_code=${encodeURIComponent(sourceCode)}&id=${encodeURIComponent(id_from_params || '')}&index=${currentEpisodeIndex}&position=${Math.floor(currentPosition || 0)}`,
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
        const history = StorageService.getViewingHistory() as ViewingHistoryItem[];

        // 查找相同标题的剧集（不管播放源如何，只保留最新播放源）
        const existingIndex = history.findIndex(item =>
            item.title === videoInfo.title
        );

        if (existingIndex !== -1) {
            // 找到相同标题的剧集：更新为最新播放源的信息
            const existingItem = history[existingIndex];

            // 检测剧集是否已切换（用于重置播放进度，防止换集后保留旧集数的位置）
            const episodeChanged = existingItem.episodeIndex !== videoInfo.episodeIndex;

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
            // 剧集切换时，直接使用新位置（即使为0）；同集时用 >10 守卫避免覆盖
            existingItem.playbackPosition = (episodeChanged || videoInfo.playbackPosition > 10) ? videoInfo.playbackPosition : (existingItem.playbackPosition || 0);
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
        console.warn('[LeLeTV] saveToHistory 写入失败:', e);
    }
}

// 格式化时间为 mm:ss 格式

// 开始定期保存播放进度
function startProgressSaveInterval(): void {
    // 清除可能存在的旧计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
    }

    // 每30秒保存一次播放进度
    setProgressSaveInterval(setInterval(saveCurrentProgress, TIMING.PROGRESS_SAVE_INTERVAL));
}

// 保存当前播放进度
let _lastHistoryWriteTime = 0;
function saveCurrentProgress(): void {
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
            const history = StorageService.getViewingHistory() as ViewingHistoryItem[];
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
                    // 注意：url 必须是播放页地址。m3u8 直链导入时没有 episodes，saveToHistory 不会写入，
                    // 这里若直接存 currentVideoUrl，历史页点击会把 m3u8 交给系统播放器
                    let currentInfo: Record<string, unknown> | null = null;
                    try { currentInfo = StorageService.getCurrentVideoInfo(); } catch (e) { /* 忽略 */ }
                    addToViewingHistory({
                        title: currentVideoTitle,
                        url: `src/pages/player/index.html?url=${encodeURIComponent(currentVideoUrl)}&title=${encodeURIComponent(currentVideoTitle)}&source=${encodeURIComponent(sourceName || '')}&source_code=${encodeURIComponent(sourceName || '')}&id=${encodeURIComponent(vod_id || '')}&index=${currentEpisodeIndex}&position=${Math.floor(currentTime)}`,
                        sourceName: sourceName || '',
                        vod_id: vod_id || '',
                        episodeIndex: currentEpisodeIndex,
                        playbackPosition: currentTime,
                        duration: duration,
                        episodes: currentEpisodes || [],
                        // 把已经补全的详情一并写进历史，下次从历史进入可直接显示
                        cover: (currentInfo && currentInfo.cover) || '',
                        desc: (currentInfo && currentInfo.desc) || '',
                        type: (currentInfo && currentInfo.type) || '',
                        year: (currentInfo && currentInfo.year) || '',
                        area: (currentInfo && currentInfo.area) || '',
                        director: (currentInfo && currentInfo.director) || '',
                        actor: (currentInfo && currentInfo.actor) || ''
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

// 获取视频唯一标识（阶段 5B-2b：已迁至 src/ui/player/session.ts）

// ========== Media Session API ==========

type MediaHandler = (details?: { seekTime?: number | null }) => void;

function updateMediaSession(): void {
    if (!('mediaSession' in navigator)) return;

    const coverUrl = getVideoCover();
    const episodeStr = currentEpisodes.length > 1
        ? `第${currentEpisodeIndex + 1}/${currentEpisodes.length}集`
        : '';

    navigator.mediaSession.metadata = new MediaMetadata({
        title: currentVideoTitle,
        artist: 'LeLeTV',
        album: episodeStr || 'LeLeTV',
        artwork: [
            { src: coverUrl, sizes: '256x256', type: 'image/png' },
            { src: coverUrl, sizes: '512x512', type: 'image/png' },
        ]
    });

    // 只在第一次设置 action handlers
    if (playerIndexWindow._mediaSessionHandlersSet) return;
    playerIndexWindow._mediaSessionHandlersSet = true;

    const handlers: Record<string, MediaHandler> = {
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
            navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler as MediaSessionActionHandler);
        } catch (e) {
            // 某些浏览器不支持所有 action，静默跳过
        }
    }
}

// 异步获取视频详情并初始化播放器（用于搜索卡片直接跳转场景）
async function fetchDetailAndInit(vodId: string, sourceCode: string, title: string | null, episodeIndex = 0): Promise<void> {
    // 构建API参数（支持自定义源）
    let apiParams = '';
    if (sourceCode.startsWith('custom_')) {
        const customIndex = sourceCode.replace('custom_', '');
        const customApi = typeof getCustomApiInfo === 'function' ? getCustomApiInfo(customIndex) : null;
        if (!customApi) {
            showError('自定义API配置无效');
            return;
        }
        if (customApi.detail) {
            apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
        } else {
            apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
        }
    } else {
        apiParams = '&source=' + sourceCode;
    }

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}&_t=${timestamp}`);
        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
        const data = await response.json() as DetailData;

        if (!data.episodes || data.episodes.length === 0) {
            showError('没有可用的视频资源');
            return;
        }

        const episodes = data.episodes;
        setCurrentVideoTitle(title || localStorage.getItem('currentVideoTitle') || '未知视频');
        setCurrentEpisodeIndex(episodeIndex);
        setCurrentEpisodes(episodes);

        // 保存到localStorage
        try {
            localStorage.setItem('currentVideoTitle', currentVideoTitle);
            localStorage.setItem('currentEpisodes', JSON.stringify(episodes));
            localStorage.setItem('currentEpisodeIndex', String(episodeIndex));
            localStorage.setItem('currentSourceCode', sourceCode || '');
            if (data.videoInfo) {
                localStorage.setItem('currentVideoInfo', JSON.stringify(data.videoInfo));
            }
        } catch (e) {
            console.warn('[LeLeTV] fetchDetailAndInit 保存本地状态失败:', e);
        }

        // 更新页面标题和标题显示
        document.title = currentVideoTitle + ' - LeLeTV播放器';
        const elTitle = document.getElementById('videoTitle');
        if (elTitle) elTitle.textContent = currentVideoTitle;
        const elTitleRight = document.getElementById('videoTitleRight');
        if (elTitleRight) elTitleRight.textContent = currentVideoTitle;

        // 渲染详情、集数、源信息
        renderPlayerDetailInfo();
        renderResourceInfoBar();
        updateEpisodeInfo();
        renderEpisodes();
        updateButtonStates();
        updateOrderButton();

        // 播放第一集（或指定集）
        const targetIndex = episodeIndex < episodes.length ? episodeIndex : 0;
        const episodeUrl = episodes[targetIndex];
        if (episodeUrl) {
            setCurrentVideoUrl(episodeUrl);
            setCurrentEpisodeIndex(targetIndex);
            initPlayer(episodeUrl);
        } else {
            showError('没有可播放的视频资源');
        }
    } catch (e) {
        console.error('[LeLeTV] fetchDetailAndInit 失败:', e);
        showError('获取视频详情失败，请稍后重试');
    }
}

// 静默获取视频详情并更新UI（用于历史记录路径，不重新初始化播放器）
async function fetchDetailInfo(vodId: string, sourceCode: string): Promise<void> {
    let apiParams = '';
    if (sourceCode.startsWith('custom_')) {
        const customIndex = sourceCode.replace('custom_', '');
        const customApi = typeof getCustomApiInfo === 'function' ? getCustomApiInfo(customIndex) : null;
        if (!customApi) return;
        if (customApi.detail) {
            apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
        } else {
            apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
        }
    } else {
        apiParams = '&source=' + sourceCode;
    }

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}&_t=${timestamp}`);
        if (!response.ok) return;
        const data = await response.json() as DetailData;

        // 保存视频详情到 localStorage，更新UI
        if (data.videoInfo) {
            StorageService.setCurrentVideoInfo(data.videoInfo);
            renderPlayerDetailInfo();
            renderResourceInfoBar();
        }

        // 如果历史记录的剧集列表为空，但API有返回，则补充
        if (data.episodes && data.episodes.length > 0 && (!currentEpisodes || currentEpisodes.length === 0)) {
            setCurrentEpisodes(data.episodes);
            localStorage.setItem('currentEpisodes', JSON.stringify(data.episodes));
            renderEpisodes();
            updateEpisodeInfo();
            updateButtonStates();
        }
    } catch (e) {
        console.warn('[LeLeTV] fetchDetailInfo 静默刷新详情失败:', e);
    }
}

// ========== 下一集按钮（直接 DOM 注入） ==========

// controlsLocked 已迁至 src/ui/player/state.ts

// ========== 播放器浮动锁定按钮（右侧居中） ==========





// 选集区域折叠切换

// 选集默认展开


// 测试视频源速率的函数

// 格式化速度显示


// 切换资源的函数

// 阶段 5A-6 过渡期兼容桥：player bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  goHome,
  saveToHistory,
  startProgressSaveInterval,
  saveCurrentProgress,
  getVideoId,
  updateMediaSession
});

Object.defineProperty(window, 'currentVideoTitle', {
  get: () => currentVideoTitle,
  set: (v) => { setCurrentVideoTitle(v); },
  configurable: true,
});

Object.defineProperty(window, 'currentEpisodeIndex', {
  get: () => currentEpisodeIndex,
  set: (v) => { setCurrentEpisodeIndex(v); },
  configurable: true,
});

Object.defineProperty(window, 'art', {
  get: () => art,
  set: (v) => { setArt(v); },
  configurable: true,
});

Object.defineProperty(window, 'currentHls', {
  get: () => currentHls,
  set: (v) => { setCurrentHls(v); },
  configurable: true,
});

Object.defineProperty(window, 'currentEpisodes', {
  get: () => currentEpisodes,
  set: (v) => { setCurrentEpisodes(v); },
  configurable: true,
});

Object.defineProperty(window, 'episodesReversed', {
  get: () => episodesReversed,
  set: (v) => { setEpisodesReversed(v); },
  configurable: true,
});

Object.defineProperty(window, 'autoplayEnabled', {
  get: () => autoplayEnabled,
  set: (v) => { setAutoplayEnabled(v); },
  configurable: true,
});

Object.defineProperty(window, 'videoHasEnded', {
  get: () => videoHasEnded,
  set: (v) => { setVideoHasEnded(v); },
  configurable: true,
});

Object.defineProperty(window, 'userClickedPosition', {
  get: () => userClickedPosition,
  set: (v) => { setUserClickedPosition(v); },
  configurable: true,
});

Object.defineProperty(window, 'shortcutHintTimeout', {
  get: () => shortcutHintTimeout,
  set: (v) => { setShortcutHintTimeout(v); },
  configurable: true,
});

Object.defineProperty(window, 'autoFullscreened', {
  get: () => autoFullscreened,
  set: (v) => { setAutoFullscreened(v); },
  configurable: true,
});

Object.defineProperty(window, 'progressSaveInterval', {
  get: () => progressSaveInterval,
  set: (v) => { setProgressSaveInterval(v); },
  configurable: true,
});

Object.defineProperty(window, 'currentVideoUrl', {
  get: () => currentVideoUrl,
  set: (v) => { setCurrentVideoUrl(v); },
  configurable: true,
});

Object.defineProperty(window, 'episodeSwitchTimeout', {
  get: () => episodeSwitchTimeout,
  set: (v) => { setEpisodeSwitchTimeout(v); },
  configurable: true,
});

Object.defineProperty(window, 'controlsLocked', {
  get: () => controlsLocked,
  set: (v) => { setControlsLocked(v); },
  configurable: true,
});

// 阶段 5B-2 过渡期类型桥：index.ts 已成为 ESM 模块，其他 player 模块仍以裸名
// 访问这些入口函数（运行时由上方 window 兼容桥提供）。5B-2d 改为 import 后删除。
declare global {
  function saveToHistory(): void;
  function startProgressSaveInterval(): void;
  function saveCurrentProgress(): void;
  function updateMediaSession(): void;
}
