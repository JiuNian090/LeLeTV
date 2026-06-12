/**
 * 播放器桥接模块
 * 构建 API 参数并获取视频详情
 */

import { PlayerManager } from './player-manager';
import {
  currentVideoTitle,
  setCurrentVideoTitle,
  setCurrentEpisodes,
  setCurrentEpisodeIndex,
  setCurrentVideoUrl,
} from './player-state';

// ==================== 类型定义 ====================

interface BridgeResult {
  data?: any;
  error?: string;
}

interface CustomApiInfo {
  name: string;
  url: string;
  detail?: string;
  isHidden?: boolean;
}

// ==================== 工具函数 ====================

function getCustomApiInfo(index: string): CustomApiInfo | null {
  try {
    const apis: CustomApiInfo[] = JSON.parse(localStorage.getItem('customAPIs') || '[]');
    return apis[Number(index)] || null;
  } catch {
    return null;
  }
}

// ==================== 构建 API 参数并获取详情 ====================

export async function buildApiParamsAndFetch(
  id: string,
  sourceCode: string
): Promise<BridgeResult> {
  let apiParams = '';

  if (sourceCode.startsWith('custom_')) {
    const customIndex = sourceCode.replace('custom_', '');
    const customApi = getCustomApiInfo(customIndex);
    if (!customApi) return { error: '自定义API配置无效' };

    if (customApi.detail) {
      apiParams = `&customApi=${encodeURIComponent(customApi.url)}&customDetail=${encodeURIComponent(customApi.detail)}&source=custom`;
    } else {
      apiParams = `&customApi=${encodeURIComponent(customApi.url)}&source=custom`;
    }
  } else {
    apiParams = `&source=${sourceCode}`;
  }

  const cacheBuster = `&_t=${Date.now()}`;

  try {
    const response = await fetch(
      `/api/detail?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`
    );
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: '网络请求失败，请稍后重试' };
  }
}

// ==================== 直接播放 ====================

export function showToast(message: string, type: string = 'error'): void {
  if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type);
  }
}

export function showLoading(): void {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'flex';
}

export function hideLoading(): void {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}

export function showPasswordModal(): void {
  if (typeof (window as any).showPasswordModal === 'function') {
    (window as any).showPasswordModal();
  }
}

/**
 * 点击搜索结果直接跳转播放器
 */
export async function playDirectly(
  id: string,
  vod_name: string,
  sourceCode: string
): Promise<void> {
  // 密码检查
  if (
    typeof (window as any).isPasswordProtected === 'function' &&
    typeof (window as any).isPasswordVerified === 'function'
  ) {
    if ((window as any).isPasswordProtected() && !(window as any).isPasswordVerified()) {
      showPasswordModal();
      return;
    }
  }

  if (!id) {
    showToast('视频ID无效', 'error');
    return;
  }

  showLoading();
  try {
    const result = await buildApiParamsAndFetch(id, sourceCode);
    if (result.error) {
      showToast(result.error, 'error');
      hideLoading();
      return;
    }

    const data = result.data;
    if (!data.episodes || data.episodes.length === 0) {
      showToast('没有可用的视频资源', 'error');
      hideLoading();
      return;
    }

    setCurrentEpisodes(data.episodes);
    setCurrentVideoTitle(vod_name || '未知视频');

    let episodeIndex = 0;
    try {
      const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
      const item = history.find(
        (h: any) => h.title === currentVideoTitle
      );
      if (item && item.episodeIndex >= 0 && item.episodeIndex < data.episodes.length) {
        episodeIndex = item.episodeIndex;
      }
    } catch {
      /* 静默 */
    }

    setCurrentEpisodeIndex(episodeIndex);

    const episodeUrl = data.episodes[episodeIndex];
    setCurrentVideoUrl(episodeUrl);

    // 保存到 localStorage
    try {
      localStorage.setItem('currentVideoTitle', currentVideoTitle);
      localStorage.setItem('currentEpisodes', JSON.stringify(data.episodes));
      localStorage.setItem('currentEpisodeIndex', String(episodeIndex));
      localStorage.setItem('currentSourceCode', sourceCode || '');
      localStorage.setItem('lastPlayTime', String(Date.now()));
      localStorage.setItem('lastSearchPage', window.location.href);
      if (data.videoInfo) {
        localStorage.setItem('currentVideoInfo', JSON.stringify(data.videoInfo));
      }
    } catch {
      /* 静默 */
    }

    // 构建播放页 URL
    const playerUrl = `/player.html?id=${encodeURIComponent(id)}&url=${encodeURIComponent(episodeUrl)}&index=${episodeIndex}&source=${encodeURIComponent(sourceCode)}&title=${encodeURIComponent(currentVideoTitle)}`;

    hideLoading();

    // 传入完整 episodes 数组和 videoInfo
    localStorage.setItem('tempEpisodes', JSON.stringify(data.episodes));
    if (data.videoInfo) {
      localStorage.setItem('tempVideoInfo', JSON.stringify(data.videoInfo));
    }

    window.location.href = playerUrl;
  } catch (error) {
    hideLoading();
    showToast('播放失败: ' + ((error as Error).message || '未知错误'), 'error');
  }
}


