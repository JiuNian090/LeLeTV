(function () {
    'use strict';

    var TITLE_TEXT = 'LeLeTV';
    var FONT_NAME = 'MapleMono';
    var ANIMATION_DURATION = 1800; // 稍快 (2200→1800)
    var FONT_URL = '/fonts/MapleMono-Italic.ttf';

    var fontReady = false;
    var _rafId = null;

    // 异步加载字体，不阻塞任何事
    function loadFont() {
        if (fontReady) return Promise.resolve();
        try {
            var font = new FontFace(FONT_NAME, 'url(' + FONT_URL + ')');
            return font.load().then(function () {
                document.fonts.add(font);
                return document.fonts.load('100px ' + FONT_NAME);
            }).then(function () {
                fontReady = true;
            }).catch(function () {
                console.warn('MapleMono字体加载失败，使用后备字体');
            });
        } catch (e) {
            return Promise.resolve();
        }
    }

    loadFont();

    // ====== 离屏缓存：只渲染一次文字图案 ======
    var _cachedSheet = null; // { canvas, cx, cy, textWidth }

    function buildTextSheet(containerW, containerH, dpr) {
        var fontSize = Math.round(Math.min(containerH * 0.75, 80));
        var family = fontReady ? FONT_NAME : 'monospace';
        var fontStr = '900 ' + fontSize + 'px "' + family + '",monospace';

        // 离屏 canvas（文字渲染层）
        var sheet = document.createElement('canvas');
        sheet.width = containerW * dpr;
        sheet.height = containerH * dpr;
        var sctx = sheet.getContext('2d');
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = 'high';
        sctx.font = fontStr;
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';

        var cx = containerW / 2;
        var cy = containerH / 2;
        var textWidth = sctx.measureText(TITLE_TEXT).width;

        // 1. 发光阴影
        sctx.shadowColor = 'rgba(255, 255, 255, 0.25)';
        sctx.shadowBlur = 16;
        sctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        sctx.fillText(TITLE_TEXT, cx, cy);
        sctx.shadowBlur = 0;

        // 2. 玻璃基体
        sctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        sctx.fillText(TITLE_TEXT, cx, cy);

        // 3. 顶部高光渐变
        var grad = sctx.createLinearGradient(0, 0, 0, containerH);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.20)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        sctx.fillStyle = grad;
        sctx.fillText(TITLE_TEXT, cx, cy);

        // 4. 边缘描边
        sctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
        sctx.lineWidth = 1.0;
        sctx.strokeText(TITLE_TEXT, cx, cy);

        _cachedSheet = { canvas: sheet, cx: cx, cy: cy, textWidth: textWidth, fontSize: fontSize, fontStr: fontStr };
        return _cachedSheet;
    }

    function cleanupContainer(container) {
        if (!container) return;
        for (var i = container.children.length - 1; i >= 0; i--) {
            container.removeChild(container.children[i]);
        }
    }

    // 缓动函数
    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function playOnce() {
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }

        var container = document.getElementById('titleContainer');
        if (!container) return;
        cleanupContainer(container);

        var dpr = window.devicePixelRatio || 1;
        var rect = container.getBoundingClientRect();
        var containerW = Math.max(rect.width, 200);
        var containerH = Math.max(rect.height, 60);

        // 主画布（显示用）
        var canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2;';
        var ctx = canvas.getContext('2d');
        canvas.width = containerW * dpr;
        canvas.height = containerH * dpr;
        canvas.style.width = containerW + 'px';
        canvas.style.height = containerH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        container.appendChild(canvas);

        // 构建/复用离屏缓存
        var sheet = _cachedSheet;
        if (!sheet || sheet.canvas.width !== canvas.width) {
            sheet = buildTextSheet(containerW, containerH, dpr);
        }
        var cx = sheet.cx;
        var textWidth = sheet.textWidth;
        var pad = Math.min(16, sheet.fontSize * 0.18);

        var startTime = performance.now();

        function drawFrame(now) {
            if (!canvas || !canvas.parentNode) return;

            var elapsed = now - startTime;
            var progress = Math.min(elapsed / ANIMATION_DURATION, 1);
            var eased = easeOutQuart(progress);

            // 清除 & 裁剪 → 只需 blit 离屏 sheet
            ctx.clearRect(0, 0, containerW, containerH);

            var revealWidth = textWidth * eased;
            var clipLeft = cx - textWidth / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(clipLeft - pad, 0, revealWidth + pad * 2, containerH);
            ctx.clip();
            ctx.drawImage(sheet.canvas, 0, 0, containerW, containerH);
            ctx.restore();

            if (progress < 1) {
                _rafId = requestAnimationFrame(drawFrame);
            } else {
                _rafId = null;
            }
        }

        _rafId = requestAnimationFrame(drawFrame);
    }

    // ====== 立即播放 + 字体就绪后重放 ======
    document.addEventListener('DOMContentLoaded', function () {
        // 立即播第一遍（用后备字体或已缓存的字体）
        var fastTimer = setTimeout(playOnce, 50);

        // 字体加载成功后重播一次（玻璃质感过渡）
        loadFont().finally(function () {
            clearTimeout(fastTimer);
            // 清除缓存，重建时使用新字体
            _cachedSheet = null;
            setTimeout(playOnce, 80);
        });

        // 页面切换检测（分类 → 首页时重播）
        var homePage = document.getElementById('page-home');
        if (homePage) {
            var observer = new MutationObserver(function () {
                if (homePage.classList.contains('active')) {
                    setTimeout(playOnce, 80);
                }
            });
            observer.observe(homePage, { attributes: true });
        }
    });
})();