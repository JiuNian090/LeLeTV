/**
 * 导航栏的迷你搜索入口
 *   - 桌面：点图标在导航栏里向左展开一条输入框，回车或再点图标检索；走首页同一个 search()，
 *     所以搜索历史、结果页、地址栏 /s= 都和首页搜索一致。空着再点、按 Esc、点到别处都收起
 *   - 手机（≤720px）：导航项在底部标签栏，这个入口固定在顶栏右侧，点开的是现成的手机搜索层
 */
(function () {
  'use strict';

  const MOBILE_QUERY = '(max-width: 720px)';

  function isMobile() {
    try { return window.matchMedia(MOBILE_QUERY).matches; } catch (e) { return false; }
  }

  function init() {
    const form = document.getElementById('navSearch');
    if (!form) return;
    const input = form.querySelector('.nav-search-input');
    const btn = form.querySelector('.nav-search-btn');
    if (!input || !btn) return;

    const isOpen = () => form.classList.contains('is-open');

    function open() {
      form.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      input.tabIndex = 0;
      // 宽度动画起步后再聚焦，聚焦时不让浏览器把它滚进视口
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    function close() {
      form.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      input.tabIndex = -1;
      input.value = '';
    }

    function submit() {
      const query = input.value.trim();
      if (!query) { close(); return; }
      const home = document.getElementById('searchInput');
      if (home) home.value = query;
      close();
      if (typeof search === 'function') search();
    }

    btn.addEventListener('click', () => {
      if (isMobile()) {
        if (typeof openMobileSearch === 'function') openMobileSearch();
        return;
      }
      if (isOpen()) submit(); else open();
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      submit();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close();
        btn.focus();
      }
    });
    // 点到别处就收起
    document.addEventListener('pointerdown', event => {
      if (isOpen() && !form.contains(event.target)) close();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
