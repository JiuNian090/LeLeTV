/**
 * 安装到桌面（PWA）提示
 *   - 浏览器给出安装事件（beforeinstallprompt，只在 HTTPS 或 localhost 下、且未安装时触发）→ 首页底部出一条「安装到桌面」，
 *     点安装弹系统安装框；关于页的「安装到桌面」按钮同样可用
 *   - iOS Safari 没有安装事件：手机上给一条「分享 → 添加到主屏幕」的指引；安卓 Chrome 在 http 局域网地址下也拿不到
 *     安装事件，同样给「菜单 → 添加到主屏幕」的指引
 *   - 已经以独立窗口运行（装过了）就什么都不显示；点「以后再说」两周内不再出现
 */
(function () {
  'use strict';

  var DISMISS_KEY = 'leletv_pwa_tip_dismissed';
  var SNOOZE_MS = 14 * 24 * 3600 * 1000;
  var SHOW_DELAY_MS = 3000;
  var deferredPrompt = null;
  var timer = 0;

  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    } catch (e) { return false; }
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function isMobile() {
    try { return window.matchMedia('(max-width: 720px)').matches && navigator.maxTouchPoints > 0; } catch (e) { return false; }
  }

  function dismissed() {
    try {
      var at = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return at > 0 && Date.now() - at < SNOOZE_MS;
    } catch (e) { return false; }
  }

  function setDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
  }

  /** 手动安装的说明：按平台给不同的步骤 */
  function guideText() {
    if (isIOS()) return { title: '添加到主屏幕', steps: ['在 Safari 里点底部的「分享」按钮', '选「添加到主屏幕」，再点右上角「添加」'] };
    if (/Android/i.test(navigator.userAgent || '')) return { title: '添加到主屏幕', steps: ['在 Chrome 里点右上角「⋮」菜单', '选「添加到主屏幕」或「安装应用」'] };
    return { title: '安装到桌面', steps: ['在 Chrome 或 Edge 的地址栏右端点「安装」图标', '或打开浏览器菜单，选「安装 LeLeTV」'] };
  }

  function banner() { return document.getElementById('pwaBanner'); }

  function showBanner(mode) {
    var el = banner();
    if (!el) return;
    var title = el.querySelector('[data-role="title"]');
    var sub = el.querySelector('[data-role="sub"]');
    var install = el.querySelector('[data-action="pwa-install"]');
    if (mode === 'prompt') {
      title.textContent = '安装 LeLeTV 到桌面';
      sub.textContent = '独立窗口全屏运行，像原生应用一样打开';
      install.textContent = '安装';
    } else {
      var g = guideText();
      title.textContent = g.title;
      sub.textContent = g.steps.join('，');
      install.textContent = '查看步骤';
    }
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
  }

  function hideBanner() {
    var el = banner();
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(function () { el.hidden = true; }, 260);
  }

  function openGuide() {
    var modal = document.getElementById('pwaGuideModal');
    if (!modal) return;
    var g = guideText();
    modal.querySelector('[data-role="title"]').textContent = g.title;
    var list = modal.querySelector('[data-role="steps"]');
    list.textContent = '';
    g.steps.forEach(function (step) {
      var li = document.createElement('li');
      li.textContent = step;
      list.appendChild(li);
    });
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function closeGuide() {
    var modal = document.getElementById('pwaGuideModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }

  /** 点「安装」：有系统安装事件就弹系统框，否则给手动步骤 */
  function install() {
    if (deferredPrompt) {
      var evt = deferredPrompt;
      deferredPrompt = null;
      hideBanner();
      evt.prompt();
      if (evt.userChoice) {
        evt.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') return;
          // 用户在系统框里取消：下次刷新还能再来
          setDismissed();
        }).catch(function () { /* 忽略 */ });
      }
      return;
    }
    hideBanner();
    openGuide();
  }

  function dismiss() {
    setDismissed();
    hideBanner();
  }

  /** 首页停留几秒后再出提示；桌面只在拿到安装事件时出，手机没有事件也给指引 */
  function scheduleBanner() {
    clearTimeout(timer);
    if (isStandalone() || dismissed()) return;
    timer = setTimeout(function () {
      if (isStandalone() || dismissed()) return;
      if (deferredPrompt) showBanner('prompt');
      else if (isMobile()) showBanner('guide');
    }, SHOW_DELAY_MS);
  }

  function init() {
    if (isStandalone()) {
      document.documentElement.setAttribute('data-standalone', '1');
      return;
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      document.documentElement.setAttribute('data-installable', '1');
      scheduleBanner();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      hideBanner();
      document.documentElement.removeAttribute('data-installable');
      document.documentElement.setAttribute('data-standalone', '1');
      if (typeof showToast === 'function') showToast('已安装到桌面', 'success');
    });
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!el) return;
      switch (el.dataset.action) {
        case 'pwa-install': install(); break;
        case 'pwa-dismiss': dismiss(); break;
        case 'pwa-guide-close': closeGuide(); break;
      }
    });
    var modal = document.getElementById('pwaGuideModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeGuide(); });
    scheduleBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 调试与测试用：可查询当前状态
  window.LeLePwa = { isStandalone: isStandalone, hasPrompt: function () { return !!deferredPrompt; } };
})();
