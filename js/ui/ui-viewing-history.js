function getViewingHistory() {
    try {
        const data = localStorage.getItem(scopedKey('viewingHistory'));
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('获取观看历史失败:', e);
        return [];
    }
}

function loadViewingHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    // 私密模式下分类页整体隐藏：这个入口一并隐藏，避免点过去变成"跳首页"
    const categoryEntryHidden = typeof isHiddenContentMode === 'function' && isHiddenContentMode();

    const history = getViewingHistory();

    // 页头：条数与「清空记录」
    const countEl = document.getElementById('historyCount');
    if (countEl) countEl.textContent = history.length ? `共 ${history.length} 条，仅保存在本机浏览器` : '仅保存在本机浏览器';
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

    const groups = { '今天': [], '昨天': [], '本周': [], '更早': [] };

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

function renderHistoryCard(item) {
    const safeTitle = item.title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, "\\'");

    // 将源代码名称映射为显示名称（如 wujin → 无尽资源）
    const sourceDisplayName = item.sourceName && window.API_SITES && window.API_SITES[item.sourceName]
        ? window.API_SITES[item.sourceName].name
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

    const hasCover = item.cover && /^https?:\/\//.test(item.cover);
    const coverUrl = hasCover ? item.cover.replace(/"/g, '%22') : '';
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

function deleteHistoryItem(encodedUrl, title, cardEl) {
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

async function playFromHistory(url, title, episodeIndex, playbackPosition = 0) {
    try {
        let episodesList = [];
        let historyItem = null;

        // 获取历史记录（localStorage，快速）
        const historyRaw = localStorage.getItem(scopedKey('viewingHistory'));
        if (historyRaw) {
            const history = JSON.parse(historyRaw);
            historyItem = history.find(item => item.url === url);

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
            localStorage.removeItem('currentVideoInfo');
        }

        // 后台静默同步（异步刷新剧集列表，不阻塞导航）
        if (historyItem && historyItem.vod_id && historyItem.sourceName) {
            syncEpisodesInBackground(historyItem, url);
        } else if (historyItem) {
            localStorage.removeItem('currentVideoInfo');
        }

        // 保存当前页面URL作为返回地址（含 hash，保留历史记录/类别页状态）
        let currentPath;
        if (window.location.pathname.startsWith('/player.html')) {
            currentPath = localStorage.getItem('lastPageUrl') || '/';
        } else {
            currentPath = window.location.origin + window.location.pathname + window.location.search + window.location.hash;
        }
        localStorage.setItem('lastPageUrl', currentPath);

        // 构造播放器URL
        let playerUrl;
        const sourceNameForUrl = historyItem ? historyItem.sourceName : (new URLSearchParams(new URL(url, window.location.origin).search)).get('source');
        const sourceCodeForUrl = historyItem ? historyItem.sourceCode || historyItem.sourceName : (new URLSearchParams(new URL(url, window.location.origin).search)).get('source_code');
        const idForUrl = historyItem ? historyItem.vod_id : '';


        if (url.includes('player.html')) {
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
                    playerUrl = `player.html?id=${encodeURIComponent(vodId)}&title=${encodeURIComponent(title)}&source=${encodeURIComponent(sourceForUrl)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                } else {
                    // 旧格式：有直链视频URL
                    const realVideoUrl = nestedParams.get('url') || url;
                    playerUrl = `player.html?url=${encodeURIComponent(realVideoUrl)}&title=${encodeURIComponent(title)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceNameForUrl) playerUrl += `&source=${encodeURIComponent(sourceNameForUrl)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                    if (idForUrl) playerUrl += `&id=${encodeURIComponent(idForUrl)}`;
                }

            } catch (e) {
                // console.error('解析嵌套URL出错:', e);
                const fallbackId = idForUrl || '';
                if (fallbackId) {
                    // 新格式兜底
                    playerUrl = `player.html?id=${encodeURIComponent(fallbackId)}&title=${encodeURIComponent(title)}&source=${encodeURIComponent(sourceNameForUrl || '')}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                } else {
                    // 旧格式兜底
                    playerUrl = `player.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&index=${episodeIndex}&position=${Math.floor(playbackPosition || 0)}&back=${encodeURIComponent(currentPath)}`;
                    if (sourceNameForUrl) playerUrl += `&source=${encodeURIComponent(sourceNameForUrl)}`;
                    if (sourceCodeForUrl) playerUrl += `&source_code=${encodeURIComponent(sourceCodeForUrl)}`;
                    if (idForUrl) playerUrl += `&id=${encodeURIComponent(idForUrl)}`;
                }
            }
        } else {
             // This case should ideally not happen if 'url' is always a player.html link from history
            const playUrl = new URL(url, window.location.origin);
            if (!playUrl.searchParams.has('index') && episodeIndex > 0) {
                playUrl.searchParams.set('index', episodeIndex);
            }
            playUrl.searchParams.set('position', Math.floor(playbackPosition || 0).toString());
            playUrl.searchParams.set('back', encodeURIComponent(currentPath));
            if (sourceNameForUrl) playUrl.searchParams.set('source', sourceNameForUrl);
            if (sourceCodeForUrl) playUrl.searchParams.set('source_code', sourceCodeForUrl);
            if (idForUrl) playUrl.searchParams.set('id', idForUrl);
            playerUrl = playUrl.toString();
        }

        // 站内同标签页导航标记：播放页返回时据此走 history.back()（见 js/player/player.js goHome）
        try {
            sessionStorage.setItem('leletv_player_from_tab', '1');
        } catch (e) { /* 忽略 */ }
        window.location.href = playerUrl;
    } catch (e) {
        const simpleUrl = `player.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&index=${episodeIndex}`;
        try {
            sessionStorage.setItem('leletv_player_from_tab', '1');
        } catch (err) { /* 忽略 */ }
        window.location.href = simpleUrl;
    }
}

// 后台静默同步剧集列表（不阻塞导航）
async function syncEpisodesInBackground(historyItem, url) {
    try {
        const timestamp = new Date().getTime();
        const apiUrl = `/api/detail?id=${encodeURIComponent(historyItem.vod_id)}&source=${encodeURIComponent(historyItem.sourceName)}&_t=${timestamp}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) return;
        const videoDetails = await response.json();

        if (videoDetails && videoDetails.episodes && videoDetails.episodes.length > 0) {
            // 更新localStorage中的剧集列表（播放页已读取时下次生效）
            localStorage.setItem('currentEpisodes', JSON.stringify(videoDetails.episodes));
            if (videoDetails.videoInfo) {
                localStorage.setItem('currentVideoInfo', JSON.stringify(videoDetails.videoInfo));
            }

            // 更新历史记录中的剧集列表
            const raw = localStorage.getItem(scopedKey('viewingHistory'));
            if (raw) {
                const history = JSON.parse(raw);
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

function addToViewingHistory(videoInfo) {
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
            existingItem.playbackPosition = (episodeChanged || videoInfo.playbackPosition > 10) ? videoInfo.playbackPosition : (existingItem.playbackPosition || 0);
            existingItem.duration = videoInfo.duration || existingItem.duration;
            
            // 更新showIdentifier为最新播放源的标识符
            if (videoInfo.sourceName && videoInfo.vod_id) {
                existingItem.showIdentifier = `${videoInfo.sourceName}_${videoInfo.vod_id}`;
            }

            if (videoInfo.episodes && Array.isArray(videoInfo.episodes) && videoInfo.episodes.length > 0) {
                if (!existingItem.episodes ||
                    !Array.isArray(existingItem.episodes) ||
                    existingItem.episodes.length !== videoInfo.episodes.length ||
                    !videoInfo.episodes.every((ep, i) => ep === existingItem.episodes[i])) {
                    existingItem.episodes = [...videoInfo.episodes];
                }
            }

            // 移到最前面
            history.splice(existingIndex, 1);
            history.unshift(existingItem);
        } else {
            // 没有找到相同标题：添加为新记录
            const newItem = {
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
function confirmClearViewingHistory() {
    const overlay = showModal({
        title: '清空观看记录',
        content: (body) => {
            body.innerHTML = `
                <p class="v2-confirm-text">将删除本机保存的全部观看记录与播放进度。<strong>此操作无法撤销。</strong></p>
                <div class="v2-dialog-foot is-end">
                    <button type="button" class="v2-btn v2-btn--secondary" data-role="cancel">取消</button>
                    <button type="button" class="v2-btn v2-btn--danger" data-role="confirm">清空</button>
                </div>
            `;
            body.querySelector('[data-role="cancel"]').addEventListener('click', () => overlay.remove());
            body.querySelector('[data-role="confirm"]').addEventListener('click', () => {
                overlay.remove();
                clearViewingHistory();
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('clearHistoryBtn')?.addEventListener('click', confirmClearViewingHistory);
    // 记录卡片是 role="button" 的 div，键盘回车 / 空格也要能打开
    document.getElementById('historyList')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (!e.target.classList || !e.target.classList.contains('history-item')) return;
        e.preventDefault();
        e.target.click();
    });
});

function clearViewingHistory() {
    try {
        localStorage.removeItem(scopedKey('viewingHistory'));
        loadViewingHistory(); // 重新加载空的历史记录
        showToast('观看记录已清空', 'success');
    } catch (e) {
        // console.error('清除观看历史失败:', e);
        showToast('清除观看历史失败', 'error');
    }
}
