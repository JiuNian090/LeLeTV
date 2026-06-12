// 构建API参数并获取视频详情（提取自 playDirectly 和 showDetails 的重复逻辑）
async function buildApiParamsAndFetch(id, sourceCode) {
    let apiParams = '';
    if (sourceCode.startsWith('custom_')) {
        const customIndex = sourceCode.replace('custom_', '');
        const customApi = getCustomApiInfo(customIndex);
        if (!customApi) {
            return { error: '自定义API配置无效' };
        }
        if (customApi.detail) {
            apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
        } else {
            apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
        }
    } else {
        apiParams = '&source=' + sourceCode;
    }

    const timestamp = new Date().getTime();
    const cacheBuster = `&_t=${timestamp}`;
    try {
        const response = await fetch(`/api/detail?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`);
        const data = await response.json();
        return { data };
    } catch (error) {
        return { error: '网络请求失败，请稍后重试' };
    }
}

// 点击搜索结果直接跳转播放器（立即跳转，不等待API响应）
async function playDirectly(id, vod_name, sourceCode) {
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }
    if (!id) {
        showToast('视频ID无效', 'error');
        return;
    }

    // 保存基础信息到localStorage供播放页使用
    try {
        // 清除旧源缓存的剧集列表，防止污染新源
        localStorage.removeItem('currentEpisodes');
        localStorage.removeItem('currentEpisodeIndex');
        localStorage.removeItem('currentVideoInfo');
        localStorage.setItem('currentVideoTitle', vod_name || '未知视频');
        localStorage.setItem('currentSourceCode', sourceCode || '');
        localStorage.setItem('lastPlayTime', Date.now());
        localStorage.setItem('lastSearchPage', window.location.href);
    } catch (e) {
        console.error('保存播放状态失败:', e);
    }

    // 立即跳转播放页，不等待API响应
    // player.js 会从URL参数中获取 id + source，异步加载剧集信息
    let playerUrl = `player.html?id=${encodeURIComponent(id)}&title=${encodeURIComponent(vod_name || '未知视频')}&source=${encodeURIComponent(sourceCode)}`;
    const currentPath = window.location.href;
    // 从首页/搜索页进入时标记 back 为首页，返回时不会带上搜索状态
    if (currentPath.includes('index.html') || currentPath.endsWith('/') || currentPath.includes('/?') || currentPath.includes('/s=')) {
        playerUrl += `&back=${encodeURIComponent(window.location.origin + '/index.html')}`;
    }
    window.location.href = playerUrl;
}

// 显示详情 - 修改为支持自定义API
async function showDetails(id, vod_name, sourceCode) {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }
    if (!id) {
        showToast('视频ID无效', 'error');
        return;
    }

    showLoading();
    try {
        const result = await buildApiParamsAndFetch(id, sourceCode);
        if (result.error) {
            showToast(result.error, 'error');
            hideLoading();
            return;
        }
        const data = result.data;

        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        // 显示来源信息
        const sourceName = data.videoInfo && data.videoInfo.source_name ?
            ` <span class="text-sm font-normal text-gray-400">(${data.videoInfo.source_name})</span>` : '';

        // 不对标题进行截断处理，允许完整显示
        modalTitle.innerHTML = `<span class="break-words">${vod_name || '未知视频'}</span>${sourceName}`;
        currentVideoTitle = vod_name || '未知视频';

        if (data.episodes && data.episodes.length > 0) {
            // 构建详情信息HTML
            let detailInfoHtml = '';
            if (data.videoInfo) {
                // Prepare description text, strip HTML and trim whitespace
                const descriptionText = data.videoInfo.desc ? data.videoInfo.desc.replace(/<[^>]+>/g, '').trim() : '';

                // Check if there's any actual grid content
                const hasGridContent = data.videoInfo.type || data.videoInfo.year || data.videoInfo.area || data.videoInfo.director || data.videoInfo.actor || data.videoInfo.remarks;

                if (hasGridContent || descriptionText) { // Only build if there's something to show
                    detailInfoHtml = `
                <div class="modal-detail-info">
                    ${hasGridContent ? `
                    <div class="detail-grid">
                        ${data.videoInfo.type ? `<div class="detail-item"><span class="detail-label">类型:</span> <span class="detail-value">${data.videoInfo.type}</span></div>` : ''}
                        ${data.videoInfo.year ? `<div class="detail-item"><span class="detail-label">年份:</span> <span class="detail-value">${data.videoInfo.year}</span></div>` : ''}
                        ${data.videoInfo.area ? `<div class="detail-item"><span class="detail-label">地区:</span> <span class="detail-value">${data.videoInfo.area}</span></div>` : ''}
                        ${data.videoInfo.director ? `<div class="detail-item"><span class="detail-label">导演:</span> <span class="detail-value">${data.videoInfo.director}</span></div>` : ''}
                        ${data.videoInfo.actor ? `<div class="detail-item"><span class="detail-label">主演:</span> <span class="detail-value">${data.videoInfo.actor}</span></div>` : ''}
                        ${data.videoInfo.remarks ? `<div class="detail-item"><span class="detail-label">备注:</span> <span class="detail-value">${data.videoInfo.remarks}</span></div>` : ''}
                    </div>` : ''}
                    ${descriptionText ? `
                    <div class="detail-desc">
                        <p class="detail-label">简介:</p>
                        <p class="detail-desc-content">${descriptionText}</p>
                    </div>` : ''}
                </div>
                `;
                }
            }

            currentEpisodes = data.episodes;
            currentEpisodeIndex = 0;
            
            // 保存视频详细信息到localStorage
            try {
                localStorage.setItem('currentVideoTitle', vod_name || '未知视频');
                if (data.videoInfo) {
                    localStorage.setItem('currentVideoInfo', JSON.stringify(data.videoInfo));
                }
            } catch (e) {
                console.error('保存视频详细信息失败:', e);
            }

            modalContent.innerHTML = `
                ${detailInfoHtml}
                <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
                    <div class="flex items-center gap-2">
                        <button data-action="toggle-episode-order" data-source="${sourceCode}" data-vod-id="${id}" 
                                class="px-3 py-1.5 bg-[#333] hover:bg-[#444] border border-[#444] rounded text-sm transition-colors flex items-center gap-1">
                            <svg class="w-4 h-4 transform ${episodesReversed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                            </svg>
                            <span>${episodesReversed ? '正序排列' : '倒序排列'}</span>
                        </button>
                        <span class="text-gray-400 text-sm">共 ${data.episodes.length} 集</span>
                    </div>
                    <button data-action="copy-links" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                        复制链接
                    </button>
                </div>
                <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    ${renderEpisodes(vod_name, sourceCode, id)}
                </div>
            `;
        } else {
            modalContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 mb-2">❌ 未找到播放资源</div>
                    <div class="text-gray-500 text-sm">该视频可能暂时无法播放，请尝试其他视频</div>
                </div>
            `;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (error) {
        console.error('获取详情错误:', error);
        showToast('获取详情失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

function playVideo(url, vod_name, sourceCode, episodeIndex = 0, vodId = '') {
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }

    let currentPath = window.location.href;

    let playerUrl = `player.html?id=${vodId || ''}&source=${sourceCode || ''}&url=${encodeURIComponent(url)}&index=${episodeIndex}&title=${encodeURIComponent(vod_name || '')}`;

    if (currentPath.includes('index.html') || currentPath.endsWith('/') || currentPath.includes('/?') || currentPath.includes('/s=')) {
        playerUrl += `&back=${encodeURIComponent(window.location.origin + '/index.html')}`;
    }

    try {
        localStorage.setItem('currentVideoTitle', vod_name || '未知视频');
        localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes));
        localStorage.setItem('currentEpisodeIndex', episodeIndex);
        localStorage.setItem('currentSourceCode', sourceCode || '');
        localStorage.setItem('lastPlayTime', Date.now());
        localStorage.setItem('lastSearchPage', currentPath);
        localStorage.setItem('lastPageUrl', currentPath);
    } catch (e) {
        console.error('保存播放状态失败:', e);
    }

    window.location.href = playerUrl;
}

// 播放上一集
function playPreviousEpisode(sourceCode) {
    if (currentEpisodeIndex > 0) {
        const prevIndex = currentEpisodeIndex - 1;
        const prevUrl = currentEpisodes[prevIndex];
        playVideo(prevUrl, currentVideoTitle, sourceCode, prevIndex);
    }
}

// 播放下一集
function playNextEpisode(sourceCode) {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        const nextIndex = currentEpisodeIndex + 1;
        const nextUrl = currentEpisodes[nextIndex];
        playVideo(nextUrl, currentVideoTitle, sourceCode, nextIndex);
    }
}


// 辅助函数用于渲染剧集按钮（使用当前的排序状态）
function renderEpisodes(vodName, sourceCode, vodId) {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    return episodes.map((episode, index) => {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        return `
            <button id="episode-${realIndex}" data-action="play-video" data-url="${episode}" data-name="${vodName.replace(/"/g, '&quot;')}" data-source="${sourceCode}" data-index="${realIndex}" data-vod-id="${vodId}" 
                    class="px-4 py-2 bg-[rgba(34,34,34,0.5)] hover:bg-[rgba(255,255,255,0.1)] border border-[var(--color-border-default)] rounded-lg transition-all text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    }).join('');
}

// 复制视频链接到剪贴板
function copyLinks() {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    const linkList = episodes.join('\r\n');
    navigator.clipboard.writeText(linkList).then(() => {
        showToast('播放链接已复制', 'success');
    }).catch(err => {
        showToast('复制失败，请检查浏览器权限', 'error');
    });
}

// 切换排序状态的函数
function toggleEpisodeOrder(sourceCode, vodId) {
    episodesReversed = !episodesReversed;
    // 重新渲染剧集区域，使用 currentVideoTitle 作为视频标题
    const episodesGrid = document.getElementById('episodesGrid');
    if (episodesGrid) {
        episodesGrid.innerHTML = renderEpisodes(currentVideoTitle, sourceCode, vodId);
    }

    // 更新按钮文本和箭头方向
    const toggleBtn = document.querySelector(`button[data-action="toggle-episode-order" data-source="${sourceCode}" data-vod-id="${vodId}"]`);
    if (toggleBtn) {
        toggleBtn.querySelector('span').textContent = episodesReversed ? '正序排列' : '倒序排列';
        const arrowIcon = toggleBtn.querySelector('svg');
        if (arrowIcon) {
            arrowIcon.style.transform = episodesReversed ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
}