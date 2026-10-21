// LeLeTV — 播放器键盘快捷键模块
// 从 player.js 拆分

// 阶段 5B-3：显式 import 状态与选集/提示函数。
import { art, controlsLocked, currentEpisodeIndex, currentEpisodes } from './state';
import { playPreviousEpisode, playNextEpisode } from './episodes';
import { showShortcutHint } from './ui';

interface ShortcutArt extends PlayerArtInstance {
  volume?: number;
  toggle?: () => void;
}

export function handleKeyboardShortcuts(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  if (controlsLocked) return;

  const player = art as ShortcutArt | null;

  if (e.altKey && e.key === 'ArrowLeft') {
    if (currentEpisodeIndex > 0) { playPreviousEpisode(); showShortcutHint('\u4e0a\u4e00\u96c6', 'left'); e.preventDefault(); }
  }
  if (e.altKey && e.key === 'ArrowRight') {
    if (currentEpisodeIndex < currentEpisodes.length - 1) { playNextEpisode(); showShortcutHint('\u4e0b\u4e00\u96c6', 'right'); e.preventDefault(); }
  }
  if (!e.altKey && e.key === 'ArrowLeft') {
    if (player && player.currentTime > 5) { player.currentTime -= 5; showShortcutHint('\u5feb\u9000', 'left'); e.preventDefault(); }
  }
  if (!e.altKey && e.key === 'ArrowRight') {
    if (player && player.currentTime < player.duration - 5) { player.currentTime += 5; showShortcutHint('\u5feb\u8fdb', 'right'); e.preventDefault(); }
  }
  if (e.key === 'ArrowUp') {
    if (player && player.volume < 1) { player.volume += 0.1; showShortcutHint('\u97f3\u91cf+', 'up'); e.preventDefault(); }
  }
  if (e.key === 'ArrowDown') {
    if (player && player.volume > 0) { player.volume -= 0.1; showShortcutHint('\u97f3\u91cf-', 'down'); e.preventDefault(); }
  }
  if (e.key === ' ') {
    if (player) { player.toggle?.(); showShortcutHint('\u64ad\u653e/\u6682\u505c', 'play'); e.preventDefault(); }
  }
  if (e.key === 'f' || e.key === 'F') {
    if (player) { player.fullscreen = !player.fullscreen; showShortcutHint('\u5207\u6362\u5168\u5c4f', 'fullscreen'); e.preventDefault(); }
  }
}

// 阶段 5A-6 过渡期兼容桥：player bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  handleKeyboardShortcuts
});

// 阶段 5B-3 过渡期类型桥：shortcuts.ts 已成为 ESM 模块，index 仍以裸名注册。
declare global {
  function handleKeyboardShortcuts(e: KeyboardEvent): void;
}
