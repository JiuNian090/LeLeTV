/**
 * LeLeTV 播放器会话/进度（阶段 5B-2b）
 *
 * 从 index.ts 下沉，作为 player 内部的叶子模块。
 * 后续（5B-2e）再迁入 saveToHistory / saveCurrentProgress / updateMediaSession。
 */

import { currentEpisodeIndex, currentVideoTitle, currentVideoUrl } from './state';

/** 获取视频唯一标识：优先使用当前视频 URL，否则退回标题 + 集数 */
export function getVideoId(): string {
    if (currentVideoUrl) {
        return `${encodeURIComponent(currentVideoUrl)}`;
    }
    return `${encodeURIComponent(currentVideoTitle)}_${currentEpisodeIndex}`;
}

/** 清除当前视频的播放进度记录 */
export function clearVideoProgress(): void {
    const progressKey = `videoProgress_${getVideoId()}`;
    try {
        localStorage.removeItem(progressKey);
    } catch (e) {
        console.warn('[LeLeTV] 清除视频进度记录失败:', e);
    }
}

// 阶段 5B-3 过渡期类型桥：尚未改为 import 的 player 模块仍以裸名访问。
declare global {
    function getVideoId(): string;
    function clearVideoProgress(): void;
}
