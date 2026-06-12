/**
 * LeLeTV 播放页入口
 */

import { initAurora } from './effects/aurora-bg';
import {
  initPlayer,
} from './services/player/player-core';
import {
  art,
  setCurrentVideoTitle,
  setCurrentEpisodes,
  setCurrentEpisodeIndex,
  setCurrentVideoUrl,
  episodesReversed,
  setAutoFullscreened,
  syncToWindow,
} from './services/player/player-state';
import { TIMING } from './core/timing';

// ==================== 全局向后兼容 ====================

// 初始化页面
function initPlayerPage(): void {
  // 极光背景
  initAurora({
    selector: '#auroraContainer',
    colorStops: ['#3A29FF', '#ec4899', '#FFD700'],
    amplitude: 0.5,
    blend: 0.8,
    speed: 0.5,
  });

  // 从 URL 参数读取视频信息
  const params = new URLSearchParams(window.location.search);
  const videoUrl = params.get('url') || '';
  const videoTitle = params.get('title') || 'Loading...';
  const episodesRaw = localStorage.getItem('tempEpisodes');
  const episodeIndex = parseInt(params.get('index') || '0');

  // 设置状态
  setCurrentVideoTitle(videoTitle);
  setCurrentVideoUrl(videoUrl);
  setCurrentEpisodeIndex(episodeIndex);
  if (episodesRaw) {
    try {
      setCurrentEpisodes(JSON.parse(episodesRaw));
    } catch {
      setCurrentEpisodes([videoUrl]);
    }
  } else {
    setCurrentEpisodes([videoUrl]);
  }

  // 恢复倒序设置
  const rev = localStorage.getItem('episodesReversed');
  if (rev === 'true') {
    import('./services/player/player-state').then((s) => s.setEpisodesReversed(true));
  }

  // 同步到 window
  syncToWindow();

  // 初始化播放器
  if (videoUrl) {
    initPlayer(videoUrl);
  }

  // 注册邮箱点击处理
  setupEmailClickHandlers();
}

// 返回首页
(window as any).goHome = function goHome(event?: Event): void {
  event?.preventDefault();
  if (art?.fullscreen) {
    art.fullscreen = false;
    setAutoFullscreened(false);
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    setAutoFullscreened(false);
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const backUrl = params.get('back');
  if (backUrl) {
    localStorage.removeItem('lastSearchPage');
    window.location.href = backUrl;
  } else {
    window.history.back();
  }
  setTimeout(() => {
    if (document.getElementById('playerContainer')) {
      window.location.href = '/index.html';
    }
  }, TIMING.FALLBACK_NAVIGATION_DELAY);
};

// 邮箱点击处理器（向后兼容）
function setupEmailClickHandlers(): void {
  document.querySelectorAll('.contact-link').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const provider = 'gmail.com';
      const address = `jiunian090${String.fromCharCode(64)}${provider}`;
      window.location.href = `mailto:${address}`;
    });
  });
}

// 页面加载
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  const sourceCode = params.get('source');
  if (videoId && sourceCode) {
    localStorage.setItem('currentPlayingId', videoId);
    localStorage.setItem('currentPlayingSource', sourceCode);
  }
});

// bfcache 恢复处理
window.addEventListener('pageshow', (event: PageTransitionEvent) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// ==================== DOM 就绪初始化 ====================

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initPlayerPage();

    // data-action 事件委托
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
      if (!target) return;
      const action = target.dataset.action;
      if (!action) return;

      switch (action) {
        case 'go-home':
          (window as any).goHome(e);
          break;
        case 'close-modal': {
          const modal = document.getElementById('modal');
          if (modal) modal.style.display = 'none';
          break;
        }
        case 'toggle-episodes': {
          const section = document.getElementById('episodeSection');
          if (section) section.classList.toggle('collapsed');
          break;
        }
        case 'toggle-detail': {
          const section = document.getElementById('detailDescSection');
          if (section) section.classList.toggle('collapsed');
          break;
        }
        case 'toggle-episode-order': {
          import('./services/player/player-episodes').then((m) => m.toggleEpisodeOrder());
          break;
        }
        case 'play-episode': {
          const idx = parseInt(target.dataset.index || '-1');
          import('./services/player/player-episodes').then((m) => m.playEpisode(idx));
          break;
        }
        case 'prev-episode': {
          import('./services/player/player-episodes').then((m) => m.playPreviousEpisode());
          break;
        }
        case 'next-episode': {
          import('./services/player/player-episodes').then((m) => m.playNextEpisode());
          break;
        }
        case 'copy-links': {
          const url = new URLSearchParams(window.location.search).get('url') || '';
          if (url) {
            navigator.clipboard.writeText(url).then(() => {
              if (typeof (window as any).showToast === 'function') {
                (window as any).showToast('播放链接已复制', 'success');
              }
            });
          }
          break;
        }
      }
    });
  });
}
