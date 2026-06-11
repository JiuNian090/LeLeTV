(function () {
    'use strict';

    var TITLE_TEXT = 'LeLeTV';
    var FONT_NAME = 'MapleMono';
    var ANIMATION_DURATION = 2200;
    // 展开边缘发光（已移除）

    var fontReady = false;
    var _rafId = null;

    function loadFont() {
        if (fontReady) return Promise.resolve();
        var font = new FontFace(FONT_NAME, 'url(/fonts/MapleMono-Italic.ttf)');
        return font.load().then(function () {
            document.fonts.add(font);
            return document.fonts.load('100px ' + FONT_NAME);
        }).then(function () {
            fontReady = true;
        }).catch(function () {
            console.warn('MapleMono字体加载失败，使用后备字体');
        });
    }

    // 在页面加载前就开始加载字体，播放时确保字体已就绪
    var fontLoadPromise = loadFont();

    function cleanupContainer(container) {
        if (!container) return;
        var children = container.children;
        for (var i = children.length - 1; i >= 0; i--) {
            container.removeChild(children[i]);
        }
    }

    function getFontStr(fontSize) {
        var family = fontReady ? FONT_NAME : 'monospace';
        return '900 ' + fontSize + 'px "' + family + '",monospace';
    }

    // makeTextGlow 已移除 — 纯文字展开动画，无模糊圆画笔

    // 缓动函数：前 70% 快速展开，后 30% 慢速收尾
    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function playOnce() {
        // 取消上一次动画循环
        if (_rafId) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }

        var container = document.getElementById('titleContainer');
        if (!container) return;

        cleanupContainer(container);

        var dpr = window.devicePixelRatio || 1;
        var rect = container.getBoundingClientRect();
        var containerW = Math.max(rect.width, 200);
        var containerH = Math.max(rect.height, 60);

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

        // 预计算文字尺寸（整个动画期间不变）
        var fontSize = Math.round(Math.min(containerH * 0.75, 80));
        var fontStr = getFontStr(fontSize);
        ctx.font = fontStr;
        var textWidth = ctx.measureText(TITLE_TEXT).width;
        var cx = containerW / 2;
        var cy = containerH / 2;

        var startTime = performance.now();

        function drawFrame(now) {
            if (!canvas || !canvas.parentNode) return;

            var elapsed = now - startTime;
            var progress = Math.min(elapsed / ANIMATION_DURATION, 1);
            var eased = easeOutQuart(progress);

            ctx.clearRect(0, 0, containerW, containerH);

            // 文字展开宽度
            var revealWidth = textWidth * eased;
            var clipLeft = cx - textWidth / 2;
            var clipRight = clipLeft + revealWidth;
            var pad = Math.min(16, fontSize * 0.18);

            // --- 玻璃质感文字（多层绘制） ---
            ctx.save();
            ctx.beginPath();
            ctx.rect(clipLeft - pad, 0, revealWidth + pad * 2, containerH);
            ctx.clip();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = fontStr;

            // 1. 发光阴影（让玻璃有深度感）
            ctx.shadowColor = 'rgba(255, 255, 255, 0.25)';
            ctx.shadowBlur = 16;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fillText(TITLE_TEXT, cx, cy);
            ctx.shadowBlur = 0;

            // 2. 玻璃基体（让更多背景透过，玻璃质感更明显）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillText(TITLE_TEXT, cx, cy);

            // 3. 顶部玻璃高光（渐变：上亮下暗）
            var grad = ctx.createLinearGradient(0, 0, 0, containerH);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
            grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.20)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
            ctx.fillStyle = grad;
            ctx.fillText(TITLE_TEXT, cx, cy);

            // 4. 玻璃边缘描边
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
            ctx.lineWidth = 1.0;
            ctx.strokeText(TITLE_TEXT, cx, cy);

            ctx.restore();

            // --- 继续或结束动画 ---
            if (progress < 1) {
                _rafId = requestAnimationFrame(drawFrame);
            } else {
                // 动画完成，无缝过渡到 h1
                _rafId = null;
                finish(canvas, container, fontSize);
            }
        }

        _rafId = requestAnimationFrame(drawFrame);
    }

    function finish(canvas, container, fontSize) {
        if (!canvas || !canvas.parentNode) return;

        // 不移除 Canvas — 保留最后一帧作为最终状态
        // Canvas 的 textBaseline:'middle' 与 DOM h1 的 vertical centering
        // 对同一字体可能产生 1-3px 垂直偏移，直接保留 Canvas 避免切换闪烁
        // 下次 playOnce 时 cleanupContainer 会自动清理
    }

    // 字体提前加载，不阻塞首次播放
    fontLoadPromise.then(function () {
        // 字体加载完成后，如果容器中没有 canvas（动画还没播），更新已渲染的 h1 字体
        var container = document.getElementById('titleContainer');
        if (container) {
            var h1 = container.querySelector('h1');
            if (h1 && h1.style.fontFamily.indexOf(FONT_NAME) === -1) {
                h1.style.fontFamily = '"' + FONT_NAME + '",monospace';
            }
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        // 等字体加载完成后再播首次动画，避免字体中途切换
        fontLoadPromise.finally(function () {
            setTimeout(playOnce, 100);
        });

        var homePage = document.getElementById('page-home');
        if (homePage) {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].attributeName === 'class') {
                        if (homePage.classList.contains('active')) {
                            setTimeout(playOnce, 80);
                        }
                    }
                }
            });
            observer.observe(homePage, { attributes: true });
        }
    });
})();