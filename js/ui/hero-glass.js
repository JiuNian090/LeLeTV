// 首屏玻璃字标：环境光跟着指针走，边缘那条细高光随之转向（只反射，不发光）
// 主光在指针那一侧，次光在对侧；方位角按最短弧平滑过渡。触屏、减少动态效果时不动
(function () {
    'use strict';

    var REST = 230;   // 没有指针时光从左上方来

    function init() {
        var hero = document.querySelector('.v2-hero');
        var lightsA = document.querySelectorAll('.v2-hero-light-a');
        var lightsB = document.querySelectorAll('.v2-hero-light-b');
        var box = document.querySelector('.v2-hero-glassbox');
        if (!hero || !lightsA.length || !lightsB.length || !box) return;
        if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;

        var target = REST, current = REST, raf = 0;
        function reduced() {
            return !!(window.LeLeMotion && typeof LeLeMotion.reduced === 'function' && LeLeMotion.reduced());
        }
        function tick() {
            raf = 0;
            var d = ((target - current + 540) % 360) - 180;
            current = (current + d * 0.12 + 360) % 360;
            var az = current.toFixed(1), az2 = ((current + 180) % 360).toFixed(1);
            lightsA.forEach(function (l) { l.setAttribute('azimuth', az); });
            lightsB.forEach(function (l) { l.setAttribute('azimuth', az2); });
            if (Math.abs(d) > 0.3) raf = requestAnimationFrame(tick);
        }
        function aim(angle) {
            target = angle;
            if (!raf) raf = requestAnimationFrame(tick);
        }
        hero.addEventListener('pointermove', function (e) {
            if (reduced() || e.pointerType === 'touch') return;
            var r = box.getBoundingClientRect();
            // SVG 的方位角：x 轴起、顺时针为正（y 朝下）；光源在指针那一侧
            aim(Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI);
        });
        hero.addEventListener('pointerleave', function () { aim(REST); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
