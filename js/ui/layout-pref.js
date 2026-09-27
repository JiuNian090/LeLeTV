/**
 * 首页与导航的布局偏好（设置 › 首页与导航）
 *   hub      首页聚合动效
 *   shelves  首页内容板块（继续观看、最近更新）
 *   navIcons 导航栏只显示图标（桌面；手机底栏保留文字）
 * 三项都关掉就是只有搜索框的简洁首页。
 * 存在 localStorage 的 leletv_layout（JSON）；首帧由 index.html 的 head 脚本把 data-home-hub / data-home-shelves / data-nav
 * 打到 <html> 上，css 据此直接隐藏，不会先渲染再收起。这里负责设置页的开关与运行时切换（派发 leletv:layoutchange）。
 */
(function () {
  'use strict';

  var KEY = 'leletv_layout';
  var DEFAULTS = { hub: true, shelves: true, navIcons: false };

  function read() {
    var out = { hub: DEFAULTS.hub, shelves: DEFAULTS.shelves, navIcons: DEFAULTS.navIcons };
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (raw && typeof raw === 'object') {
        Object.keys(out).forEach(function (k) { if (typeof raw[k] === 'boolean') out[k] = raw[k]; });
      }
    } catch (e) { /* 忽略坏数据 */ }
    return out;
  }

  function write(prefs) {
    try {
      var same = Object.keys(DEFAULTS).every(function (k) { return prefs[k] === DEFAULTS[k]; });
      if (same) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* 忽略 */ }
  }

  function apply(prefs) {
    var d = document.documentElement;
    if (prefs.hub) d.removeAttribute('data-home-hub'); else d.setAttribute('data-home-hub', 'off');
    if (prefs.shelves) d.removeAttribute('data-home-shelves'); else d.setAttribute('data-home-shelves', 'off');
    if (prefs.navIcons) d.setAttribute('data-nav', 'icons'); else d.removeAttribute('data-nav');
  }

  function syncControls(prefs) {
    Array.prototype.forEach.call(document.querySelectorAll('input[data-layout-pref]'), function (input) {
      var k = input.getAttribute('data-layout-pref');
      if (k in prefs) input.checked = prefs[k];
    });
  }

  function set(key, value) {
    var prefs = read();
    if (!(key in prefs)) return;
    prefs[key] = !!value;
    write(prefs);
    apply(prefs);
    syncControls(prefs);
    try {
      window.dispatchEvent(new CustomEvent('leletv:layoutchange', { detail: prefs }));
    } catch (e) { /* 忽略 */ }
  }

  function init() {
    var prefs = read();
    apply(prefs);
    syncControls(prefs);
    document.addEventListener('change', function (e) {
      var input = e.target;
      if (!input || !input.getAttribute || !input.getAttribute('data-layout-pref')) return;
      set(input.getAttribute('data-layout-pref'), input.checked);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.LeLeLayout = { get: read, set: set };
})();
