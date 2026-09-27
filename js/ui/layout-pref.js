/**
 * 首页与导航的布局偏好（设置 › 首页与导航）
 *   hub      首页聚合动效
 *   shelves  首页内容板块（继续观看、最近更新）
 *   navIcons 导航栏只显示图标（桌面；手机端一律只显示图标）
 * 三项都关掉就是只有搜索框的简洁首页。
 *
 * 存储按数据域分开，与主题（leletv_theme_normal / leletv_theme_hidden）同一套惯例：
 *   正常模式  leletv_layout
 *   私密模式  leletv_layout_hidden
 * 私密模式以「不露内容」为先，所以 hub / shelves 在该域的默认值是关闭的；
 * 用户在设置里手动打开会记到该域自己的键上，切回正常模式仍按原来的设置。
 *
 * 首帧由 index.html 的 head 脚本把 data-home-hub / data-home-shelves / data-nav 打到 <html> 上，
 * css 据此直接隐藏，不会先渲染再收起。这里负责设置页的开关与运行时切换（派发 leletv:layoutchange）。
 */
(function () {
  'use strict';

  var KEY = 'leletv_layout';
  var KEY_HIDDEN = 'leletv_layout_hidden';
  var DEFAULTS = { hub: true, shelves: true, navIcons: false };
  // 私密模式默认关掉首页聚合动效与内容板块（仍可在设置里手动打开）
  var DEFAULTS_HIDDEN = { hub: false, shelves: false, navIcons: false };

  function hidden() {
    try {
      return typeof isHiddenContentMode === 'function' ? isHiddenContentMode() : false;
    } catch (e) { return false; }
  }

  function key() { return hidden() ? KEY_HIDDEN : KEY; }
  function defaults() { return hidden() ? DEFAULTS_HIDDEN : DEFAULTS; }

  function read() {
    var def = defaults();
    var out = { hub: def.hub, shelves: def.shelves, navIcons: def.navIcons };
    try {
      var raw = JSON.parse(localStorage.getItem(key()) || '{}');
      if (raw && typeof raw === 'object') {
        Object.keys(out).forEach(function (k) { if (typeof raw[k] === 'boolean') out[k] = raw[k]; });
      }
    } catch (e) { /* 忽略坏数据 */ }
    return out;
  }

  function write(prefs) {
    var def = defaults();
    try {
      // 与默认值相同就不必落盘（读的时候回落到默认值）
      var same = Object.keys(DEFAULTS).every(function (k) { return prefs[k] === def[k]; });
      if (same) localStorage.removeItem(key());
      else localStorage.setItem(key(), JSON.stringify(prefs));
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

  /** 按当前数据域重新读一遍并应用（数据域变化后调用；正常情况下切换私密模式会整页重载，用不到） */
  function refresh() {
    var prefs = read();
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

  window.LeLeLayout = { get: read, set: set, refresh: refresh };
})();
