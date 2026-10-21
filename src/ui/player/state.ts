/**
 * LeLeTV 播放器共享状态（阶段 5B-2）
 *
 * 原在 src/ui/player/index.ts 声明，被 core / episodes / ui / detail / shortcuts
 * 等模块直接读写。迁到这里后 state 成为叶子模块，player 内部不再经过 index.ts
 * 形成环。旧位置（index.ts）保留 window getter/setter 代理。
 *
 * 读方用 `import { art }`（ESM live binding）；写方用 `setArt(...)`。
 */

export interface PlayerArtInstance {
    on(event: string, handler: (...args: never[]) => void): void;
    controls: { show: boolean };
    fullscreen: boolean;
    currentTime: number;
    duration: number;
    video?: HTMLVideoElement;
    url?: string;
    play?: () => void;
    pause?: () => void;
    template?: { $player?: HTMLElement; $controlsLeft?: HTMLElement };
    isLock?: boolean;
    seek?: number;
}

// ==================== 播放器状态 ====================
export let currentVideoTitle = '';
export function setCurrentVideoTitle(v: string): void {
    currentVideoTitle = v;
}

export let currentEpisodeIndex = 0;
export function setCurrentEpisodeIndex(v: number): void {
    currentEpisodeIndex = v;
}

export let art: PlayerArtInstance | null = null;
export function setArt(v: PlayerArtInstance | null): void {
    art = v;
}

export let currentHls: unknown = null;
export function setCurrentHls(v: unknown): void {
    currentHls = v;
}

export let currentEpisodes: string[] = [];
export function setCurrentEpisodes(v: string[]): void {
    currentEpisodes = v;
}

export let episodesReversed = false;
export function setEpisodesReversed(v: boolean): void {
    episodesReversed = v;
}

export let autoplayEnabled = true; // 默认开启自动连播
export function setAutoplayEnabled(v: boolean): void {
    autoplayEnabled = v;
}

export let videoHasEnded = false;
export function setVideoHasEnded(v: boolean): void {
    videoHasEnded = v;
}

export let userClickedPosition: number | null = null;
export function setUserClickedPosition(v: number | null): void {
    userClickedPosition = v;
}

export let shortcutHintTimeout: ReturnType<typeof setTimeout> | null = null;
export function setShortcutHintTimeout(v: ReturnType<typeof setTimeout> | null): void {
    shortcutHintTimeout = v;
}

export let autoFullscreened = false;
export function setAutoFullscreened(v: boolean): void {
    autoFullscreened = v;
}

export let progressSaveInterval: ReturnType<typeof setInterval> | null = null;
export function setProgressSaveInterval(v: ReturnType<typeof setInterval> | null): void {
    progressSaveInterval = v;
}

export let currentVideoUrl = '';
export function setCurrentVideoUrl(v: string): void {
    currentVideoUrl = v;
}

export let episodeSwitchTimeout: ReturnType<typeof setTimeout> | null = null;
export function setEpisodeSwitchTimeout(v: ReturnType<typeof setTimeout> | null): void {
    episodeSwitchTimeout = v;
}

export let controlsLocked = false;
export function setControlsLocked(v: boolean): void {
    controlsLocked = v;
}

// ==================== 选集推进回调 ====================
// core.ts 在自然播放结束时需要切下一集，但 core 不能反向 import episodes.ts。
// index.ts 启动时注册 handler，core 只调用 advanceEpisode()。
let episodeAdvanceHandler: (() => void) | null = null;

export function setEpisodeAdvanceHandler(fn: (() => void) | null): void {
    episodeAdvanceHandler = fn;
}

export function advanceEpisode(): void {
    if (episodeAdvanceHandler) episodeAdvanceHandler();
}

// 阶段 5B-2 过渡期类型桥：尚未改为 import 的 player 模块仍以裸名访问这些符号。
declare global {
    interface PlayerArtInstance {
        on(event: string, handler: (...args: never[]) => void): void;
        controls: { show: boolean };
        fullscreen: boolean;
        currentTime: number;
        duration: number;
        video?: HTMLVideoElement;
        url?: string;
        play?: () => void;
        pause?: () => void;
        template?: { $player?: HTMLElement; $controlsLeft?: HTMLElement };
        isLock?: boolean;
        seek?: number;
    }
    let currentVideoTitle: string;
    let currentEpisodeIndex: number;
    let art: PlayerArtInstance | null;
    let currentHls: unknown;
    let currentEpisodes: string[];
    let episodesReversed: boolean;
    let autoplayEnabled: boolean;
    let videoHasEnded: boolean;
    let userClickedPosition: number | null;
    let shortcutHintTimeout: ReturnType<typeof setTimeout> | null;
    let autoFullscreened: boolean;
    let progressSaveInterval: ReturnType<typeof setInterval> | null;
    let currentVideoUrl: string;
    let episodeSwitchTimeout: ReturnType<typeof setTimeout> | null;
    let controlsLocked: boolean;
}
