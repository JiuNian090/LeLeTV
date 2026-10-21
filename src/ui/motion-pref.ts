/**
 * 动态效果偏好：跟随系统 / 开启 / 关闭
 * 系统开着「减少动态效果」（Windows 关掉了「动画效果」、macOS 开了「减弱动态效果」）时，浏览器会报
 * prefers-reduced-motion，站里的聚合动效、背景光晕、换色过渡都会静止；这里允许在设置里强制开启或关闭。
 *   - 首帧由 index.html / src/pages/player/index.html 的 head 脚本把 data-motion 打到 <html> 上，css 据此放行或停掉动画
 *   - 脚本里的判断统一走 LeLeMotion.reduced()；改了偏好会派发 leletv:motionchange
 */

export type MotionPref = 'auto' | 'on' | 'off';

export interface MotionApi {
  reduced: () => boolean;
  pref: () => MotionPref;
  set: (p: MotionPref) => void;
}

const KEY = 'leletv_motion';

export function getMotionPref(): MotionPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch (e) { return 'auto'; }
}

function systemReduced(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/** 现在该不该静止：强制开启 → 否；强制关闭 → 是；其余跟系统 */
export function prefersReducedMotion(): boolean {
  const p = getMotionPref();
  if (p === 'on') return false;
  if (p === 'off') return true;
  return systemReduced();
}

function apply(p: MotionPref): void {
  const d = document.documentElement;
  if (p === 'on' || p === 'off') d.setAttribute('data-motion', p);
  else d.removeAttribute('data-motion');
}

function syncControl(): void {
  const box = document.querySelector('[data-role="motion-pref"]');
  if (!box) return;
  const p = getMotionPref();
  Array.prototype.forEach.call(box.querySelectorAll<HTMLElement>('[data-motion]'), function (btn: HTMLElement) {
    const on = btn.getAttribute('data-motion') === p;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-checked', String(on));
  });
  const note = box.querySelector('[data-role="motion-note"]');
  if (note) {
    note.textContent = systemReduced()
      ? '系统当前开着「减少动态效果」' + (p === 'on' ? '，已强制开启。' : (p === 'auto' ? '，动效已静止。' : '。'))
      : '';
  }
}

export function setMotionPref(p: MotionPref): void {
  try {
    if (p === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch (e) { /* 忽略 */ }
  apply(p);
  syncControl();
  try {
    window.dispatchEvent(new CustomEvent('leletv:motionchange', { detail: { pref: p, reduced: prefersReducedMotion() } }));
  } catch (e) { /* 忽略 */ }
}

export function initMotionPref(): void {
  apply(getMotionPref());
  syncControl();
  document.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;
    const btn = target.closest ? target.closest('[data-role="motion-pref"] [data-motion]') as HTMLElement | null : null;
    if (!btn) return;
    setMotionPref(btn.getAttribute('data-motion') as MotionPref);
  });
  try {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function () {
      syncControl();
      window.dispatchEvent(new CustomEvent('leletv:motionchange', { detail: { pref: getMotionPref(), reduced: prefersReducedMotion() } }));
    });
  } catch (e) { /* 旧浏览器没有 addEventListener，忽略 */ }
}

export const LeLeMotion: MotionApi = {
  reduced: prefersReducedMotion,
  pref: getMotionPref,
  set: setMotionPref,
};

interface MotionWindow extends Window {
  LeLeMotion?: MotionApi;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMotionPref);
else initMotionPref();

// HTML 内联脚本与跨层模块仍按全局名访问（设置页 / 首页动效 / 主题换色）
(window as MotionWindow).LeLeMotion = LeLeMotion;
