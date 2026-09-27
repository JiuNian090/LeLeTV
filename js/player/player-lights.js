// LeLeTV — 播放页关灯：整页压黑只留播放器。偏好记在 localStorage（leletv_lights），点黑色区域或按 Esc 开灯
(function () {
    'use strict';

    const KEY = 'leletv_lights';

    function isOff() {
        return document.body.classList.contains('lights-off');
    }

    function apply(off, save) {
        document.body.classList.toggle('lights-off', off);
        const btn = document.getElementById('lightsToggle');
        if (btn) {
            btn.setAttribute('aria-pressed', String(off));
            const label = btn.querySelector('span');
            if (label) label.textContent = off ? '开灯' : '关灯';
        }
        if (save) {
            try { localStorage.setItem(KEY, off ? 'off' : 'on'); } catch (e) { /* 忽略 */ }
        }
    }

    function init() {
        const overlay = document.getElementById('lightsOverlay');
        const btn = document.getElementById('lightsToggle');
        if (!overlay || !btn) return;
        let off = false;
        try { off = localStorage.getItem(KEY) === 'off'; } catch (e) { /* 忽略 */ }
        apply(off, false);
        btn.addEventListener('click', () => apply(!isOff(), true));
        overlay.addEventListener('click', () => apply(false, true));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOff()) apply(false, true);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.LeLeLights = { set(off) { apply(!!off, true); }, isOff };
})();
