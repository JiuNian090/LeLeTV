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
import { getTmdbWorkerUrl } from './services/api/api-config';

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

  // TMDB 数据获取
  if (videoTitle && videoTitle !== 'Loading...') {
    fetchTmdbPlayerDetail(videoTitle);
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

// ==================== TMDB 信息获取 ====================

const PLAYER_TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TmdbSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
}

interface TmdbGenre {
  name: string;
}

interface TmdbProductionCountry {
  name: string;
}

interface TmdbDetail {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genres?: TmdbGenre[];
  production_countries?: TmdbProductionCountry[];
}

interface TmdbCrewMember {
  job: string;
  name: string;
}

interface TmdbCastMember {
  name: string;
}

interface TmdbCredits {
  crew?: TmdbCrewMember[];
  cast?: TmdbCastMember[];
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

interface PlayerDetailInfo {
  title: string;
  cover: string;
  desc: string;
  type: string;
  year: string;
  area: string;
  director: string;
  actor: string;
  fromTmdb: boolean;
}

async function fetchTmdbPlayerDetail(title: string): Promise<void> {
  try {
    const baseUrl = getTmdbWorkerUrl();
    if (!baseUrl) return;

    const multiUrl = `${baseUrl}?endpoint=search/multi&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
    const res = await fetch(multiUrl);
    if (!res.ok) return;

    const data: TmdbSearchResponse = await res.json();
    if (!data.results || data.results.length === 0) return;

    const result = data.results.find((r) => r.media_type === 'movie' || r.media_type === 'tv');
    if (!result) return;

    const mediaType = result.media_type;
    const id = result.id;

    const [detailRes, creditsRes] = await Promise.all([
      fetch(`${baseUrl}?endpoint=${mediaType}/${id}&language=zh-CN`),
      fetch(`${baseUrl}?endpoint=${mediaType}/${id}/credits&language=zh-CN`),
    ]);

    if (!detailRes.ok) return;

    const [detail, credits]: [TmdbDetail, TmdbCredits] = await Promise.all([
      detailRes.json(),
      creditsRes.ok ? creditsRes.json() : Promise.resolve({ crew: [], cast: [] }),
    ]);

    const isMovie = mediaType === 'movie';
    const director = credits.crew?.find((c) => c.job === 'Director')?.name || '';
    const actors = credits.cast?.slice(0, 5).map((c) => c.name).join(' / ') || '';
    const genres = detail.genres?.map((g) => g.name).join(' / ') || '';
    const countries = detail.production_countries?.map((c) => c.name).join(' / ') || '';
    const year = isMovie
      ? (detail.release_date?.split('-')[0] || '')
      : (detail.first_air_date?.split('-')[0] || '');
    const posterPath = detail.poster_path
      ? `${PLAYER_TMDB_IMAGE_BASE}/w342${detail.poster_path}`
      : '';

    const tmdbInfo: PlayerDetailInfo = {
      title: isMovie ? (detail.title ?? '') : (detail.name ?? ''),
      cover: posterPath,
      desc: detail.overview || '',
      type: genres,
      year: year,
      area: countries,
      director: director,
      actor: actors,
      fromTmdb: true,
    };

    renderPlayerDetailInfo(tmdbInfo);
  } catch (e) {
    console.warn('获取TMDB详情失败:', e);
  }
}

function renderPlayerDetailInfo(info: PlayerDetailInfo): void {
  // 更新封面
  const coverImg = document.getElementById('tmdbCover') as HTMLImageElement | null;
  if (coverImg && info.cover) {
    coverImg.src = info.cover;
    coverImg.style.display = 'block';
  }

  // 更新详情信息
  const detailContainer = document.getElementById('playerDetailInfo');
  if (!detailContainer) return;

  let html = '';
  if (info.desc) html += `<p class="text-sm text-gray-300 leading-relaxed mb-2">${info.desc}</p>`;
  if (info.type || info.year || info.area) {
    html += '<div class="flex flex-wrap gap-1.5 mb-2">';
    if (info.type) html += `<span class="px-2 py-0.5 bg-pink-500/10 text-pink-400 text-xs rounded">${info.type}</span>`;
    if (info.year) html += `<span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">${info.year}</span>`;
    if (info.area) html += `<span class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded">${info.area}</span>`;
    html += '</div>';
  }
  if (info.director) html += `<div class="text-xs text-gray-400 mb-1"><span class="text-gray-500">导演：</span>${info.director}</div>`;
  if (info.actor) html += `<div class="text-xs text-gray-400 detail-meta-collapsible"><span class="text-gray-500">主演：</span>${info.actor}</div>`;

  detailContainer.innerHTML = html;
}

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

function bootPlayer(): void {
  initPlayerPage();
  setupEventDelegation();
}

function setupEventDelegation(): void {
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
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPlayer);
  } else {
    bootPlayer();
  }
}
