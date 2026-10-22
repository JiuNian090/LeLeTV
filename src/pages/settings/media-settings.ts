/**
 * 设置页 — 元数据源（豆瓣 / TMDB + 自动降级）
 *
 * 页面片段按需插入，初始化由 src/main.ts 的 initSettingsPage() 在片段插入后调用；
 * 同时把入口挂到 window，避免设置页 bundle 与首屏 bundle 的加载顺序耦合。
 */

import { loadMediaSettings, resetMediaFailover, saveMediaSettings } from '../../services/media';
import { TMDB_STATE } from '../../services/tmdb';
import { showToast } from '../../ui/toast';

interface MediaSettingsWindow extends Window {
  __LELETV_INIT_MEDIA_SETTINGS__?: () => void;
}

let bound = false;

function syncUI(): void {
  const settings = loadMediaSettings();

  document.querySelectorAll<HTMLButtonElement>('[data-media-source]').forEach(button => {
    const active = button.dataset.mediaSource === settings.primarySource;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
  });

  const toggle = document.getElementById('mediaAutoFailoverToggle') as HTMLInputElement | null;
  if (toggle) toggle.checked = settings.autoFailover;
}

/** 主源变了：让分类页下次进入时重新拉取，而不是复用旧列表 */
function invalidateCategory(): void {
  TMDB_STATE.isLoaded = false;
}

function bindOnce(): void {
  if (bound) return;
  bound = true;

  const segment = document.getElementById('mediaSourceSeg');
  if (segment) {
    segment.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-media-source]');
      if (!target) return;
      const source = target.dataset.mediaSource;
      if (source !== 'douban' && source !== 'tmdb') return;

      saveMediaSettings({ primarySource: source });
      resetMediaFailover();
      invalidateCategory();
      syncUI();
      showToast(source === 'douban' ? '已切换到豆瓣主源' : '已切换到 TMDB 主源', 'success');
    });
  }

  const toggle = document.getElementById('mediaAutoFailoverToggle') as HTMLInputElement | null;
  if (toggle) {
    toggle.addEventListener('change', () => {
      saveMediaSettings({ autoFailover: toggle.checked });
      resetMediaFailover();
      invalidateCategory();
      syncUI();
      showToast(toggle.checked ? '已开启自动降级' : '已关闭自动降级', 'success');
    });
  }
}

export function initMediaSettingsPage(): void {
  // 片段还没插入：路由会在插入后再次调用
  if (!document.getElementById('mediaSourceSeg')) return;
  syncUI();
  bindOnce();
}

(window as MediaSettingsWindow).__LELETV_INIT_MEDIA_SETTINGS__ = initMediaSettingsPage;
