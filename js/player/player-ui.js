// LeLeTV — UI 控件模块
// 快捷键提示 + 进度条 + 覆盖层 + 资源切换

const leletvPlayerTouchState = {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    lastTapAt: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchMoved: false,
    longPressActive: false,
    suppressNextClick: false,
    isControlsVisible: null,
    hideControls: null
};

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

function showError(message) {
    // 在视频已经播放的情况下不显示错误
    if (art && art.video && art.video.currentTime > 1) {
        return;
    }
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.style.display = 'flex';
    const errorMsgEl = document.getElementById('error-message');
    if (errorMsgEl) errorMsgEl.textContent = message;

    // 有 back 参数时显示返回按钮
    const urlParams = new URLSearchParams(window.location.search);
    const backUrl = urlParams.get('back');
    const backBtn = document.getElementById('error-back-btn');
    if (backBtn) {
        if (backUrl) {
            backBtn.style.display = 'inline-block';
            backBtn.onclick = function (e) {
                // 复用 goHome：哨兵感知的历史返回（bfcache 秒回），无哨兵时回退精确来源地址
                if (typeof goHome === 'function') {
                    goHome(e);
                } else {
                    localStorage.removeItem('lastSearchPage');
                    try { sessionStorage.removeItem('leletv_player_from_tab'); } catch (err) { /* 忽略 */ }
                    window.location.replace(backUrl);
                }
            };
        } else {
            backBtn.style.display = 'none';
        }
    }
}

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

function setupProgressBarPreciseClicks() {
    // 查找ArtPlayer的进度条元素（.art-progress 在 .art-bottom 内部）
    const progressBar = document.querySelector('.art-progress');
    if (!progressBar || !art || !art.video) return;

    // 防止重复绑定：剧集切换时此函数可能被多次调用
    if (progressBar.dataset.leletvProgress === 'bound') return;
    progressBar.dataset.leletvProgress = 'bound';

    let isDragging = false;
    let cachedRect = null; // 拖动期间缓存 progressBar 布局，避免每帧强制回流

    // 统一的跳转处理函数
    function seekByClientX(clientX) {
        if (!art || !art.video) return;
        // 拖动期间使用缓存的 rect，初始点击时实时计算
        const rect = cachedRect || progressBar.getBoundingClientRect();
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
        cachedRect = progressBar.getBoundingClientRect(); // 缓存一次
        e.preventDefault();
        e.stopPropagation();
        seekByClientX(e.clientX);
    }

    function handleMouseMove(e) {
        if (!isDragging) return;
        seekByClientX(e.clientX);
    }

    function handleMouseUp() {
        isDragging = false;
        cachedRect = null;
    }

    progressBar.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // --- 移动端：touchstart 点击 + touchmove 滑动 ---
    function handleTouchStart(e) {
        if (!art || !art.video || !e.touches[0]) return;
        isDragging = true;
        cachedRect = progressBar.getBoundingClientRect(); // 缓存一次
        e.stopPropagation();
        seekByClientX(e.touches[0].clientX);
    }

    function handleTouchMove(e) {
        if (!isDragging || !e.touches[0]) return;
        e.preventDefault();
        seekByClientX(e.touches[0].clientX);
    }

    function handleTouchEnd() {
        isDragging = false;
        cachedRect = null;
    }

    progressBar.addEventListener('touchstart', handleTouchStart, { passive: false });
    progressBar.addEventListener('touchmove', handleTouchMove, { passive: false });
    progressBar.addEventListener('touchend', handleTouchEnd);
    progressBar.addEventListener('touchcancel', handleTouchEnd);
}

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

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function setupLongPressSpeedControl() {
    if (!art || !art.video) return;

    const playerElement = document.getElementById('player');
    let longPressTimer = null;
    let originalPlaybackRate = 1.0;
    let isLongPress = false;

    // 显示倍速提示
    function showSpeedHint(speed) {
        const hintElement = document.getElementById('shortcutHint');
        const textElement = document.getElementById('shortcutText');
        const iconElement = document.getElementById('shortcutIcon');

        // 清除之前的超时
        if (shortcutHintTimeout) {
            clearTimeout(shortcutHintTimeout);
        }

        // 添加倍速专用类，设置为小字透明样式
        hintElement.classList.add('speed-hint');
        iconElement.style.display = 'none';
        textElement.textContent = `${speed}倍速`;
        hintElement.classList.add('show');

        // 长按期间保持显示，松开后恢复1倍速时提示1秒后隐藏
        shortcutHintTimeout = setTimeout(() => {
            hintElement.classList.remove('show');
            // 延迟移除专用类，等待淡出动画完成
            setTimeout(() => {
                hintElement.classList.remove('speed-hint');
                iconElement.style.display = '';
            }, 300);
        }, speed === 2.0 ? 0 : 1000);

        // 2倍速时不自动隐藏，直到松开恢复
        if (speed === 2.0) {
            clearTimeout(shortcutHintTimeout);
        }
    }

    if (leletvPlayerTouchState.isMobile) {
        playerElement.oncontextmenu = () => false;
    }

    function startLongPress(e) {
        if (controlsLocked) return;
        if (e && e.target && e.target.closest && e.target.closest('.art-controls, .art-bottom, .art-progress, .player-back-btn, .player-floating-lock-btn')) return;
        if (art.video.paused) return;
        originalPlaybackRate = art.video.playbackRate;
        leletvPlayerTouchState.longPressActive = false;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            if (art.video.paused || leletvPlayerTouchState.touchMoved) return;
            art.video.playbackRate = 2.0;
            isLongPress = true;
            leletvPlayerTouchState.longPressActive = true;
            leletvPlayerTouchState.suppressNextClick = true;
            showSpeedHint(2.0);
            if (leletvPlayerTouchState.isMobile && leletvPlayerTouchState.isControlsVisible && leletvPlayerTouchState.isControlsVisible()) {
                leletvPlayerTouchState.hideControls && leletvPlayerTouchState.hideControls();
            }
        }, 500);
    }

    function endLongPress(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
            leletvPlayerTouchState.longPressActive = false;
            leletvPlayerTouchState.suppressNextClick = true;
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

    // iOS：拦截 gesture 手势事件（长按放大镜 / 文字选择框）
    if (leletvPlayerTouchState.isMobile && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        playerElement.addEventListener('gesturestart', function (e) { e.preventDefault(); });
        playerElement.addEventListener('gesturechange', function (e) { e.preventDefault(); });
        playerElement.addEventListener('gestureend', function (e) { e.preventDefault(); });
    }

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

function setupControlsBehavior() {
    if (!art) return;

    const container = document.getElementById('playerContainer');
    const playerEl = document.getElementById('player');
    if (!container || !playerEl) return;

    let controlsVisible = true;
    let hideTimer = null;
    let clickTimer = null;
    let lastTapAt = 0;
    let tapStartX = 0;
    let tapStartY = 0;
    let touchMoved = false;
    const DOUBLE_TAP_DELAY = 280;
    const TAP_MOVE_THRESHOLD = 12;

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
        hideTimer = setTimeout(hideControls, TIMING.CONTROLS_HIDE_DELAY);
    }

    leletvPlayerTouchState.isControlsVisible = function () {
        return controlsVisible;
    };
    leletvPlayerTouchState.hideControls = hideControls;

    // 在视频元素上方覆盖透明点击层（仅覆盖视频区域，不遮挡控件）
    const videoWrapper = art.video && art.video.parentElement;
    if (!videoWrapper) return;

    const overlay = document.createElement('div');
    overlay.className = 'player-click-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:5;cursor:pointer';
    videoWrapper.style.position = 'relative';
    videoWrapper.appendChild(overlay);

    overlay.addEventListener('mousedown', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
    });

    overlay.addEventListener('mouseup', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
    });

    overlay.addEventListener('touchstart', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        tapStartX = touch.clientX;
        tapStartY = touch.clientY;
        touchMoved = false;
        leletvPlayerTouchState.touchMoved = false;
        leletvPlayerTouchState.suppressNextClick = false;
    }, { passive: true });

    overlay.addEventListener('touchmove', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        if (Math.hypot(touch.clientX - tapStartX, touch.clientY - tapStartY) > TAP_MOVE_THRESHOLD) {
            touchMoved = true;
            leletvPlayerTouchState.touchMoved = true;
        }
    }, { passive: true });

    overlay.addEventListener('touchend', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            return;
        }
        if (leletvPlayerTouchState.longPressActive || touchMoved) {
            e.preventDefault();
            leletvPlayerTouchState.suppressNextClick = true;
            return;
        }

        e.preventDefault();
        leletvPlayerTouchState.suppressNextClick = true;

        const now = Date.now();
        if (now - lastTapAt <= DOUBLE_TAP_DELAY) {
            lastTapAt = 0;
            if (art.video.paused) art.play();
            else art.pause();
            if (controlsVisible) resetAutoHide();
            return;
        }

        lastTapAt = now;
        toggleControls();
    }, { passive: false });

    overlay.addEventListener('touchcancel', function () {
        touchMoved = false;
        leletvPlayerTouchState.touchMoved = false;
    });

    overlay.addEventListener('dblclick', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        if (leletvPlayerTouchState.isMobile) {
            e.stopPropagation();
            e.preventDefault();
        }
    });

    overlay.addEventListener('click', function (e) {
        if (controlsLocked) {
            e.stopPropagation();
            return;
        }
        if (leletvPlayerTouchState.isMobile) {
            if (leletvPlayerTouchState.suppressNextClick) {
                leletvPlayerTouchState.suppressNextClick = false;
                e.stopPropagation();
                e.preventDefault();
            }
            return;
        }
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

    // RAF 节流：mousemove 高频时不重复触发 DOM 操作
    let controlsRafPending = false;
    playerEl.addEventListener('mousemove', function () {
        if (controlsLocked) return;
        if (controlsRafPending) return;
        controlsRafPending = true;
        requestAnimationFrame(function () {
            controlsRafPending = false;
            if (!controlsVisible) showControls();
            else resetAutoHide();
        });
    });

    playerEl.addEventListener('mouseleave', function () {
        if (controlsLocked) {
            return;
        }
        if (controlsVisible) resetAutoHide();
    });

    setTimeout(hideControls, TIMING.CONTROLS_INITIAL_HIDE_DELAY);
}

function clearVideoProgress() {
    const progressKey = `videoProgress_${getVideoId()}`;
    try {
        localStorage.removeItem(progressKey);
    } catch (e) {
        console.warn('[LeLeTV] 清除视频进度记录失败:', e);
    }
}

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

function addLockFloatingButton(art) {
    if (!art) return;
    const playerEl = document.getElementById('player');
    if (!playerEl) return;
    // 避免重复添加
    if (playerEl.querySelector('.player-floating-lock-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'player-floating-lock-btn';
    btn.title = '锁定控制栏';
    btn.innerHTML = getLockSvg(false);

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        toggleControlsLock(art);
    });

    playerEl.appendChild(btn);
}

function getLockSvg(locked) {
    if (locked) {
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>';
    }
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
}

function toggleControlsLock(art) {
    controlsLocked = !controlsLocked;
    const container = document.getElementById('playerContainer');

    if (controlsLocked) {
        if (art && art.template && art.template.$player) {
            art.template.$player.classList.add('art-lock');
        }
        art.isLock = true;
        if (container) container.classList.add('player-locked');
    } else {
        if (art && art.template && art.template.$player) {
            art.template.$player.classList.remove('art-lock');
        }
        art.isLock = false;
        if (container) container.classList.remove('player-locked');
    }

    // 更新浮动按钮图标
    const btn = document.querySelector('.player-floating-lock-btn');
    if (btn) {
        btn.innerHTML = getLockSvg(controlsLocked);
        btn.title = controlsLocked ? '点击解锁' : '锁定控制栏';
    }
}

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

// ==================== 线路切换（折叠面板） ====================
// 折叠时不发任何请求；首次展开才对「当前数据域的全部来源」并行搜索 + 测速，
// 每个来源显示「资源名 + 备注」和延迟徽章，当前正在播放的线路高亮
const RESOURCE_SCAN_CONCURRENCY = 6;

// 单源扫描状态：untested 未测 / testing 测速中 / done 已测 / failed 测速失败 / empty 无结果
const resourceScan = {
    started: false,
    finished: false,
    sources: [],
    results: {},
    latency: {},
    status: {},
    hitCount: 0
};

let resourceGridFrame = null;

// 当前数据域下可扫描的来源：本模式的全部内置源（含未勾选的）+ 本模式的自定义源
function getResourceScanSources() {
    const customAPIs = JSON.parse(localStorage.getItem(scopedKey('customAPIs')) || '[]');
    const hidden = isHiddenContentMode();
    const list = Object.keys(API_SITES)
        .filter(key => hidden ? !!API_SITES[key].hidden : !API_SITES[key].hidden)
        .map(key => ({ key: key, name: (API_SITES[key] && API_SITES[key].name) || key }));
    customAPIs.forEach((api, index) => {
        if (api && api.url) list.push({ key: 'custom_' + index, name: api.name || '自定义资源' });
    });
    return list;
}

function updateResourceSourceCount() {
    const el = document.getElementById('resourceSourceCount');
    if (!el) return;
    if (!resourceScan.started) {
        el.textContent = '· 当前集共 ' + getResourceScanSources().length + ' 个来源';
        return;
    }
    if (!resourceScan.finished) {
        el.textContent = '· 已找到 ' + resourceScan.hitCount + ' 个来源，扫描中…';
        return;
    }
    el.textContent = '· 当前集共 ' + resourceScan.hitCount + ' 个来源';
}

function toggleResourceList() {
    const section = document.getElementById('resourceSection');
    if (!section) return;
    const collapsed = section.classList.toggle('collapsed');
    if (collapsed) return;
    startResourceScan();
}

function startResourceScan() {
    if (resourceScan.started) return;
    resourceScan.started = true;

    if (!currentVideoTitle) {
        const grid = document.getElementById('resourceSourceGrid');
        if (grid) grid.innerHTML = '<div class="resource-source-hint">未获取到片名，无法扫描线路</div>';
        resourceScan.finished = true;
        return;
    }

    resourceScan.sources = getResourceScanSources();
    // 扫描过程中保持配置顺序（当前线路置顶），不中途重排，避免条目跳动；
    // 全部测速结束后再统一按延迟从快到慢排序
    const currentSourceCode = new URLSearchParams(window.location.search).get('source') || '';
    const currentIdx = resourceScan.sources.findIndex(src => String(src.key) === String(currentSourceCode));
    if (currentIdx > 0) resourceScan.sources.unshift(resourceScan.sources.splice(currentIdx, 1)[0]);
    resourceScan.sources.forEach(src => { resourceScan.status[src.key] = 'untested'; });
    renderResourceSourceGrid();
    updateResourceSourceCount();

    // 并发池：固定数量的 worker 从队列里取源，避免一次打满几十个请求
    const queue = resourceScan.sources.slice();
    const workers = [];
    const workerCount = Math.min(RESOURCE_SCAN_CONCURRENCY, queue.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push((async () => {
            let src;
            while ((src = queue.shift())) {
                await scanOneResourceSource(src);
            }
        })());
    }
    Promise.all(workers).then(() => {
        resourceScan.finished = true;
        sortResourceSourcesByLatency();
        renderResourceSourceGrid();
        updateResourceSourceCount();
    });
}

// 全部测速结束后按延迟重排：当前播放的线路固定第一（它不一定是延迟最低的），
// 其余有结果的按毫秒升序（最快在前），测速失败、无结果的沉到最后
function sortResourceSourcesByLatency() {
    const currentSourceCode = new URLSearchParams(window.location.search).get('source') || '';
    const rank = (src) => {
        if (String(src.key) === String(currentSourceCode)) return -1;
        const status = resourceScan.status[src.key];
        if (status === 'done') return 0;
        if (status === 'failed') return 1;
        return 2; // untested / testing / empty
    };
    // sort 是稳定排序：同一延迟档内保持原来的配置顺序
    resourceScan.sources.sort((a, b) => {
        const rankA = rank(a);
        const rankB = rank(b);
        if (rankA !== rankB) return rankA - rankB;
        const speedA = (resourceScan.latency[a.key] || {}).speed;
        const speedB = (resourceScan.latency[b.key] || {}).speed;
        const valueA = typeof speedA === 'number' && speedA >= 0 ? speedA : Number.MAX_SAFE_INTEGER;
        const valueB = typeof speedB === 'number' && speedB >= 0 ? speedB : Number.MAX_SAFE_INTEGER;
        return valueA - valueB;
    });
}

async function scanOneResourceSource(src) {
    try {
        const results = await searchByAPIAndKeyWord(src.key, currentVideoTitle);
        if (Array.isArray(results) && results.length > 0) {
            // 优先取片名完全一致的结果，否则退回第一条
            let hit = results[0];
            results.forEach(res => { if (res.vod_name === currentVideoTitle) hit = res; });

            resourceScan.results[src.key] = hit;
            resourceScan.hitCount++;
            resourceScan.status[src.key] = 'testing';
            scheduleResourceGridRender();
            updateResourceSourceCount();

            const speed = await testVideoSourceSpeed(src.key, hit.vod_id);
            resourceScan.latency[src.key] = speed;
            resourceScan.status[src.key] = (speed && speed.speed === -1) ? 'failed' : 'done';
        } else {
            resourceScan.status[src.key] = 'empty';
        }
    } catch (e) {
        // 单个源失败不影响其它源
        console.warn('[LeLeTV] 线路扫描失败:', src.key, e);
        resourceScan.status[src.key] = 'empty';
    }
    scheduleResourceGridRender();
}

// 扫描是渐进式的，用 rAF 合并重绘，避免几十个源完成时反复重建整个列表
function scheduleResourceGridRender() {
    if (resourceGridFrame) return;
    resourceGridFrame = requestAnimationFrame(() => {
        resourceGridFrame = null;
        renderResourceSourceGrid();
    });
}

function renderResourceLatency(sourceKey) {
    const status = resourceScan.status[sourceKey];
    if (status === 'empty') return '<span class="resource-source-latency">无结果</span>';
    if (status === 'testing') return '<span class="resource-source-latency">测速中</span>';
    if (status === 'done' || status === 'failed') {
        const spd = resourceScan.latency[sourceKey] || {};
        if (spd.speed === -1) {
            return '<span class="resource-source-latency poor">' + escHtml(spd.error || '失败') + '</span>';
        }
        const speed = spd.speed;
        let level = 'good';
        if (speed >= SOURCE_LATENCY_SLOW_MS) level = 'poor';
        else if (speed >= SOURCE_LATENCY_FAST_MS) level = 'medium';
        return '<span class="resource-source-latency ' + level + '">' + speed + 'ms</span>';
    }
    return '<span class="resource-source-latency">未测</span>';
}

function renderResourceSourceGrid() {
    const grid = document.getElementById('resourceSourceGrid');
    if (!grid || !resourceScan.started) return;
    const currentSourceCode = new URLSearchParams(window.location.search).get('source') || '';

    let html = '';
    resourceScan.sources.forEach(src => {
        const result = resourceScan.results[src.key];
        const isCurrent = String(src.key) === String(currentSourceCode);
        const classes = ['resource-source-item'];
        if (!result) classes.push('is-empty');
        if (isCurrent) classes.push('is-current');

        // 没有结果的和当前正在播的线路都不可点
        let attrs = '';
        if (result && !isCurrent) {
            attrs = ' data-action="switch-to-resource" data-key="' + escHtml(src.key)
                + '" data-vod-id="' + escHtml(result.vod_id) + '" title="切换到该线路"';
        } else {
            attrs = isCurrent ? ' title="当前播放线路"' : '';
        }

        const remark = (result && result.vod_remarks)
            ? '<span class="resource-source-remark">' + escHtml(result.vod_remarks) + '</span>'
            : '';

        html += '<div class="' + classes.join(' ') + '"' + attrs + '>'
            + '<div class="resource-source-name"><span class="resource-source-title">' + escHtml(src.name) + '</span>' + remark + '</div>'
            + renderResourceLatency(src.key)
            + '</div>';
    });
    grid.innerHTML = html;
}

async function switchToResource(sourceKey, vodId) {
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
        
        // 保留当前页面的 back 参数，确保切换资源后返回仍能回到来源页（而非上一个源）
        const currentUrlParams2 = new URLSearchParams(window.location.search);
        const currentBack = currentUrlParams2.get('back');
        const backSuffix = currentBack ? `&back=${encodeURIComponent(currentBack)}` : '';

        // 构建播放页面URL，包含当前播放进度
        const watchUrl = `player.html?id=${vodId}&source=${sourceKey}&url=${encodeURIComponent(targetUrl)}&index=${targetIndex}&title=${encodeURIComponent(currentVideoTitle)}&position=${currentPosition}${backSuffix}`;
        
        // 保存当前状态到localStorage
        try {
            localStorage.setItem('currentVideoTitle', data.vod_name || '未知视频');
            localStorage.setItem('currentEpisodes', JSON.stringify(data.episodes));
            localStorage.setItem('currentEpisodeIndex', targetIndex);
            localStorage.setItem('currentSourceCode', sourceKey);
            localStorage.setItem('lastPlayTime', Date.now());
            
            // 保存视频详细信息，包括封面
            if (data.videoInfo) {
                StorageService.setCurrentVideoInfo(data.videoInfo);
            }
        } catch (e) {
            console.error('保存播放状态失败:', e);
        }

        // 更新历史记录中的源信息而不是创建新记录
        try {
            const history = StorageService.getViewingHistory();
            if (history.length > 0) {
                
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
                    
                    StorageService.setViewingHistory(history);
                }
            }
        } catch (e) {
            console.error('更新历史记录源信息时出错:', e);
        }

        // 跳转到播放页面（用 replace 不新增历史条目，保证返回按钮能直接回到来源页，配合 bfcache 秒回）
        window.location.replace(watchUrl);
        
    } catch (error) {
        console.error('切换资源失败:', error);
        showToast('切换资源失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}