import { scopedKey, isHiddenContentMode } from '../core/config';
import type { ApiSite } from '../core/config';
import type { ViewingHistoryItem } from '../core/storage';

interface ViewingHistoryInput {
    [key: string]: unknown;
    title: string;
    url: string;
    episodeIndex?: number;
    sourceName?: string;
    sourceCode?: string;
    vod_id?: string | number;
    episodes?: string[];
    playbackPosition?: number;
    duration?: number;
    showIdentifier?: string;
    directVideoUrl?: string;
}

interface VideoDetailsResponse {
    episodes?: string[];
    videoInfo?: Record<string, unknown>;
    [key: string]: unknown;
}

interface ViewingHistoryWindow extends Window {
    API_SITES?: Record<string, ApiSite>;
    initViewingHistoryBindings?: () => void;
}

declare function formatTimestamp(timestamp: number | string): string;
declare function formatPlaybackTime(seconds: number): string;
declare function dissolveThenRemove(el: Element, action: () => void): void;

const viewingHistoryWindow = window as ViewingHistoryWindow;

export function getViewingHistory(): ViewingHistoryItem[] {
    try {
        const data = localStorage.getItem(scopedKey('viewingHistory'));
        return data ? JSON.parse(data) as ViewingHistoryItem[] : [];
    } catch (e) {
        console.error('获取观看历史失败:', e);
        return [];
    }
}

export function loadViewingHistory(): void {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    // 私密模式下分类页整体隐藏：这个入口一并隐藏，避免点过去变成"跳首页"
    const categoryEntryHidden = typeof isHiddenContentMode === 'function' && isHiddenContentMode();

    const history = getViewingHistory();

    // 页头：「清空记录」（没有记录时藏起来）
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) clearBtn.hidden = history.length === 0;

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="v2-state">
                <span class="v2-state-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 7.5V12l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg></span>
                <h3>还没有观看记录</h3>
                <p>播放过的影片会按时间顺序出现在这里，并记住上次看到的位置。</p>
                ${categoryEntryHidden ? '' : '<button type="button" data-action="switch-to-category" class="v2-btn v2-btn--secondary v2-btn--sm">浏览分类</button>'}
            </div>
        `;
        return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setDate(weekAgoStart.getDate() - 7);

    const groups: Record<'今天' | '昨天' | '本周' | '更早', ViewingHistoryItem[]> = { '今天': [], '昨天': [], '本周': [], '更早': [] };

    history.forEach(item => {
        const itemDate = new Date(item.timestamp);
        const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

        if (itemDay >= todayStart) {
            groups['今天'].push(item);
        } else if (itemDay >= yesterdayStart) {
            groups['昨天'].push(item);
        } else if (itemDay >= weekAgoStart) {
            groups['本周'].push(item);
        } else {
            groups['更早'].push(item);
        }
    });

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
        if (items.length === 0) continue;

        html += `
            <div class="history-group">
                <div class="history-group-title">${groupName}</div>
                <div class="history-grid">
                    ${items.map(item => renderHistoryCard(item)).join('')}
                </div>
            </div>
        `;
    }

    historyList.innerHTML = html;
}

function renderHistoryCard(item: ViewingHistoryItem): string {
    const safeTitle = item.title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, "\\'");

    // 将源代码名称映射为显示名称（如 wujin → 无尽资源）
    const sourceDisplayName = item.sourceName && viewingHistoryWindow.API_SITES && viewingHistoryWindow.API_SITES[item.sourceName]
        ? viewingHistoryWindow.API_SITES[item.sourceName].name
        : item.sourceName;
    const safeSource = sourceDisplayName ?
        sourceDisplayName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') :
        '未知来源';

    const episodeText = item.episodeIndex !== undefined ? `第${item.episodeIndex + 1}集` : '';
    const safeURL = encodeURIComponent(item.url);

    let totalsHtml = '';
    if (item.episodes && Array.isArray(item.episodes) && item.episodes.length > 0) {
        totalsHtml = `共${item.episodes.length}集`;
    }

    let progressHtml = '';
    if (item.playbackPosition && item.duration && item.playbackPosition > 10 && item.playbackPosition < item.duration * 0.95) {
        const percent = Math.round((item.playbackPosition / item.duration) * 100);
        const formattedTime = formatPlaybackTime(item.playbackPosition);
        const formattedDuration = formatPlaybackTime(item.duration);
        progressHtml = `
            <div class="history-progress">
                <div class="progress-bar">
                    <div class="progress-filled" style="transform:scaleX(${percent/100})"></div>
                </div>
                <div class="progress-text">${formattedTime} / ${formattedDuration}</div>
            </div>
        `;
    }

    const cover = item.cover;
    const hasCover = !!cover && /^https?:\/\//.test(cover);
    const coverUrl = hasCover && cover ? cover.replace(/"/g, '%22') : '';
    const placeholder = '<div class="history-cover-placeholder"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z"/></svg></div>';

    // 封面失败时换成占位（通过 data 属性取模板，不在 onerror 里拼 HTML）
    const coverHtml = hasCover
        ? `<img src="${coverUrl}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.outerHTML=this.parentElement.dataset.placeholder;">`
        : placeholder;

    return `
        <div class="history-item" data-action="play-from-history" role="button" tabindex="0"
             data-url="${String(item.url || '').replace(/"/g, '&quot;')}" 
             data-title="${safeTitle}" 
             data-index="${item.episodeIndex || 0}" 
             data-position="${item.playbackPosition || 0}">
            <button type="button" data-action="delete-history-item" data-url="${safeURL}" data-title="${safeTitle}"
                    class="delete-btn" aria-label="删除这条记录">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
            <div class="history-cover" data-placeholder="${placeholder.replace(/"/g, '&quot;')}">
                ${coverHtml}
            </div>
            <div class="history-content">
                <div class="history-title">${safeTitle}</div>
                <div class="history-meta-row">
                    <div class="history-meta-left">
                        ${episodeText ? `<span class="history-episode">${episodeText}</span>` : ''}
                        ${episodeText ? '<span class="history-separator">·</span>' : ''}
                        <span class="history-source">${safeSource}</span>
                        ${totalsHtml ? '<span class="history-separator">·</span>' : ''}
                        ${totalsHtml ? `<span class="history-episode-total">${totalsHtml}</span>` : ''}
                    </div>
                    <span class="history-time">${formatTimestamp(item.timestamp)}</span>
                </div>
                ${progressHtml}
            </div>
        </div>
    `;
}

export function deleteHistoryItem(encodedUrl: string, title: string, cardEl: Element | null): void {
    // 真正的删除：数据落盘 + 重渲染列表
    const removeRecord = () => {
        try {
            // 解码URL
            const url = decodeURIComponent(encodedUrl);

            // 获取当前历史记录
            const history = getViewingHistory();

            // 过滤掉要删除的项
            const newHistory = history.filter(item => item.url !== url);

            // 保存回localStorage
            localStorage.setItem(scopedKey('viewingHistory'), JSON.stringify(newHistory));

            // 重新加载历史记录显示
            loadViewingHistory();

            // 显示成功提示
            showToast('已删除该记录', 'success');
        } catch (e) {
            console.error('删除历史记录项失败:', e);
            showToast('删除记录失败', 'error');
        }
    };

    // 先让该条记录化作粒子消散，播完再真正删除（缺元素或播放页等降级场景直接删）
    if (cardEl && typeof dissolveThenRemove === 'function') {
        dissolveThenRemove(cardEl, removeRecord);
    } else {
        removeRecord();
    }
}

export async function playFromHistory(url: string, title: string, episodeIndex: number, playbackPosition = 0): Promise<void> {
    try {
        let episodesList: string[] = [];
        let historyItem: ViewingHistoryItem | null = null;

        // 获取历史记录（localStorage，快速）
        const historyRaw = localStorage.getItem(scopedKey('viewingHistory'));
        if (historyRaw) {
            const history = JSON.parse(historyRaw) as ViewingHistoryItem[];
            historyItem = history.find(item => item.url === url) || null;

            if (historyItem && historyItem.episodes && Array.isArray(historyItem.episodes)) {
                episodesList = historyItem.episodes;
            }
        }

        // 在跳转前将历史记录的正确数据写入 localStorage，
        // 防止播放页读取到上一部剧的残留数据（playDirectly 也有类似的清理逻辑）
        if (historyItem) {
            if (historyItem.episodes && Array.isArray(historyItem.episodes) && historyItem.episodes.length > 0) {
                localStorage.setItem('currentEpisodes', JSON.stringify(historyItem.episodes));
            } else {
                localStorage.removeItem('currentEpisodes');
            }
            localStorage.setItem('currentEpisodeIndex', String(episodeIndex || 0));

            // 历史记录里存有手动编辑 / TMDB 补全过的详情时直接恢复；没有才清掉上一部剧的残留
            const meta: Record<string, unknown> = {};
            ['cover', 'desc', 'type', 'year', 'area', 'director', 'actor', 'remarks'].forEach(key => {
                if (historyItem[key]) meta[key] = historyItem[key];
            });
            if (Object.keys(meta).length > 0) {
                localStorage.setItem('currentVideoInfo', JSON.stringify(meta));
            } else {
                localStorage.removeItem('currentVideoInfo');
            }
        }

        // 后台静默同步（异步刷新剧集列表，不阻塞导航）
        // 注意：直链记录没有 vod_id/sourceName，不需要同步，也不能在这里清掉上面刚恢复的详情
        if (historyItem && historyItem.vod_id && historyItem.sourceName) {
            syncEpisodesInBackground(historyItem, url);
        }

        // 保存当前页面URL作为返回地址（含 hash，保留历史记录/类别页状态）
        let currentPath: string;
        if (window.location.pathname.startsWith('/src/pages/player/index.html')) {
            currentPath = localStorage.getItem('lastPageUrl') || '/';
        } else {
            currentPath = window.location.origin + window.location.pathname + window.location.search + window.location.hash;
        }
        localStorage.setItem('lastPageUrl', currentPath);

        // 构造播放器URL
        let playerUrl: string;
        const sourceNameForUrl = historyItem ? historyItem.sourceName : (new URLSearchParams(new URL(url, window.location.origin).search)).get('source');
        const sourceCodeForUrl = historyItem ? historyItem.sourceCode || historyItem.sourceName : (new URLSearchParams(new URL(url, window.location.origin).search)).get('source_code');
        const idForUrl = historyItem ? historyItem.vod_id : '';


        if (url.includes('src/pages/player/index.html')) {
            // 检测到嵌套播放链接，解析真实URL
            try {
                const nestedUrl = new URL(url, window.location.origin);
                const nestedParams = nestedUrl.searchParams;

                // 判断URL格式：新格式(id+source) 还是 旧格式(url)
                const isNewFormat = nestedParams.has('id') && !nestedParams.has('url');

                if (isNewFormat) {
                    // 新格式：搜索直达，用 id+source 重建URL
                    const vodId = idForUrl || nestedParams.get('id') || '';
                    const sourceForUrl = sourceNameForUrl || nestedParams.get('source') || '';
                    playerUrl = `src/pages/player/index.html?id=${encodeURIComponent(vodId)}&title=${encodeURIComponent(title)}&source=${encodeURIComponent(sourceForUrl)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                } else {
                    // 旧格式：有直链视频URL
                    const realVideoUrl = nestedParams.get('url') || url;
                    playerUrl = `src/pages/player/index.html?url=${encodeURIComponent(realVideoUrl)}&title=${encodeURIComponent(title)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceNameForUrl) playerUrl += `&source=${encodeURIComponent(sourceNameForUrl)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                    if (idForUrl) playerUrl += `&id=${encodeURIComponent(String(idForUrl))}`;
                }

            } catch (e) {
                // console.error('解析嵌套URL出错:', e);
                const fallbackId = idForUrl || '';
                if (fallbackId) {
                    // 新格式兜底
                    playerUrl = `src/pages/player/index.html?id=${encodeURIComponent(fallbackId)}&title=${encodeURIComponent(title)}&source=${encodeURIComponent(sourceNameForUrl || '')}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                } else {
                    // 旧格式兜底
                    playerUrl = `src/pages/player/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceNameForUrl) playerUrl += `&source=${encodeURIComponent(sourceNameForUrl)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                    if (idForUrl) playerUrl += `&id=${encodeURIComponent(String(idForUrl))}`;
                }
            }
        } else {
            // 直链（如搜索框导入的 m3u8）也必须经过播放页：
            // 直接 location.href 到 m3u8 会被浏览器/系统播放器接管，绕过 ArtPlayer
            playerUrl = `src/pages/player/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
            if (sourceNameForUrl) playerUrl += `&source=${encodeURIComponent(sourceNameForUrl)}`;
            if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
            if (idForUrl) playerUrl += `&id=${encodeURIComponent(String(idForUrl))}`;
        }

        // 站内同标签页导航标记：播放页返回时据此走 history.back()（见 js/player/player.js goHome）
        try {
            sessionStorage.setItem('leletv_player_from_tab', '1');
        } catch (e) { /* 忽略 */ }
        window.location.href = playerUrl;
    } catch (e) {
        const simpleUrl = `src/pages/player/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}`;
        try {
            sessionStorage.setItem('leletv_player_from_tab', '1');
        } catch (err) { /* 忽略 */ }
        window.location.href = simpleUrl;
    }
}

// 后台静默同步剧集列表（不阻塞导航）
async function syncEpisodesInBackground(historyItem: ViewingHistoryItem, url: string): Promise<void> {
    try {
        const timestamp = new Date().getTime();
        const apiUrl = `/api/detail?id=${encodeURIComponent(String(historyItem.vod_id))}&source=${encodeURIComponent(String(historyItem.sourceName))}&_t=${timestamp}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) return;
        const videoDetails = await response.json() as VideoDetailsResponse;

        if (videoDetails && videoDetails.episodes && videoDetails.episodes.length > 0) {
            // 更新localStorage中的剧集列表（播放页已读取时下次生效）
            localStorage.setItem('currentEpisodes', JSON.stringify(videoDetails.episodes));
            if (videoDetails.videoInfo) {
                localStorage.setItem('currentVideoInfo', JSON.stringify(videoDetails.videoInfo));
            }

            // 更新历史记录中的剧集列表
            const raw = localStorage.getItem(scopedKey('viewingHistory'));
            if (raw) {
                const history = JSON.parse(raw) as ViewingHistoryItem[];
                const idx = history.findIndex(item => item.url === url);
                if (idx !== -1) {
                    history[idx].episodes = [...videoDetails.episodes];
                    history[idx].lastSyncTime = Date.now();
                    localStorage.setItem(scopedKey('viewingHistory'), JSON.stringify(history));
                }
            }
        }
    } catch (e) {
        // 静默失败，使用缓存的剧集列表播放
    }
}

export function addToViewingHistory(videoInfo: ViewingHistoryInput): void {
    try {
        const history = getViewingHistory();

        // Ensure videoInfo has a showIdentifier
        if (!videoInfo.showIdentifier) {
            if (videoInfo.sourceName && videoInfo.vod_id) {
                videoInfo.showIdentifier = `${videoInfo.sourceName}_${videoInfo.vod_id}`;
            } else {
                // Fallback if critical IDs are missing for the preferred identifier
                videoInfo.showIdentifier = (videoInfo.episodes && videoInfo.episodes.length > 0) ? videoInfo.episodes[0] : videoInfo.directVideoUrl;
            }
        }

        // 优先按 showIdentifier 精确匹配，再按标题合并（同一部剧不同源可合并）
        const existingIndex = history.findIndex(item => {
            if (videoInfo.showIdentifier && item.showIdentifier) {
                return item.showIdentifier === videoInfo.showIdentifier;
            }
            return item.title === videoInfo.title;
        });

        if (existingIndex !== -1) {
            // 找到相同标题的剧集：更新为最新播放源的信息
            const existingItem = history[existingIndex];

            // 检测剧集是否已切换（用于重置播放进度，防止换集后保留旧集数的位置）
            const episodeChanged = existingItem.episodeIndex !== videoInfo.episodeIndex;

            // 更新所有关键信息为最新播放源的
            existingItem.episodeIndex = videoInfo.episodeIndex;
            existingItem.timestamp = Date.now();
            existingItem.sourceName = videoInfo.sourceName; // 强制更新为最新播放源
            existingItem.sourceCode = videoInfo.sourceCode; // 强制更新为最新播放源
            existingItem.vod_id = videoInfo.vod_id || existingItem.vod_id; // 强制更新为最新播放源
            existingItem.directVideoUrl = videoInfo.directVideoUrl || existingItem.directVideoUrl; // 强制更新为最新播放源
            existingItem.url = videoInfo.url; // 强制更新为最新播放源
            const nextPosition = videoInfo.playbackPosition ?? 0;
            existingItem.playbackPosition = (episodeChanged || nextPosition > 10) ? nextPosition : (existingItem.playbackPosition || 0);
            existingItem.duration = videoInfo.duration || existingItem.duration;

            // 更新showIdentifier为最新播放源的标识符
            if (videoInfo.sourceName && videoInfo.vod_id) {
                existingItem.showIdentifier = `${videoInfo.sourceName}_${videoInfo.vod_id}`;
            }

            if (videoInfo.episodes && Array.isArray(videoInfo.episodes) && videoInfo.episodes.length > 0) {
                const existingEpisodes = existingItem.episodes;
                if (!existingEpisodes ||
                    !Array.isArray(existingEpisodes) ||
                    existingEpisodes.length !== videoInfo.episodes.length ||
                    !videoInfo.episodes.every((ep, i) => ep === existingEpisodes[i])) {
                    existingItem.episodes = [...videoInfo.episodes];
                }
            }

            // 移到最前面
            history.splice(existingIndex, 1);
            history.unshift(existingItem);
        } else {
            // 没有找到相同标题：添加为新记录
            const newItem: ViewingHistoryItem = {
                ...videoInfo,
                timestamp: Date.now()
            };

            if (videoInfo.episodes && Array.isArray(videoInfo.episodes)) {
                newItem.episodes = [...videoInfo.episodes];
            } else {
                newItem.episodes = [];
            }

            history.unshift(newItem);
        }

        // 限制历史记录数量为50条
        const maxHistoryItems = 50;
        if (history.length > maxHistoryItems) {
            history.splice(maxHistoryItems);
        }

        // 保存到本地存储
        localStorage.setItem(scopedKey('viewingHistory'), JSON.stringify(history));
    } catch (e) {
        // console.error('保存观看历史失败:', e);
    }
}

// 页头「清空记录」：先确认再清空
function confirmClearViewingHistory(): void {
    const overlay = showModal({
        title: '清空观看记录',
        content: (body: HTMLElement) => {
            body.innerHTML = `
                <p class="v2-confirm-text">将删除本机保存的全部观看记录与播放进度。<strong>此操作无法撤销。</strong></p>
                <div class="v2-dialog-foot is-end">
                    <button type="button" class="v2-btn v2-btn--secondary" data-role="cancel">取消</button>
                    <button type="button" class="v2-btn v2-btn--danger" data-role="confirm">清空</button>
                </div>
            `;
            body.querySelector('[data-role="cancel"]')?.addEventListener('click', () => overlay.remove());
            body.querySelector('[data-role="confirm"]')?.addEventListener('click', () => {
                overlay.remove();
                clearViewingHistory();
            });
        }
    });
}

// 历史页事件绑定：片段按需插入后才可绑定（首屏没有 #historyList）
export function initViewingHistoryBindings(): void {
    const page = document.getElementById('page-history');
    if (!page || page.dataset.leleBound === '1') return;
    page.dataset.leleBound = '1';

    document.getElementById('clearHistoryBtn')?.addEventListener('click', confirmClearViewingHistory);
    // 记录卡片是 role="button" 的 div，键盘回车 / 空格也要能打开
    document.getElementById('historyList')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target as HTMLElement;
        if (!target.classList || !target.classList.contains('history-item')) return;
        e.preventDefault();
        target.click();
    });
}

// 片段按需加载：DOM 就绪时先尝试一次；片段在之后插入时由路由再次调用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewingHistoryBindings);
} else {
    initViewingHistoryBindings();
}
viewingHistoryWindow.initViewingHistoryBindings = initViewingHistoryBindings;

function clearViewingHistory(): void {
    try {
        localStorage.removeItem(scopedKey('viewingHistory'));
        loadViewingHistory(); // 重新加载空的历史记录
        showToast('观看记录已清空', 'success');
    } catch (e) {
        // console.error('清除观看历史失败:', e);
        showToast('清除观看历史失败', 'error');
    }
}

// 阶段 5A-4 过渡期兼容桥：app bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  getViewingHistory,
  loadViewingHistory,
  deleteHistoryItem,
  playFromHistory,
  addToViewingHistory,
  initViewingHistoryBindings
});

// 阶段 5B-3 过渡期类型桥：viewing-history.ts 已成为 ESM 模块，尚未改为 import 的
// 调用方仍以裸名访问。
declare global {
  function getViewingHistory(): ViewingHistoryItem[];
  function loadViewingHistory(): void;
  function deleteHistoryItem(encodedUrl: string, title: string, cardEl: Element | null): void;
  function playFromHistory(url: string, title: string, episodeIndex: number, playbackPosition?: number): Promise<void>;
  function addToViewingHistory(videoInfo: Record<string, unknown>): void;
  function initViewingHistoryBindings(): void;
}
