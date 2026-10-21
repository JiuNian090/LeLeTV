/**
 * 导航栏的迷你搜索入口
 *   - 桌面：点图标在导航栏里向左展开一条输入框，回车或再点图标检索；走首页同一个 search()，
 *     所以搜索历史、结果页、地址栏 /s= 都和首页搜索一致。空着再点、按 Esc、点到别处都收起
 *   - 手机（≤720px）：导航项在底部标签栏，这个入口固定在顶栏右侧，点开的是现成的手机搜索层
 */

import { openMobileSearch } from '../../services/config';

(function () {
  'use strict';

  const MOBILE_QUERY = '(max-width: 720px)';

  function isMobile(): boolean {
    try { return window.matchMedia(MOBILE_QUERY).matches; } catch (e) { return false; }
  }

  function init(): void {
    const form = document.getElementById('navSearch');
    if (!form) return;
    const input = form.querySelector('.nav-search-input') as HTMLInputElement | null;
    const btn = form.querySelector('.nav-search-btn') as HTMLElement | null;
    if (!input || !btn) return;

    // 收窄结果存到非空别名：下面的函数声明会被提升，TS 不会保留外层 const 的窄化
    const formEl = form;
    const inputEl = input;
    const btnEl = btn;

    const isOpen = (): boolean => formEl.classList.contains('is-open');

    function open(): void {
      formEl.classList.add('is-open');
      btnEl.setAttribute('aria-expanded', 'true');
      inputEl.tabIndex = 0;
      // 宽度动画起步后再聚焦，聚焦时不让浏览器把它滚进视口
      requestAnimationFrame(() => inputEl.focus({ preventScroll: true }));
    }

    function close(): void {
      formEl.classList.remove('is-open');
      btnEl.setAttribute('aria-expanded', 'false');
      inputEl.tabIndex = -1;
      inputEl.value = '';
    }

    function submit(): void {
      const query = inputEl.value.trim();
      if (!query) { close(); return; }
      const home = document.getElementById('searchInput') as HTMLInputElement | null;
      if (home) home.value = query;
      close();
      // search() 属于结果页（pages/search），导航栏不能跨页 import：保留 window 契约
      const search = (window as Window & { search?: () => void }).search;
      if (typeof search === 'function') search();
    }

    btnEl.addEventListener('click', () => {
      if (isMobile()) {
        openMobileSearch();
        return;
      }
      if (isOpen()) submit(); else open();
    });
    formEl.addEventListener('submit', event => {
      event.preventDefault();
      submit();
    });
    inputEl.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close();
        btnEl.focus();
      }
    });
    // 点到别处就收起
    document.addEventListener('pointerdown', event => {
      if (isOpen() && !formEl.contains(event.target as Node)) close();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
