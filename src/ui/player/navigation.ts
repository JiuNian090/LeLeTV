/**
 * LeLeTV 播放器返回导航（阶段 5B-2d）
 *
 * 从 index.ts 下沉。ui.ts 调用 goHome，index.ts 也调用；放到叶子模块后
 * index <-> ui 不再因为 goHome 形成环。
 */

import { art, setAutoFullscreened } from './state';

let returningFromPlayer = false; // 防止快速连点触发多次返回导航

/** 返回键：全屏时退出全屏，否则返回来源页 */
export function goHome(event?: Event): void {
    if (returningFromPlayer) return;
    if (event) event.preventDefault();

    if (art && art.fullscreen) {
        art.fullscreen = false;
        setAutoFullscreened(false);
        return;
    }

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        setAutoFullscreened(false);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const backUrl = urlParams.get('back');

    // 读取并清除哨兵：判断本页是否由站内同标签页导航进入。
    // 播放页内的切集/切源均用 replaceState / location.replace，不新增历史条目，
    // 因此历史栈紧邻条目必为来源页，history.back() 一步即可返回并命中 bfcache 秒回
    let fromSameTab = false;
    try {
        fromSameTab = sessionStorage.getItem('leletv_player_from_tab') === '1';
        sessionStorage.removeItem('leletv_player_from_tab');
    } catch (e) { /* 忽略 sessionStorage 不可用 */ }

    if (backUrl) {
        localStorage.removeItem('lastSearchPage');
        // returnTo 标记表示本次返回需要跳过中间页（类别页发起的搜索要跳过结果页）。
        // 这种情况下 history.back() 只会回到中间页，必须直接 replace 到目标地址。
        const skipIntermediate = backUrl.indexOf('returnTo=') !== -1;
        if (fromSameTab && !skipIntermediate) {
            window.history.back();
        } else {
            // 直接输入 URL / 新标签页打开，或需要跳过中间页：直接跳转精确来源地址
            window.location.replace(backUrl);
        }
    } else {
        window.location.href = '/index.html';
    }

    returningFromPlayer = true;

    // 兜底定时器：返回导航提交（页面卸载/冻结）时 pagehide 触发并取消，避免双导航竞态
    const fallbackTimer = setTimeout(() => {
        if (document.getElementById('playerContainer')) {
            window.location.replace(backUrl || '/index.html');
        }
    }, 1500);
    const homeTimer = setTimeout(() => {
        if (document.getElementById('playerContainer')) {
            window.location.href = '/index.html';
        }
    }, TIMING.FALLBACK_NAVIGATION_DELAY);
    window.addEventListener('pagehide', function onPageHide() {
        clearTimeout(fallbackTimer);
        clearTimeout(homeTimer);
        window.removeEventListener('pagehide', onPageHide);
    });
}

Object.assign(window, { goHome });

// 阶段 5B-2 过渡期类型桥：尚未改为 import 的 player 模块仍以裸名访问。
declare global {
    function goHome(event?: Event): void;
}
