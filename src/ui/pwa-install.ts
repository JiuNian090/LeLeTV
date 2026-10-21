/**
 * 安装到桌面（PWA）提示
 *   - 浏览器给出安装事件（beforeinstallprompt，只在 HTTPS 或 localhost 下、且未安装时触发）→ 首页底部出一条「安装到桌面」，
 *     点安装弹系统安装框；关于页的「安装到桌面」按钮同样可用
 *   - iOS Safari 没有安装事件：手机上给一条「分享 → 添加到主屏幕」的指引；安卓 Chrome 在 http 局域网地址下也拿不到
 *     安装事件，同样给「菜单 → 添加到主屏幕」的指引
 *   - 已经以独立窗口运行（装过了）就什么都不显示；点「以后再说」两周内不再出现
 */

/** 非标准事件：Chromium 系在可安装时派发 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice?: Promise<{ outcome: string }>;
}

interface PwaNavigator extends Navigator {
  /** iOS Safari 专有的独立窗口标记 */
  standalone?: boolean;
}

interface PwaWindow extends Window {
  LeLePwa?: {
    isStandalone: () => boolean;
    hasPrompt: () => boolean;
  };
}

declare function showToast(message: string, type?: string): void;

(function () {
  'use strict';

  var DISMISS_KEY = 'leletv_pwa_tip_dismissed';
  var SNOOZE_MS = 14 * 24 * 3600 * 1000;
  var SHOW_DELAY_MS = 3000;
  var deferredPrompt: BeforeInstallPromptEvent | null = null;
  var timer = 0;

  function isStandalone(): boolean {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as PwaNavigator).standalone === true;
    } catch (e) { return false; }
  }

  function isIOS(): boolean {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function isMobile(): boolean {
    try { return window.matchMedia('(max-width: 720px)').matches && navigator.maxTouchPoints > 0; } catch (e) { return false; }
  }

  function dismissed(): boolean {
    try {
      var at = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return at > 0 && Date.now() - at < SNOOZE_MS;
    } catch (e) { return false; }
  }

  function setDismissed(): void {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
  }

  /** 手动安装的说明：按平台给不同的步骤 */
  function guideText(): { title: string; steps: string[] } {
    if (isIOS()) return { title: '添加到主屏幕', steps: ['在 Safari 里点底部的「分享」按钮', '选「添加到主屏幕」，再点右上角「添加」'] };
    if (/Android/i.test(navigator.userAgent || '')) return { title: '添加到主屏幕', steps: ['在 Chrome 里点右上角「⋮」菜单', '选「添加到主屏幕」或「安装应用」'] };
    return { title: '安装到桌面', steps: ['在 Chrome 或 Edge 的地址栏右端点「安装」图标', '或打开浏览器菜单，选「安装 LeLeTV」'] };
  }

  function banner(): HTMLElement | null {
    return document.getElementById('pwaBanner');
  }

  function showBanner(mode: 'prompt' | 'guide'): void {
    var el = banner();
    if (!el) return;
    var title = el.querySelector('[data-role="title"]') as HTMLElement | null;
    var sub = el.querySelector('[data-role="sub"]') as HTMLElement | null;
    var install = el.querySelector('[data-action="pwa-install"]') as HTMLElement | null;
    if (mode === 'prompt') {
      if (title) title.textContent = '安装 LeLeTV 到桌面';
      if (sub) sub.textContent = '独立窗口全屏运行，像原生应用一样打开';
      if (install) install.textContent = '安装';
    } else {
      var g = guideText();
      if (title) title.textContent = g.title;
      if (sub) sub.textContent = g.steps.join('，');
      if (install) install.textContent = '查看步骤';
    }
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
  }

  function hideBanner(): void {
    var el = banner();
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(function () { el.hidden = true; }, 260);
  }

  function openGuide(): void {
    var modal = document.getElementById('pwaGuideModal');
    if (!modal) return;
    var g = guideText();
    var title = modal.querySelector('[data-role="title"]') as HTMLElement | null;
    if (title) title.textContent = g.title;
    var list = modal.querySelector('[data-role="steps"]') as HTMLElement | null;
    if (!list) return;
    list.textContent = '';
    g.steps.forEach(function (step) {
      var li = document.createElement('li');
      li.textContent = step;
      list.appendChild(li);
    });
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function closeGuide(): void {
    var modal = document.getElementById('pwaGuideModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }

  /** 点「安装」：有系统安装事件就弹系统框，否则给手动步骤 */
  function install(): void {
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

  function dismiss(): void {
    setDismissed();
    hideBanner();
  }

  /** 首页停留几秒后再出提示；桌面只在拿到安装事件时出，手机没有事件也给指引 */
  function scheduleBanner(): void {
    clearTimeout(timer);
    if (isStandalone() || dismissed()) return;
    timer = window.setTimeout(function () {
      if (isStandalone() || dismissed()) return;
      if (deferredPrompt) showBanner('prompt');
      else if (isMobile()) showBanner('guide');
    }, SHOW_DELAY_MS);
  }

  function init(): void {
    if (isStandalone()) {
      document.documentElement.setAttribute('data-standalone', '1');
      return;
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      var evt = e as BeforeInstallPromptEvent;
      evt.preventDefault();
      deferredPrompt = evt;
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
      var target = e.target as HTMLElement;
      var el = target.closest ? target.closest('[data-action]') as HTMLElement | null : null;
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
  (window as PwaWindow).LeLePwa = { isStandalone: isStandalone, hasPrompt: function () { return !!deferredPrompt; } };
})();
