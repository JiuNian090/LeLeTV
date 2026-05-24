(function () {
    'use strict';

    var TITLE_TEXT = 'LeLeTV';
    var FONT_NAME = 'MapleMono';
    var ANIMATION_DURATION = 2000;
    var EDGE_GLOW_RADIUS = 40;

    var fontLoaded = false;
    var isPlaying = false;

    function loadFont() {
        if (fontLoaded) return Promise.resolve();
        var font = new FontFace(FONT_NAME, 'url(/MapleMono-Italic.ttf)');
        return font.load().then(function () {
            document.fonts.add(font);
            return document.fonts.load('100px ' + FONT_NAME);
        }).then(function () {
            fontLoaded = true;
        }).catch(function () {
            console.warn('MapleMono字体加载失败，使用后备字体');
        });
    }

    function cleanupContainer(container) {
        if (!container) return;
        var children = container.children;
        for (var i = children.length - 1; i >= 0; i--) {
            container.removeChild(children[i]);
        }
    }

    function playOnce() {
        if (isPlaying) return;
        isPlaying = true;

        var container = document.getElementById('titleContainer');
        if (!container) {
            isPlaying = false;
            return;
        }

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
        container.appendChild(canvas);

        function calcTextSize() {
            var fontSize = Math.round(Math.min(containerH * 0.75, 80));
            var fontStr = 'bold ' + fontSize + 'px ' + (fontLoaded ? FONT_NAME : 'monospace');
            ctx.font = fontStr;
            var width = ctx.measureText(TITLE_TEXT).width;
            return { fontStr: fontStr, fontSize: fontSize, width: width };
        }

        var startTime = Date.now();
        var isComplete = false;
        var textFontSize = 0;

        function drawFrame() {
            if (!canvas || !canvas.parentNode) return;

            var elapsed = Date.now() - startTime;
            var progress = Math.min(elapsed / ANIMATION_DURATION, 1);
            var eased = 1 - Math.pow(1 - progress, 3);

            ctx.clearRect(0, 0, containerW, containerH);

            var ts = calcTextSize();
            textFontSize = ts.fontSize;
            var cx = containerW / 2;
            var cy = containerH / 2;
            ctx.font = ts.fontStr;

            var revealWidth = ts.width * eased;
            var clipLeft = cx - ts.width / 2;
            var clipRight = clipLeft + revealWidth;

            ctx.save();
            ctx.beginPath();
            ctx.rect(clipLeft - 5, 0, revealWidth + 10, containerH);
            ctx.clip();

            ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
            ctx.shadowBlur = 12;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(TITLE_TEXT, cx, cy);
            ctx.shadowBlur = 0;
            ctx.restore();

            if (progress < 1) {
                var edgeX = Math.min(clipRight, cx + ts.width / 2);

                ctx.save();

                var glow = ctx.createRadialGradient(edgeX, cy, 0, edgeX, cy, EDGE_GLOW_RADIUS);
                glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
                glow.addColorStop(0.15, 'rgba(255, 255, 255, 0.5)');
                glow.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
                glow.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.beginPath();
                ctx.arc(edgeX, cy, EDGE_GLOW_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();

                var core = ctx.createRadialGradient(edgeX, cy, 0, edgeX, cy, 16);
                core.addColorStop(0, 'rgba(255, 255, 255, 1)');
                core.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
                core.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.beginPath();
                ctx.arc(edgeX, cy, 16, 0, Math.PI * 2);
                ctx.fillStyle = core;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(edgeX, cy, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                ctx.restore();

                requestAnimationFrame(drawFrame);
            } else if (!isComplete) {
                isComplete = true;
                setTimeout(function () { finish(canvas, ctx, container, containerW, containerH, textFontSize); }, 400);
            }
        }

        requestAnimationFrame(drawFrame);
    }

    function finish(canvas, ctx, container, containerW, containerH, textFontSize) {
        isPlaying = false;
        if (!canvas || !canvas.parentNode) return;

        ctx.clearRect(0, 0, containerW, containerH);

        var fontSize = Math.round(Math.min(containerH * 0.75, 80));
        var fontStr = 'bold ' + fontSize + 'px ' + (fontLoaded ? FONT_NAME : 'monospace');
        ctx.font = fontStr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 20;
        ctx.fillText(TITLE_TEXT, containerW / 2, containerH / 2);
        ctx.shadowBlur = 0;

        var h1 = document.createElement('h1');
        h1.textContent = TITLE_TEXT;
        h1.style.cssText = (
            'position:absolute;' +
            'top:50%;left:50%;' +
            'transform:translate(-50%,-50%);' +
            'pointer-events:none;' +
            'z-index:2;' +
            'font-family:"' + (fontLoaded ? FONT_NAME : 'monospace') + '",monospace;' +
            'font-weight:bold;' +
            'font-size:' + textFontSize + 'px;' +
            'color:#ffffff;' +
            'text-align:center;' +
            'white-space:nowrap;' +
            'text-shadow:0 0 20px rgba(255,255,255,0.4)'
        );

        container.removeChild(canvas);
        container.appendChild(h1);
    }

    loadFont();

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(playOnce, 150);

        var homePage = document.getElementById('page-home');
        if (homePage) {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].attributeName === 'class') {
                        if (homePage.classList.contains('active')) {
                            setTimeout(playOnce, 100);
                        }
                    }
                }
            });
            observer.observe(homePage, { attributes: true });
        }
    });
})();