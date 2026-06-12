// LeLeTV — 选集管理模块

function updateEpisodeInfo() {
    const el = document.getElementById('episodeInfo');
    if (!el) return;
    if (currentEpisodes.length > 0) {
        el.textContent = `第 ${currentEpisodeIndex + 1}/${currentEpisodes.length} 集`;
    } else {
        el.textContent = '无集数信息';
    }
}

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
                    class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[rgba(34,34,34,0.5)] hover:!bg-[rgba(255,255,255,0.1)] hover:!shadow-none'} !border ${isActive ? '!border-transparent' : '!border-[var(--color-border-default)]'} rounded-lg transition-all text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    });

    episodesList.innerHTML = html;
}

function playEpisode(index) {
    // 切换状态锁：防止快速点击集数造成并发切换
    if (window.isSwitchingVideo) {
        return;
    }
    window.isSwitchingVideo = true;

    // 确保index在有效范围内
    if (index < 0 || index >= currentEpisodes.length) {
        window.isSwitchingVideo = false;
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
    videoHasEnded = false;

    clearVideoProgress();

    // 更新URL参数（不刷新页面）
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('index', index);
    currentUrl.searchParams.set('url', url);
    currentUrl.searchParams.delete('position');
    window.history.replaceState({}, '', currentUrl.toString());

    // 更新UI
    updateEpisodeInfo();
    updateButtonStates();
    renderEpisodes();
    updateMediaSession();
    userClickedPosition = null;

    // 尝试无缝切换，如果失败则回退到销毁重建播放器
    if (art) {
        // 清除之前的超时
        if (episodeSwitchTimeout) {
            clearTimeout(episodeSwitchTimeout);
        }

        // 设置切换超时：12秒后如果视频仍未开始播放，说明切换可能失败
        episodeSwitchTimeout = setTimeout(function () {
            episodeSwitchTimeout = null;
            window.isSwitchingVideo = false;

            // 检查加载状态是否仍未消失
            const loadingEl = document.getElementById('player-loading');
            if (loadingEl && loadingEl.style.display !== 'none' && loadingEl.style.display !== '') {
                // 兜底：销毁现有播放器，重新初始化
                if (art) {
                    PlayerManager.destroy();
                }
                initPlayer(url);
            }
        }, 12000);

        art.url = url;
    } else {
        // art 为空，直接初始化播放器
        initPlayer(url);
        window.isSwitchingVideo = false;
    }

    // 三秒后保存到历史记录
    setTimeout(function () { saveToHistory(); }, 3000);
}

function playPreviousEpisode() {
    if (currentEpisodeIndex > 0) {
        playEpisode(currentEpisodeIndex - 1);
    }
}

function playNextEpisode() {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
    }
}

function toggleEpisodeOrder() {
    episodesReversed = !episodesReversed;

    // 保存到localStorage
    localStorage.setItem('episodesReversed', episodesReversed);

    // 重新渲染集数列表
    renderEpisodes();

    // 更新排序按钮
    updateOrderButton();
}

function updateOrderButton() {
    const orderIcon = document.getElementById('orderIcon');

    if (orderIcon) {
        orderIcon.style.transform = episodesReversed ? 'rotate(180deg)' : '';
    }
}