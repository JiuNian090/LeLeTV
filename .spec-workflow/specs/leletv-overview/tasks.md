# 播放功能实现任务

## 1. 任务概述
实现LeLeTV的播放功能，包括视频播放控制、多集内容播放、上下集切换、播放进度保存与恢复、自动连播等功能。

## 2. 实现细节

### 2.1 视频播放控制实现
- 集成ArtPlayer播放器
- 实现播放/暂停、快进/快退、音量控制等基本操作
- 实现全屏播放和画中画模式
- 实现键盘快捷键操作

### 2.2 多集内容播放实现
- 解析视频详情获取集数列表
- 实现集数列表展示
- 实现点击集数切换播放

### 2.3 上下集切换实现
- 实现上一集/下一集按钮
- 实现键盘快捷键切换集数
- 实现当前集数位置检测

### 2.4 播放进度保存与恢复实现
- 实现播放进度自动保存到localStorage
- 实现页面刷新或重新访问时恢复播放进度
- 实现手动清除播放进度功能

### 2.5 自动连播功能实现
- 实现自动连播开关
- 实现自动播放下一集
- 实现自动连播默认状态配置

## 3. 核心代码实现

### 3.1 播放器集成 (player.js)
```javascript
// 初始化播放器
function initPlayer(videoUrl) {
  // 销毁旧实例
  if (art) {
    art.destroy();
    art = null;
  }

  // 创建新的ArtPlayer实例
  art = new Artplayer({
    container: '#player',
    url: videoUrl,
    type: 'm3u8',
    title: currentVideoTitle,
    volume: 0.8,
    autoplay: true,
    fullscreen: true,
    fullscreenWeb: true,
    // 其他配置...
  });

  // 添加事件监听器
  art.on('ready', handlePlayerReady);
  art.on('video:loadedmetadata', handleVideoLoaded);
  art.on('video:ended', handleVideoEnded);
  // 其他事件...
}

// 处理播放器就绪事件
function handlePlayerReady() {
  // 隐藏加载提示
  hideLoading();
  // 其他初始化操作...
}

// 处理视频元数据加载事件
function handleVideoLoaded() {
  // 恢复播放进度
  restorePlaybackPosition();
  // 保存到历史记录
  saveToHistory();
  // 启动进度保存定时器
  startProgressSaveInterval();
}
```

### 3.2 进度管理实现 (player.js)
```javascript
// 保存当前播放进度
function saveCurrentProgress() {
  if (!art || !art.video) return;
  
  const currentTime = art.video.currentTime;
  const duration = art.video.duration;
  
  if (!duration || currentTime < 1) return;

  // 保存到localStorage
  const progressKey = `videoProgress_${getVideoId()}`;
  const progressData = {
    position: currentTime,
    duration: duration,
    timestamp: Date.now()
  };
  
  localStorage.setItem(progressKey, JSON.stringify(progressData));
  
  // 更新观看历史记录
  updateViewingHistory(currentTime, duration);
}

// 恢复播放进度
function restorePlaybackPosition() {
  // 从URL参数获取播放位置
  const urlParams = new URLSearchParams(window.location.search);
  const savedPosition = parseInt(urlParams.get('position') || '0');

  if (savedPosition > 10 && savedPosition < art.duration - 2) {
    // 使用URL中的播放位置
    art.currentTime = savedPosition;
    showPositionRestoreHint(savedPosition);
  } else {
    // 从localStorage恢复播放进度
    const progressKey = `videoProgress_${getVideoId()}`;
    const progressStr = localStorage.getItem(progressKey);
    
    if (progressStr && art.duration > 0) {
      const progress = JSON.parse(progressStr);
      if (
        progress &&
        typeof progress.position === 'number' &&
        progress.position > 10 &&
        progress.position < art.duration - 2
      ) {
        art.currentTime = progress.position;
        showPositionRestoreHint(progress.position);
      }
    }
  }
}
```

### 3.3 集数管理实现 (player.js)
```javascript
// 渲染集数列表
function renderEpisodes() {
  const episodesList = document.getElementById('episodesList');
  if (!episodesList) return;

  if (!currentEpisodes || currentEpisodes.length === 0) {
    episodesList.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">没有可用的集数</div>';
    return;
  }

  const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
  let html = '';

  episodes.forEach((episode, index) => {
    // 根据倒序状态计算真实的剧集索引
    const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
    const isActive = realIndex === currentEpisodeIndex;

    html += `
      <button id="episode-${realIndex}" 
              onclick="playEpisode(${realIndex})" 
              class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333] hover:!shadow-none'} !border ${isActive ? '!border-blue-500' : '!border-[#333]'} rounded-lg transition-colors text-center episode-btn">
        ${realIndex + 1}
      </button>
    `;
  });

  episodesList.innerHTML = html;
}

// 播放指定集数
function playEpisode(index) {
  // 确保index在有效范围内
  if (index < 0 || index >= currentEpisodes.length) {
    return;
  }

  // 保存当前播放进度
  saveCurrentProgress();

  // 获取目标集数的URL
  const url = currentEpisodes[index];

  // 更新当前剧集索引
  currentEpisodeIndex = index;
  currentVideoUrl = url;

  // 更新URL参数
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('index', index);
  currentUrl.searchParams.set('url', url);
  currentUrl.searchParams.delete('position');
  window.history.replaceState({}, '', currentUrl.toString());

  // 切换视频源
  if (isWebkit) {
    initPlayer(url);
  } else {
    art.switch = url;
  }

  // 更新UI
  updateEpisodeInfo();
  updateButtonStates();
  renderEpisodes();
}
```

### 3.4 自动连播实现 (player.js)
```javascript
// 处理视频播放结束事件
art.on('video:ended', function () {
  videoHasEnded = true;

  // 清除播放进度
  clearVideoProgress();

  // 如果自动播放下一集开启，且确实有下一集
  if (autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1) {
    // 延迟播放下一集
    setTimeout(() => {
      playNextEpisode();
      videoHasEnded = false;
    }, 1000);
  } else {
    art.fullscreen = false;
  }
});

// 切换自动连播开关
document.getElementById('autoplayToggle').addEventListener('change', function (e) {
  autoplayEnabled = e.target.checked;
  localStorage.setItem('autoplayEnabled', autoplayEnabled);
});
```

## 4. 验证标准
- 视频播放器正常工作
- 支持播放/暂停、快进/快退等基本操作
- 多集内容播放功能正常
- 上下集切换功能正常
- 播放进度保存与恢复功能正常
- 自动连播功能正常
- 键盘快捷键操作正常
- 响应式设计适配良好