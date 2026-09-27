/**
 * 动态效果偏好：跟随系统 / 开启 / 关闭
 * 系统开着「减少动态效果」（Windows 关掉了「动画效果」、macOS 开了「减弱动态效果」）时，浏览器会报
 * prefers-reduced-motion，站里的聚合动效、背景光晕、换色过渡都会静止；这里允许在设置里强制开启或关闭。
 *   - 首帧由 index.html / player.html 的 head 脚本把 data-motion 打到 <html> 上，css 据此放行或停掉动画
 *   - 脚本里的判断统一走 LeLeMotion.reduced()；改了偏好会派发 leletv:motionchange
 */
(function () {
  'use strict';

  var KEY = 'leletv_motion';

  function pref() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'on' || v === 'off' ? v : 'auto';
    } catch (e) { return 'auto'; }
  }

  function systemReduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /** 现在该不该静止：强制开启 → 否；强制关闭 → 是；其余跟系统 */
  function reduced() {
    var p = pref();
    if (p === 'on') return false;
    if (p === 'off') return true;
    return systemReduced();
  }

  function apply(p) {
    var d = document.documentElement;
    if (p === 'on' || p === 'off') d.setAttribute('data-motion', p);
    else d.removeAttribute('data-motion');
  }

  function syncControl() {
    var box = document.querySelector('[data-role="motion-pref"]');
    if (!box) return;
    var p = pref();
    Array.prototype.forEach.call(box.querySelectorAll('[data-motion]'), function (btn) {
      var on = btn.getAttribute('data-motion') === p;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', String(on));
    });
    var note = box.querySelector('[data-role="motion-note"]');
    if (note) {
      note.textContent = systemReduced()
        ? '系统当前开着「减少动态效果」' + (p === 'on' ? '，已强制开启。' : (p === 'auto' ? '，动效已静止。' : '。'))
        : '';
    }
  }

  function set(p) {
    try {
      if (p === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch (e) { /* 忽略 */ }
    apply(p);
    syncControl();
    try {
      window.dispatchEvent(new CustomEvent('leletv:motionchange', { detail: { pref: p, reduced: reduced() } }));
    } catch (e) { /* 忽略 */ }
  }

  function init() {
    apply(pref());
    syncControl();
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-role="motion-pref"] [data-motion]') : null;
      if (!btn) return;
      set(btn.getAttribute('data-motion'));
    });
    try {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function () {
        syncControl();
        window.dispatchEvent(new CustomEvent('leletv:motionchange', { detail: { pref: pref(), reduced: reduced() } }));
      });
    } catch (e) { /* 旧浏览器没有 addEventListener，忽略 */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.LeLeMotion = { reduced: reduced, pref: pref, set: set };
})();
