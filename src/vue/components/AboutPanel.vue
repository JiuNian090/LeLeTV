<template>
  <div class="about-dashboard-container">
    <div class="about-dashboard-grid">
      <!-- 项目介绍 -->
      <div class="dash-card about-intro-card">
        <div class="dash-card-body">
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4">
              <img src="/image/logo-black.png" alt="LeLeTV Logo" class="w-14 h-14 rounded-xl">
            </div>
            <p class="text-gray-300 text-sm sm:text-base mb-5 leading-relaxed">
              LeLeTV 是自用的在线视频搜索平台，提供视频搜索和播放服务，请勿擅自分享本网站，如需分享或者任何问题和建议可以☞<span class="contact-link text-blue-400 underline cursor-pointer transition-all duration-300 hover:text-blue-300 hover:underline-offset-2">联系乐乐</span>。
            </p>
            <div class="flex flex-row justify-center gap-3">
              <a href="https://letvport.776645.xyz/" target="_blank" rel="noopener noreferrer" class="flex-1 px-4 py-2.5 bg-[#ec4899] hover:bg-[#db2777] text-white rounded-lg transition-all duration-300 flex items-center justify-center font-semibold text-sm">
                访问我的网站
                <svg class="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <a href="https://github.com/JiuNian090/LeLeTV" target="_blank" rel="noopener noreferrer" class="flex-1 px-4 py-2.5 bg-[#24292e] hover:bg-[#2b3137] text-white rounded-lg transition-all duration-300 flex items-center justify-center text-sm">
                <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub 仓库
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- 隐私政策 -->
      <div id="privacy" class="dash-card">
        <div class="dash-card-header">
          <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          <h3 class="dash-card-title">隐私政策</h3>
        </div>
        <div class="dash-card-body">
          <p class="text-gray-300 text-sm leading-relaxed mb-3">
            LeLeTV 尊重并保护您的隐私。LeLeTV 不收集任何个人数据，还请不要相信出现的任何广告，且不要随便分享给别人，如要分享一定和乐乐说一声。
          </p>
          <div class="pt-3 border-t border-[#333]">
            <p class="text-gray-300 text-sm leading-relaxed">
              本平台仅用于提供在线视频搜索与播放服务。所有数据均由第三方接口提供，我不会存储或追踪用户信息。
            </p>
          </div>
        </div>
      </div>

      <!-- 版权声明与投诉机制 -->
      <div id="copyright" class="dash-card">
        <div class="dash-card-header">
          <div class="w-2.5 h-2.5 bg-yellow-500 rounded-full mr-2"></div>
          <h3 class="dash-card-title">版权声明与投诉机制</h3>
        </div>
        <div class="dash-card-body">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-7 h-7 bg-yellow-500/20 rounded-lg flex items-center justify-center mt-0.5">
              <svg class="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <p class="text-gray-300 text-sm leading-relaxed">
              LeLeTV 仅提供视频搜索服务，不直接提供、存储或上传任何视频内容。所有搜索结果均来自第三方公开接口。用户在使用本站服务时，须遵守相关法律法规，不得利用搜索结果从事侵权行为，如下载、传播未经授权的作品等。
            </p>
          </div>
        </div>
      </div>

      <!-- 更新日志 -->
      <div id="changelog" class="dash-card about-changelog-card">
        <div class="dash-card-header">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <h3 class="dash-card-title">更新日志</h3>
        </div>
        <div class="dash-card-body">
          <div v-if="loading" class="text-center py-6">
            <svg class="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="mt-3 text-gray-400 text-xs">加载更新日志中...</p>
          </div>
          <div v-else-if="error" class="bg-red-900/30 border border-red-800/50 rounded-lg p-4 text-center mt-4">
            <p class="text-red-400 text-sm">{{ error }}</p>
          </div>
          <div v-else class="changelog-timeline max-h-[500px] overflow-y-auto pr-2 scrollbar-thin" ref="timelineRef">
            <div v-for="(entry, idx) in changelogEntries" :key="entry.version" class="changelog-entry">
              <div class="timeline-marker">
                <div :class="['timeline-dot', { latest: idx === 0 }]"></div>
                <div class="timeline-line"></div>
              </div>
              <div class="timeline-content">
                <div class="entry-header">
                  <span class="version-number">{{ entry.version }}</span>
                  <span v-if="idx === 0" class="latest-badge">最新</span>
                  <span v-if="entry.date" class="version-date">{{ entry.date }}</span>
                </div>
                <div class="entry-body" v-html="entry.html"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AboutPanel.vue — 关于面板
 *
 * 显示项目介绍、隐私政策、版权声明和更新日志时间线。
 * 替换原生 app.ts 中 loadAboutPage + parseAndRenderChangelog 逻辑。
 */

import { ref, onMounted } from 'vue';

// ===== 状态 =====

const loading = ref(true);
const error = ref('');
const changelogEntries = ref<Array<{ version: string; date: string; html: string }>>([]);

// ===== 生命周期 =====

onMounted(async () => {
  try {
    const md = await fetchChangelog();
    changelogEntries.value = parseChangelog(md);
  } catch (e) {
    error.value = '加载更新日志失败';
    console.warn('[AboutPanel] 加载更新日志失败:', e);
  } finally {
    loading.value = false;
  }
});

// ===== 方法 =====

async function fetchChangelog(): Promise<string> {
  const res = await fetch('/CHANGELOG.md', { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

/**
 * 解析 CHANGELOG.md，返回版本条目列表
 * 与原生 parseAndRenderChangelog 逻辑一致
 */
function parseChangelog(markdown: string): Array<{ version: string; date: string; html: string }> {
  const entries: Array<{ version: string; date: string; html: string }> = [];
  const lines = markdown.split('\n');

  let currentVersion = '';
  let currentDate = '';
  let currentHtml = '';
  let isInEntry = false;

  const finalizeEntry = () => {
    if (!currentVersion) return;
    entries.push({
      version: currentVersion,
      date: currentDate,
      html: currentHtml,
    });
  };

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (isInEntry) finalizeEntry();
      isInEntry = true;
      currentHtml = '';
      const m = line.match(/### (v[\d\.]+) \(([\d\-:\s]+)\)/);
      if (m) {
        currentVersion = m[1];
        currentDate = m[2];
      } else if (line.includes('初始版本')) {
        currentVersion = '初始版本';
        currentDate = '';
      } else {
        // fallback: use full line as version
        currentVersion = line.replace(/^###\s+/, '').trim();
        currentDate = '';
      }
    } else if (line.startsWith('- ') && isInEntry) {
      const tagMatch = line.match(/- \[(.*?)\] (.*?)$/);
      if (tagMatch) {
        currentHtml += `<p class="mb-1"><span class="text-green-400">[${tagMatch[1]}]</span> ${escapeHtml(tagMatch[2])}</p>`;
      } else {
        currentHtml += `<p class="mb-1">${escapeHtml(line.substring(2))}</p>`;
      }
    } else if (line.trim() !== '' && isInEntry) {
      currentHtml += `<p class="text-gray-400 text-sm mt-2">${escapeHtml(line)}</p>`;
    }
  }

  if (isInEntry) finalizeEntry();

  return entries;
}

/** 简单的 HTML 转义（防止 XSS） */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
</script>

<style scoped>
.changelog-timeline {
  scrollbar-width: thin;
  scrollbar-color: #4B5563 transparent;
}
.changelog-entry {
  display: flex;
  gap: 12px;
  position: relative;
}
.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 16px;
}
.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4B5563;
  flex-shrink: 0;
  margin-top: 6px;
}
.timeline-dot.latest {
  background: #ec4899;
  box-shadow: 0 0 6px rgba(236, 72, 153, 0.5);
}
.timeline-line {
  width: 2px;
  flex: 1;
  background: #333;
  margin-top: 4px;
}
.changelog-entry:last-child .timeline-line {
  display: none;
}
.timeline-content {
  flex: 1;
  padding-bottom: 16px;
}
.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.version-number {
  font-weight: 600;
  color: #ec4899;
  font-size: 0.875rem;
}
.latest-badge {
  background: rgba(236, 72, 153, 0.2);
  color: #ec4899;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
}
.version-date {
  color: #6B7280;
  font-size: 0.75rem;
}
.entry-body {
  color: #D1D5DB;
  font-size: 0.8rem;
  line-height: 1.5;
}
.entry-body :deep(p) {
  margin-bottom: 4px;
}
</style>
