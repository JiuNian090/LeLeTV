// LeLeTV — 播放器键盘快捷键模块
// 从 player.js 拆分

function handleKeyboardShortcuts(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (controlsLocked) return;

  if (e.altKey && e.key === 'ArrowLeft') {
    if (currentEpisodeIndex > 0) { playPreviousEpisode(); showShortcutHint('\u4e0a\u4e00\u96c6', 'left'); e.preventDefault(); }
  }
  if (e.altKey && e.key === 'ArrowRight') {
    if (currentEpisodeIndex < currentEpisodes.length - 1) { playNextEpisode(); showShortcutHint('\u4e0b\u4e00\u96c6', 'right'); e.preventDefault(); }
  }
  if (!e.altKey && e.key === 'ArrowLeft') {
    if (art && art.currentTime > 5) { art.currentTime -= 5; showShortcutHint('\u5feb\u9000', 'left'); e.preventDefault(); }
  }
  if (!e.altKey && e.key === 'ArrowRight') {
    if (art && art.currentTime < art.duration - 5) { art.currentTime += 5; showShortcutHint('\u5feb\u8fdb', 'right'); e.preventDefault(); }
  }
  if (e.key === 'ArrowUp') {
    if (art && art.volume < 1) { art.volume += 0.1; showShortcutHint('\u97f3\u91cf+', 'up'); e.preventDefault(); }
  }
  if (e.key === 'ArrowDown') {
    if (art && art.volume > 0) { art.volume -= 0.1; showShortcutHint('\u97f3\u91cf-', 'down'); e.preventDefault(); }
  }
  if (e.key === ' ') {
    if (art) { art.toggle(); showShortcutHint('\u64ad\u653e/\u6682\u505c', 'play'); e.preventDefault(); }
  }
  if (e.key === 'f' || e.key === 'F') {
    if (art) { art.fullscreen = !art.fullscreen; showShortcutHint('\u5207\u6362\u5168\u5c4f', 'fullscreen'); e.preventDefault(); }
  }
}
