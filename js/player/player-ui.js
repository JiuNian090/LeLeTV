// LeLeTV — UI 控件模块
// 快捷键提示 + 进度条 + 覆盖层 + 资源切换

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
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl) loadingEl.style.display = 'none';
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
            backBtn.onclick = function () {
                localStorage.removeItem('lastSearchPage');
                window.location.href = backUrl;
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
        showShortcutHint(`${speed}倍速`, 'right');
    }

    // 移动端禁用右键菜单（防止长按弹出原生菜单）
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        playerElement.oncontextmenu = () => false;
    }

    // 核心：开始长按倒计时
    function startLongPress() {
        if (controlsLocked) return;
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

function setupThumbnailCapture() {
    if (!art || !art.video) return;

    const THUMBNAIL_WIDTH = 160;
    const TOTAL_THUMBNAILS = 100;
    const COLUMNS = 10;

    let canvas = null;
    let ctx = null;
    let frameH = 90;
    let thumbnailUrl = null;
    let captured = 0;
    let captureInProgress = false;
    let aborted = false;

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
        try {
            canvas.toBlob(function (blob) {
                if (!blob) return;
                if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
                thumbnailUrl = URL.createObjectURL(blob);
                art.thumbnails = {
                    url: thumbnailUrl,
                    number: captured,
                    column: COLUMNS,
                    width: THUMBNAIL_WIDTH,
                    height: frameH,
                };
            }, 'image/jpeg', 0.8);
        } catch (e) {}
    }

    // 在视频有 duration 之后才开始采样
    function onLoadedMeta() {
        if (captureInProgress) return;
        const duration = art.video.duration;
        if (!duration || !isFinite(duration) || duration < 30) return;
        if (!ensureCanvas() || !ctx) return;

        captureInProgress = true;
        const originalTime = art.video.currentTime;
        const wasPaused = art.video.paused;

        // 计算 100 个均匀采样点，跳过开头 3 秒（避免黑屏），保留结尾 10 秒（避免片尾）
        const startOffset = 3;
        const endOffset = Math.min(duration - 10, duration - 1);
        const step = (endOffset - startOffset) / TOTAL_THUMBNAILS;
        const timePoints = [];
        for (let i = 0; i < TOTAL_THUMBNAILS; i++) {
            timePoints.push(startOffset + i * step + step / 2);
        }

        captured = 0;
        let idx = 0;

        function captureOneFrame() {
            if (aborted) {
                captureInProgress = false;
                return;
            }
            if (idx >= timePoints.length) {
                // 抓完了，恢复原播放位置
                if (captured > 0) flushSprite();
                try {
                    art.video.removeEventListener('seeked', captureOneFrame);
                    art.video.currentTime = Math.min(originalTime, duration - 1);
                    if (!wasPaused) art.video.play().catch(function () {});
                } catch (e) {}
                captureInProgress = false;
                return;
            }

            const targetTime = timePoints[idx];
            try {
                art.video.currentTime = targetTime;
            } catch (e) {
                // seek 失败，尝试下一个
                idx++;
                captureOneFrame();
                return;
            }

            // seeked 事件保证目标时间点的帧已解码
            function onSeeked() {
                art.video.removeEventListener('seeked', onSeeked);
                if (aborted) {
                    captureInProgress = false;
                    return;
                }

                const col = captured % COLUMNS;
                const row = Math.floor(captured / COLUMNS);
                try {
                    ctx.drawImage(art.video, col * THUMBNAIL_WIDTH, row * frameH, THUMBNAIL_WIDTH, frameH);
                    captured++;
                    // 每抓满一行刷新一次雪碧图
                    if (captured % COLUMNS === 0) {
                        flushSprite();
                    }
                } catch (e) {
                    // CORS 或 canvas 污染，终止
                    aborted = true;
                    captureInProgress = false;
                    return;
                }

                idx++;
                // 延迟 200ms 再抓下一帧，给解码器喘气时间，避免卡顿
                setTimeout(captureOneFrame, 200);
            }

            art.video.addEventListener('seeked', onSeeked, { once: true });

            // 超时保护：500ms 内没有 seeked 就跳过这帧
            setTimeout(function () {
                art.video.removeEventListener('seeked', onSeeked);
                if (!aborted && idx < timePoints.length) {
                    idx++;
                    captureOneFrame();
                }
            }, 500);
        }

        // 先暂停再开始采样
        try {
            art.video.pause();
        } catch (e) {}
        captureOneFrame();
    }

    // 避免重复绑定
    if (!art.video._thumbCaptureBound) {
        art.video._thumbCaptureBound = true;
        art.video.addEventListener('loadedmetadata', onLoadedMeta);
        // 如果此时已经加载完了，直接启动
        if (art.video.duration && art.video.duration > 0) {
            setTimeout(onLoadedMeta, 1500);
        }
    }
}

function setupControlsBehavior() {
    if (!art) return;

    const playerEl = document.getElementById('player');
    if (!playerEl) return;

    // 显示返回按钮（复用 fullScreenController 的 showBackBtn）
    function showBackBtnNow() {
        const btn = document.querySelector('.player-back-btn');
        if (btn) btn.classList.add('show');
    }

    let hideTimer = null;
    let btnHideTimer = null;

    function resetAutoHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
            if (!art.isLock) art.controls.show = false;
        }, TIMING.CONTROLS_HIDE_DELAY);
    }

    function resetBtnHide() {
        if (btnHideTimer) clearTimeout(btnHideTimer);
        btnHideTimer = setTimeout(function () {
            const btn = document.querySelector('.player-back-btn');
            if (btn && !art.fullscreen) btn.classList.remove('show');
        }, TIMING.CONTROLS_HIDE_DELAY);
    }

    // 鼠标移动显示控制栏 & 返回按钮
    playerEl.addEventListener('mousemove', function () {
        if (art.isLock) return;
        art.controls.show = true;
        showBackBtnNow();
        resetAutoHide();
        resetBtnHide();
    });

    playerEl.addEventListener('mouseleave', function () {
        if (art.isLock) return;
        resetAutoHide();
        resetBtnHide();
    });

    // 触摸设备：触摸屏幕也显示控制栏和返回按钮
    playerEl.addEventListener('touchstart', function () {
        if (art.isLock) return;
        art.controls.show = true;
        showBackBtnNow();
        resetAutoHide();
        resetBtnHide();
    }, { passive: true });

    // 视频点击时短暂显示控制栏 & 返回按钮
    art.on('video:click', function () {
        if (art.isLock) return;
        art.controls.show = true;
        showBackBtnNow();
        resetAutoHide();
        resetBtnHide();
    });

    // 键盘快捷键：Alt+← 上一集 / Alt+→ 下一集 / L 键锁定 / Esc 返回
    document.addEventListener('keydown', function (e) {
        if (!art) return;
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            if (typeof playPreviousEpisode === 'function') playPreviousEpisode();
        } else if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            if (typeof playNextEpisode === 'function') playNextEpisode();
        } else if (e.key && e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // 仅在焦点在视频相关区域或全屏时生效，避免干扰页面输入
            const active = document.activeElement;
            const isInputActive = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            if (isInputActive) return;
            e.preventDefault();
            art.isLock = !art.isLock;
            // 同步锁定按钮图标
            const lockBtn = document.querySelector('.art-control-lock-controls');
            if (lockBtn) {
                const svg = lockBtn.querySelector('svg');
                if (svg) {
                    svg.outerHTML = art.isLock ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN;
                }
                lockBtn.setAttribute('title', art.isLock ? '点击解锁' : '锁定控制栏');
            }
        } else if (e.key === 'Escape') {
            // Esc 键：先尝试退出全屏，再返回上一页
            if (art.fullscreen) {
                try { art.fullscreen = false; } catch (err) {}
                return;
            }
            if (document.fullscreenElement) {
                try { document.exitFullscreen(); } catch (err) {}
                return;
            }
            // 普通页面 Esc → 返回上一页
            if (typeof goHome === 'function') {
                goHome(e);
            }
        }
    });

    // 初始自动隐藏
    setTimeout(function () {
        if (!art.isLock) art.controls.show = false;
    }, TIMING.CONTROLS_INITIAL_HIDE_DELAY);
}

function clearVideoProgress() {
    const progressKey = `videoProgress_${getVideoId()}`;
    try {
        localStorage.removeItem(progressKey);
    } catch (e) {
    }
}

function getVideoCover() {
    try {
        const info = StorageService.getCurrentVideoInfo();
        if (info) {
            if (info.cover && info.cover.startsWith('http')) return info.cover;
        }
    } catch (e) {}
    return '/image/logo-black.png';
}

/* ===== ArtPlayer 原生 API 注册自定义控件 ===== */

const SVG_PREV_EPISODE =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
    '<path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>';

const SVG_NEXT_EPISODE =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
    '<path d="M16 6v12h2V6h-2zM6 18l8.5-6L6 6v12z"/></svg>';

const SVG_LOCK_OPEN =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

const SVG_LOCK_CLOSED =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
    '<circle cx="12" cy="16" r="1"/></svg>';

const SVG_CAST =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
    '<path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 12H2v3h12v-3zm0-5H2v3h12v-3z"/></svg>';

function isCastAvailable() {
    return !!(window.chrome && window.chrome.cast) ||
           !!navigator.presentation ||
           !!window.PresentationRequest ||
           (typeof HTMLVideoElement !== 'undefined' &&
            'webkitShowPlaybackTargetPicker' in HTMLVideoElement.prototype);
}

function setupCustomControls(art) {
    if (!art || !art.controls) return;

    art.controls.add({
        name: 'prev-episode',
        position: 'left',
        index: 5,
        html: SVG_PREV_EPISODE,
        tooltip: '上一集 (Alt+←)',
        click: function () {
            if (typeof playPreviousEpisode === 'function') playPreviousEpisode();
        }
    });

    art.controls.add({
        name: 'next-episode',
        position: 'left',
        index: 15,
        html: SVG_NEXT_EPISODE,
        tooltip: '下一集 (Alt+→)',
        click: function () {
            if (typeof playNextEpisode === 'function') playNextEpisode();
        }
    });

    art.controls.add({
        name: 'lock-controls',
        position: 'right',
        index: 75,
        html: SVG_LOCK_OPEN,
        tooltip: '锁定控制栏',
        click: function () {
            art.isLock = !art.isLock;
            var locked = art.controls.get ? art.controls.get('lock-controls') : document.querySelector('.art-control-lock-controls');
            if (locked && locked.innerHTML) {
                locked.innerHTML = art.isLock ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN;
            }
            if (locked && locked.setAttribute) {
                locked.setAttribute('data-tooltip', art.isLock ? '点击解锁' : '锁定控制栏');
            }
        }
    });

    if (isCastAvailable()) {
        art.controls.add({
            name: 'cast',
            position: 'right',
            index: 85,
            html: SVG_CAST,
            tooltip: '投屏到电视',
            click: function () {
                const video = art && art.video;
                if (!video) return;
                if (video.webkitShowPlaybackTargetPicker &&
                    typeof video.webkitShowPlaybackTargetPicker === 'function') {
                    try {
                        video.webkitShowPlaybackTargetPicker();
                    } catch (e) {
                        if (art && art.notice) art.notice.show = '当前浏览器不支持投屏';
                    }
                } else if (window.PresentationRequest) {
                    try {
                        const request = new PresentationRequest([window.location.href]);
                        request.start().then(function () {
                            if (art && art.notice) art.notice.show = '已开始投屏';
                        }).catch(function () {
                            if (art && art.notice) art.notice.show = '未选择投屏设备';
                        });
                    } catch (e) {
                        if (art && art.notice) art.notice.show = '投屏启动失败';
                    }
                } else if (window.chrome && window.chrome.cast) {
                    if (art && art.notice) art.notice.show = '请先安装 Google Cast 扩展';
                } else {
                    if (art && art.notice) art.notice.show = '当前浏览器不支持投屏';
                }
            }
        });
    }

    // ===== 跳过片头层：在 0 ~ skipIntroTime 范围内显示一个按钮，点击直接跳到片尾时间点 =====
    var skipIntroLayerEl = null;
    try {
        art.layers.add({
            name: 'skip-intro',
            html: '跳过片头 ▶',
            style: {
                position: 'absolute',
                right: '24px',
                bottom: '100px',
                padding: '8px 16px',
                background: 'rgba(236, 72, 153, 0.9)',
                color: '#fff',
                'font-size': '13px',
                'border-radius': '20px',
                cursor: 'pointer',
                opacity: '0',
                transition: 'opacity 0.3s ease',
                'pointer-events': 'none',
                'z-index': '12',
                'user-select': 'none',
                'box-shadow': '0 2px 8px rgba(0,0,0,0.3)'
            },
            click: function () {
                if (typeof skipIntroTime !== 'undefined') {
                    art.seek = skipIntroTime;
                }
                if (skipIntroLayerEl) {
                    skipIntroLayerEl.style.opacity = '0';
                    skipIntroLayerEl.style.pointerEvents = 'none';
                }
            },
            mounted: function ($layer) {
                skipIntroLayerEl = $layer;
                // 视频 timeupdate 时根据时间决定是否显示
                art.on('video:timeupdate', function () {
                    if (!skipIntroLayerEl || !art || !art.video) return;
                    if (typeof skipIntroEnabled !== 'undefined' && !skipIntroEnabled) return;
                    const t = art.video.currentTime;
                    const endT = typeof skipIntroTime !== 'undefined' ? skipIntroTime : 90;
                    if (t > 5 && t < endT - 2) {
                        skipIntroLayerEl.style.opacity = '1';
                        skipIntroLayerEl.style.pointerEvents = 'auto';
                    } else {
                        skipIntroLayerEl.style.opacity = '0';
                        skipIntroLayerEl.style.pointerEvents = 'none';
                    }
                });
                // 自动跳过：首次进入片头范围内时直接跳过
                var autoSkipped = false;
                art.once('video:timeupdate', function () {
                    if (!art.video) return;
                    if (typeof skipIntroEnabled === 'undefined' || !skipIntroEnabled) return;
                    if (autoSkipped) return;
                    if (art.video.currentTime < skipIntroTime) {
                        autoSkipped = true;
                    }
                });
            }
        });
    } catch (e) {}

    // ===== 新剧集更新提示（顶部浮层）=====
    try {
        art.layers.add({
            name: 'new-episode-hint',
            html: '📺 已加载第 ' + (currentEpisodeIndex + 1) + ' 集 / 共 ' + currentEpisodes.length + ' 集',
            style: {
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                'font-size': '13px',
                'border-radius': '4px',
                opacity: '0',
                transition: 'opacity 0.5s ease',
                'z-index': '11',
                'pointer-events': 'none',
                'user-select': 'none'
            },
            mounted: function ($layer) {
                // 切集后显示 3 秒
                setTimeout(function () {
                    if ($layer) $layer.style.opacity = '1';
                }, 300);
                setTimeout(function () {
                    if ($layer) $layer.style.opacity = '0';
                }, 3300);
            }
        });
    } catch (e) {}

    // ===== 自定义右键菜单 =====
    try {
        art.contextmenu.add({
            html: '复制当前视频链接',
            click: function () {
                var url = art && art.video ? art.video.currentSrc || art.url : '';
                if (url) {
                    var copyIt = function () {
                        try {
                            var ta = document.createElement('textarea');
                            ta.value = url;
                            ta.style.position = 'fixed';
                            ta.style.left = '-9999px';
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                            if (art && art.notice) art.notice.show = '链接已复制';
                        } catch (err) {
                            if (art && art.notice) art.notice.show = '复制失败';
                        }
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(url).then(function () {
                            if (art && art.notice) art.notice.show = '链接已复制';
                        }).catch(copyIt);
                    } else {
                        copyIt();
                    }
                }
            }
        });
        art.contextmenu.add({
            html: '在新标签页打开',
            click: function () {
                var url = art && art.video ? art.video.currentSrc || art.url : '';
                if (url) window.open(url, '_blank');
            }
        });
    } catch (e) {}

    // ===== 跳过片尾：快到结尾时若开启则自动切下一集 =====
    var endingTriggered = false;
    art.on('video:timeupdate', function () {
        if (!art.video) return;
        if (typeof skipEndingEnabled === 'undefined' || !skipEndingEnabled) return;
        if (typeof autoplayEnabled === 'undefined' || !autoplayEnabled) return;
        if (endingTriggered) return;
        const duration = art.video.duration;
        if (!duration || !isFinite(duration)) return;
        const endingStart = duration - (typeof skipEndingTime !== 'undefined' ? skipEndingTime : 120);
        if (art.video.currentTime > endingStart && art.video.currentTime < duration - 5) {
            endingTriggered = true;
            if (typeof playNextEpisode === 'function' &&
                currentEpisodeIndex < currentEpisodes.length - 1) {
                if (art.notice) art.notice.show = '即将跳过片尾，播放下一集...';
                setTimeout(function () {
                    playNextEpisode();
                }, 800);
            }
        }
    });
    // 重置 endingTriggered，每集都能再次生效
    art.on('video:seeked', function () {
        if (art.video && art.video.currentTime < (art.video.duration - 300)) {
            endingTriggered = false;
        }
    });
}

function refreshEpisodeButtons(art) {
    if (!art || !art.controls) return;
    const isFirst = currentEpisodeIndex <= 0;
    const isLast = currentEpisodeIndex >= currentEpisodes.length - 1;

    // 使用 DOM 方式禁用/启用，避免 art.controls.update 的 disable 彻底移除控件
    const prevEl = document.querySelector('.art-control-prev-episode');
    const nextEl = document.querySelector('.art-control-next-episode');
    if (prevEl) {
        if (isFirst) {
            prevEl.style.opacity = '0.3';
            prevEl.style.pointerEvents = 'none';
            prevEl.setAttribute('aria-disabled', 'true');
        } else {
            prevEl.style.opacity = '';
            prevEl.style.pointerEvents = '';
            prevEl.removeAttribute('aria-disabled');
        }
    }
    if (nextEl) {
        if (isLast) {
            nextEl.style.opacity = '0.3';
            nextEl.style.pointerEvents = 'none';
            nextEl.setAttribute('aria-disabled', 'true');
        } else {
            nextEl.style.opacity = '';
            nextEl.style.pointerEvents = '';
            nextEl.removeAttribute('aria-disabled');
        }
    }
}

function renderPlayerDetailInfo() {
    const container = document.getElementById('playerDetailInfo');
    if (!container) return;

    const metaContainer = document.getElementById('detailMetaContainer');
    const descBody = document.getElementById('detailDescBody');
    const arrow = container.querySelector('.detail-toggle-arrow');

    let videoInfo = null;
    try {
        videoInfo = StorageService.getCurrentVideoInfo();

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
        if (videoInfo && videoInfo.actor) {
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

function toggleEpisodeSection() {
    const section = document.getElementById('episodeSection');
    if (!section) return;
    section.classList.toggle('episode-collapsed');
}

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
      <button class="resource-switch-btn flex" id="switchResourceBtn" data-action="show-switch-resource">
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
      <button class="resource-switch-btn flex" id="switchResourceBtn" data-action="show-switch-resource">
        <span class="resource-switch-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        切换资源
      </button>
    `;
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
    modal.classList.add('flex');

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
    let speedResults = {};

    // 对所有源：搜索 + 测速并行执行，渐进式渲染
    await Promise.all(resourceOptions.map(async (opt) => {
        let queryResult = await searchByAPIAndKeyWord(opt.key, currentVideoTitle);
        if (!queryResult || queryResult.length === 0) return;
        let result = queryResult[0];
        queryResult.forEach((res) => { if (res.vod_name === currentVideoTitle) result = res; });
        allResults[opt.key] = result;

        // 找到结果后立即并行测速
        testVideoSourceSpeed(opt.key, result.vod_id).then(speed => {
            speedResults[opt.key] = speed;
            renderResourceGrid();
        });

        // 每次找到新源就立即重新渲染（渐进式）
        renderResourceGrid();
    }));

    renderResourceGrid();

    function renderResourceGrid() {
        if (!allResults || Object.keys(allResults).length === 0) return;
        const sorted = Object.entries(allResults).sort(([keyA, resultA], [keyB, resultB]) => {
            const isCurrentA = String(keyA) === String(currentSourceCode) && String(resultA.vod_id) === String(currentVideoId);
            const isCurrentB = String(keyB) === String(currentSourceCode) && String(resultB.vod_id) === String(currentVideoId);
            if (isCurrentA && !isCurrentB) return -1;
            if (!isCurrentA && isCurrentB) return 1;
            const speedA = speedResults[keyA]?.speed || 99999;
            const speedB = speedResults[keyB]?.speed || 99999;
            if (speedA === -1 && speedB !== -1) return 1;
            if (speedA !== -1 && speedB === -1) return -1;
            return speedA - speedB;
        });
        let html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">';
        for (const [sourceKey, result] of sorted) {
            if (!result) continue;
            const isCurrentSource = String(sourceKey) === String(currentSourceCode) && String(result.vod_id) === String(currentVideoId);
            const sourceName = resourceOptions.find(opt => opt.key === sourceKey)?.name || '未知资源';
            const spd = speedResults[sourceKey] || {};
            const speedBadge = spd.speed === undefined
                ? '<span class="text-yellow-400">测速中...</span>'
                : formatSpeedDisplay(spd);
            html += `<div class="relative group ${isCurrentSource ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 transition-transform'}" 
                     ${!isCurrentSource ? `data-action="switch-to-resource" data-key="${sourceKey}" data-vod-id="${result.vod_id}"` : ''}>
                    <div class="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative">
                        <img src="${result.vod_pic}" alt="${result.vod_name}" class="w-full h-full object-cover"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjE3IDggMTIgMyA3IDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEyIDN2MTIiPjwvcGF0aD48L3N2Zz4='">
                        <div class="absolute top-1 right-1 speed-badge bg-black/75 text-xs px-1.5 py-0.5 rounded">${speedBadge}</div>
                    </div>
                    <div class="mt-2">
                        <div class="text-xs font-medium text-gray-200 truncate">${result.vod_name}</div>
                        <div class="text-[10px] text-gray-400 truncate">${sourceName}</div>
                    </div>
                    ${isCurrentSource ? '<div class="absolute inset-0 flex items-center justify-center"><div class="bg-blue-600/75 rounded-lg px-2 py-0.5 text-xs text-white font-medium">当前播放</div></div>' : ''}
                </div>`;
        }
        html += '</div>';
        modalContent.innerHTML = html;
    }
    
}

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

        // 跳转到播放页面
        window.location.href = watchUrl;
        
    } catch (error) {
        console.error('切换资源失败:', error);
        showToast('切换资源失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}