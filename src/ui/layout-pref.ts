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

import { isHiddenContentMode } from '../core/state';

export interface LayoutPrefs {
  hub: boolean;
  shelves: boolean;
  navIcons: boolean;
}

export type LayoutPrefKey = 'hub' | 'shelves' | 'navIcons';

export interface LayoutApi {
  get: () => LayoutPrefs;
  set: (key: LayoutPrefKey, value: boolean) => void;
  refresh: () => void;
}

const KEY = 'leletv_layout';
const KEY_HIDDEN = 'leletv_layout_hidden';
const DEFAULTS: LayoutPrefs = { hub: true, shelves: true, navIcons: false };
// 私密模式默认关掉首页聚合动效与内容板块（仍可在设置里手动打开）
const DEFAULTS_HIDDEN: LayoutPrefs = { hub: false, shelves: false, navIcons: false };

function hidden(): boolean {
  try {
    return typeof isHiddenContentMode === 'function' ? isHiddenContentMode() : false;
  } catch (e) { return false; }
}

function key(): string { return hidden() ? KEY_HIDDEN : KEY; }
function defaults(): LayoutPrefs { return hidden() ? DEFAULTS_HIDDEN : DEFAULTS; }

export function readLayoutPrefs(): LayoutPrefs {
  const def = defaults();
  const out: LayoutPrefs = { hub: def.hub, shelves: def.shelves, navIcons: def.navIcons };
  try {
    const raw = JSON.parse(localStorage.getItem(key()) || '{}') as Record<string, unknown>;
    if (raw && typeof raw === 'object') {
      (Object.keys(out) as LayoutPrefKey[]).forEach(function (k) {
        if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean;
      });
    }
  } catch (e) { /* 忽略坏数据 */ }
  return out;
}

function write(prefs: LayoutPrefs): void {
  const def = defaults();
  try {
    // 与默认值相同就不必落盘（读的时候回落到默认值）
    const same = (Object.keys(DEFAULTS) as LayoutPrefKey[]).every(function (k) { return prefs[k] === def[k]; });
    if (same) localStorage.removeItem(key());
    else localStorage.setItem(key(), JSON.stringify(prefs));
  } catch (e) { /* 忽略 */ }
}

function apply(prefs: LayoutPrefs): void {
  const d = document.documentElement;
  if (prefs.hub) d.removeAttribute('data-home-hub'); else d.setAttribute('data-home-hub', 'off');
  if (prefs.shelves) d.removeAttribute('data-home-shelves'); else d.setAttribute('data-home-shelves', 'off');
  if (prefs.navIcons) d.setAttribute('data-nav', 'icons'); else d.removeAttribute('data-nav');
}

function syncControls(prefs: LayoutPrefs): void {
  Array.prototype.forEach.call(document.querySelectorAll<HTMLInputElement>('input[data-layout-pref]'), function (input: HTMLInputElement) {
    const k = input.getAttribute('data-layout-pref');
    if (k && k in prefs) input.checked = prefs[k as LayoutPrefKey];
  });
}

// 简洁首页（关闭聚合动效与内容板块）在竖屏手机上：
// 把页脚的实际高度写成 CSS 变量，标题区据此扣掉页脚，整页正好落在一屏内，
// 页脚不需要下滑就能看到。其他页面/布局不受影响。
let _compactRaf = 0;

function syncCompactFooter(): void {
  const layout = document.querySelector('.home-layout.v2-home') as HTMLElement | null;
  if (!layout) return;
  const d = document.documentElement;
  const compact = d.getAttribute('data-home-hub') === 'off'
    && d.getAttribute('data-home-shelves') === 'off'
    && window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
  if (!compact) {
    layout.style.removeProperty('--home-footer-h');
    return;
  }
  const footer = document.querySelector('.footer');
  if (!footer) return;
  const h = Math.ceil(footer.getBoundingClientRect().height);
  if (h > 0) layout.style.setProperty('--home-footer-h', h + 'px');
}

function queueCompactFooter(): void {
  if (_compactRaf) return;
  _compactRaf = requestAnimationFrame(function () {
    _compactRaf = 0;
    syncCompactFooter();
  });
}

export function setLayoutPref(key: LayoutPrefKey, value: boolean): void {
  const prefs = readLayoutPrefs();
  if (!(key in prefs)) return;
  prefs[key] = !!value;
  write(prefs);
  apply(prefs);
  syncControls(prefs);
  queueCompactFooter();
  try {
    window.dispatchEvent(new CustomEvent('leletv:layoutchange', { detail: prefs }));
  } catch (e) { /* 忽略 */ }
}

/** 按当前数据域重新读一遍并应用（数据域变化后调用；正常情况下切换私密模式会整页重载，用不到） */
export function refreshLayoutPrefs(): void {
  const prefs = readLayoutPrefs();
  apply(prefs);
  syncControls(prefs);
  queueCompactFooter();
  try {
    window.dispatchEvent(new CustomEvent('leletv:layoutchange', { detail: prefs }));
  } catch (e) { /* 忽略 */ }
}

export function initLayoutPrefs(): void {
  const prefs = readLayoutPrefs();
  apply(prefs);
  syncControls(prefs);
  document.addEventListener('change', function (e) {
    const input = e.target as HTMLInputElement;
    if (!input || !input.getAttribute || !input.getAttribute('data-layout-pref')) return;
    setLayoutPref(input.getAttribute('data-layout-pref') as LayoutPrefKey, input.checked);
  });

  // 简洁首页的首屏高度依赖页脚实际高度：尺寸变化、字体就绪或版本信息更新后重新测量
  window.addEventListener('resize', queueCompactFooter);
  window.addEventListener('load', queueCompactFooter);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(queueCompactFooter).catch(function () { /* 忽略 */ });
  }
  queueCompactFooter();
}

export const LeLeLayout: LayoutApi = {
  get: readLayoutPrefs,
  set: setLayoutPref,
  refresh: refreshLayoutPrefs,
};

interface LayoutWindow extends Window {
  LeLeLayout?: LayoutApi;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLayoutPrefs);
else initLayoutPrefs();

// HTML 内联脚本与设置页仍按全局名访问（跨层契约；5B-5 收敛白名单）
(window as LayoutWindow).LeLeLayout = LeLeLayout;
