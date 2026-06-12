/**
 * 观看历史服务 + UI 渲染
 */

import { formatTimestamp, formatPlaybackTime } from '../ui/components/toast';

// ==================== 数据操作 ====================

export function getViewingHistory(): any[] {
  try {
    const data = localStorage.getItem('viewingHistory');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('获取观看历史失败:', e);
    return [];
  }
}

export function addViewingHistory(videoInfo: any): void {
  if (!videoInfo?.title) return;
  try {
    const history = getViewingHistory();
    const existingIdx = history.findIndex((h: any) => h.title === videoInfo.title);
    if (existingIdx >= 0) history.splice(existingIdx, 1);
    history.unshift({
      title: videoInfo.title,
      episodeIndex: videoInfo.episodeIndex || 0,
      timestamp: Date.now(),
      cover: videoInfo.cover || '',
      sourceName: videoInfo.sourceName || '',
      showIdentifier: videoInfo.showIdentifier || '',
      vod_id: videoInfo.vod_id || '',
    });
    if (history.length > 200) history.length = 200;
    localStorage.setItem('viewingHistory', JSON.stringify(history));
  } catch {
    /* 静默 */
  }
}

export function deleteHistoryItem(index: number): void {
  try {
    const history = getViewingHistory();
    if (index >= 0 && index < history.length) {
      history.splice(index, 1);
      localStorage.setItem('viewingHistory', JSON.stringify(history));
    }
  } catch {
    /* 静默 */
  }
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem('viewingHistory');
  } catch {
    /* 静默 */
  }
}

// ==================== UI 渲染 ====================

export function loadViewingHistory(): void {
  const container = document.getElementById('historyList');
  if (!container) return;

  const history = getViewingHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state text-center py-16">
        <div class="empty-icon mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <p class="text-gray-400 text-lg mb-2">暂无观看记录</p>
        <p class="text-gray-600 text-sm mb-6">去分类发现更多精彩内容</p>
        <button data-action="switch-to-category" class="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-full text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg">
          去分类浏览
        </button>
      </div>
    `;
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgoStart = new Date(todayStart);
  weekAgoStart.setDate(weekAgoStart.getDate() - 7);

  // 按时间分组
  const groups: Record<string, any[]> = { '今天': [], '昨天': [], '本周': [], '更早': [] };
  history.forEach((item: any) => {
    const itemDate = new Date(item.timestamp);
    const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    if (itemDay >= todayStart) groups['今天'].push(item);
    else if (itemDay >= yesterdayStart) groups['昨天'].push(item);
    else if (itemDay >= weekAgoStart) groups['本周'].push(item);
    else groups['更早'].push(item);
  });

  // 渲染
  let html = '';
  html += `<div class="flex justify-between items-center mb-4 px-1">
    <h2 class="text-lg font-semibold text-white">观看历史</h2>
    <button data-action="clear-history" class="text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)]">清空全部</button>
  </div>`;

  Object.entries(groups).forEach(([groupName, items]) => {
    if (items.length === 0) return;
    html += `<div class="mb-4"><h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">${groupName}</h3>`;
    items.forEach((item: any, idx: number) => {
      const globalIdx = history.indexOf(item);
      const coverSrc =
        item.cover && item.cover !== 'none'
          ? item.cover
          : 'image/nomedia.png';
      const url = `/player.html?title=${encodeURIComponent(item.title)}&source=${encodeURIComponent(item.sourceName || '')}`;

      html += `
        <div class="history-item flex items-center p-3 mb-1 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors group cursor-pointer" data-action="play-from-history" data-index="${globalIdx}">
          <div class="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[#1a1a1a] mr-3">
            <img src="${coverSrc}" alt="${item.title}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='image/nomedia.png'">
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-200 truncate">${item.title}</div>
            <div class="flex items-center mt-1 space-x-2 text-xs text-gray-500">
              <span>${item.sourceName || ''}</span>
              <span>·</span>
              <span>第 ${(item.episodeIndex || 0) + 1} 集</span>
            </div>
            <div class="text-xs text-gray-600 mt-0.5">${formatTimestamp(item.timestamp)}</div>
          </div>
          <button class="delete-history-btn text-gray-600 hover:text-red-400 transition-colors p-2 opacity-0 group-hover:opacity-100" data-action="delete-history-item" data-index="${globalIdx}" title="删除">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `;
    });
    html += '</div>';
  });

  container.innerHTML = html;
}

export function playFromHistory(index: number): void {
  const history = getViewingHistory();
  if (index < 0 || index >= history.length) return;
  const item = history[index];

  const params = new URLSearchParams();
  if (item.title) params.set('title', item.title);
  if (item.sourceName) params.set('source', item.sourceName);
  if (item.showIdentifier) params.set('id', item.showIdentifier);
  if (item.vod_id) params.set('vod_id', item.vod_id);
  if (item.episodeIndex !== undefined) params.set('index', String(item.episodeIndex));

  window.location.href = `/player.html?${params.toString()}`;
}
