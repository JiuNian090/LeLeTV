# Vanilla JS 模块化优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**目标:** 在不引入前端框架的前提下，将 LeLeTV 从全局函数污染模式逐步改造为 ES Modules 模块化架构，同时拆分过大的 app.js 文件。

**架构:** 保持 Vanilla JS + Tailwind CSS 技术栈不变。将全局 `function` 声明改为 `import/export`，按功能域拆分单体文件。页面通过 `<script type="module">` 加载入口文件，由入口文件按需导入子模块。

**当前现状:**
- 17 个 JS 文件，~10,050 行
- app.js 最大（1708 行），其次是 player.js（2580 行）、ui.js（1025 行）
- 所有顶层 `function` 声明都是全局函数（名称空间污染）
- HTML 通过 `<script>` 标签按顺序加载（顺序决定依赖关系）
- sha256.js 已使用动态 `import()`（ESM 模式）

**Tech Stack:** Vanilla JS (ES6+), Tailwind CSS (3.x)

---

## 文件结构调整

### 新建文件

| 文件 | 来源 | 职责 |
|------|------|------|
| `js/api-config.js` | 从 app.js 拆分 (L67-L680) | API 数据源选择、自定义 API 管理、隐藏内容过滤 |
| `js/api-search.js` | 从 app.js 拆分 (L749-L1037) | 搜索结果渲染、骨架屏、搜索输入控制 |
| `js/player-bridge.js` | 从 app.js 拆分 (L1378-L1460) | playVideo、剧集按钮渲染、播放器跳转桥接 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `js/config.js` | 添加 `export` |
| `js/version-utils.js` | 添加 `export` |
| `js/password.js` | 添加 `export` |
| `js/api.js` | 添加 `export` |
| `js/search.js` | 添加 `export` |
| `js/tmdb.js` | 添加 `export` |
| `js/cache-manager.js` | 添加 `export` |
| `js/loadBalancer.js` | 添加 `export` |
| `js/app.js` | 拆分为入口文件（只保留 setupEventListeners + 页面初始化逻辑） |
| `js/ui.js` | 添加 `export` + 清理全局函数 |
| `js/player.js` | 添加 `export` + 清理全局函数 |
| `index.html` | script 标签改为 `<script type="module">` |
| `player.html` | script 标签改为 `<script type="module">` |

### 不会改动

| 文件 | 原因 |
|------|------|
| `js/sha256.js` | 已使用 ESM 动态导入 |
| `js/proxy-auth.js` | 已使用 ESM 动态导入 |
| `js/aurora-bg.js` | 设计为全局注入，不影响模块化 |
| `js/loadBalancerUI.js` | 设计为全局注入 |
| `js/index-page.js` | 仅 78 行，index.html 专用入口 |

---

### Task 1: 拆分 app.js — 提取 api-config.js

**文件:**
- Create: `js/api-config.js`
- Modify: `js/app.js` (移除 L67-L680)
- Test: 手动验证 API 选择、自定义 API 管理功能

- [ ] **Step 1: 读取 app.js 的 L67-L680**

读取 `js/app.js` 第 67-680 行，确认以下函数列表：
`verifyAdminPassword`, `resetDataSourceLogic`, `initAPICheckboxes`, `applyNewDataSourceLogic`, `refreshDataSources`, `getRandomDataSources`, `addHiddenAPI`, `checkHiddenAPIsSelected`, `renderCustomAPIsList`, `editCustomApi`, `updateCustomApi`, `cancelEditCustomApi`, `restoreAddCustomApiButtons`, `updateSelectedAPIs`, `updateSelectedApiCount`, `selectAllAPIs`, `showAddCustomApiForm`, `cancelAddCustomApi`, `addCustomApi`, `removeCustomApi`

- [ ] **Step 2: 创建 js/api-config.js**

创建新文件，将上述函数完整复制进去。不需要额外的导出语法——当前仍用 `<script>` 全局模式加载，复制即可。

- [ ] **Step 3: 从 app.js 中删除 L67-L680**

从 `js/app.js` 中删除 `verifyAdminPassword` 到 `removeCustomApi` 之间的所有函数定义（约 614 行）。

- [ ] **Step 4: 在 index.html 中 api.js 之后添加 api-config.js 的加载**

```html
<script src="js/api.js?v=v2.6.0"></script>
<script src="js/api-config.js?v=v2.6.0"></script> <!-- 新增 -->
```

必须在 `password.js` 和 `app.js` 之前，因为 app.js 中的 `setupEventListeners` 调用了 `verifyAdminPassword`。

- [ ] **Step 5: 启动开发服务器并验证**

运行 `npm run dev`，打开浏览器进行以下验证：
1. 页面正常加载，无 JS 错误
2. 设置页面 → API 数据源开关正常工作
3. 添加/删除自定义 API 正常工作
4. 隐藏内容过滤开关正常工作

---

### Task 2: 拆分 app.js — 提取 api-search.js

**文件:**
- Create: `js/api-search.js`
- Modify: `js/app.js` (移除 L749-L1133)

- [ ] **Step 1: 读取 app.js 的 L749-L1133**

确认以下函数列表：
`resetSearchArea`, `getCustomApiInfo`, `generateSkeletonCards`, `_buildSearchCardsHtml`, `setupEmailClickHandlers`, `toggleClearButton`, `clearSearchInput`, `hookInput`

- [ ] **Step 2: 创建 js/api-search.js**

复制上述函数到新文件。

- [ ] **Step 3: 从 app.js 中删除 L749-L1133**

- [ ] **Step 4: 在 index.html 中添加 api-search.js 的加载**

```html
<script src="js/api-config.js?v=v2.6.0"></script>
<script src="js/api-search.js?v=v2.6.0"></script> <!-- 新增 -->
```

- [ ] **Step 5: 验证**

1. 页面正常加载
2. 搜索功能正常（输入关键词 → 显示骨架屏 → 展示卡片）
3. 搜索框清空按钮正常
4. 搜索结果卡片点击正常

---

### Task 3: 拆分 app.js — 提取 player-bridge.js

**文件:**
- Create: `js/player-bridge.js`
- Modify: `js/app.js` (移除 L1378-L1460)

- [ ] **Step 1: 读取 app.js 的 L1378-L1460**

确认以下函数列表：
`playVideo`, `playPreviousEpisode` (app.js 版本), `playNextEpisode` (app.js 版本), `renderEpisodes` (app.js 版本), `copyLinks` (app.js 版本), `toggleEpisodeOrder` (app.js 版本)

注意：player.js 中有同名的 `playPreviousEpisode`, `playNextEpisode`, `copyLinks`, `toggleEpisodeOrder` 函数，但它们是独立的（用于播放器页面）。player-bridge.js 中的版本是用于主页搜索弹窗中点击剧集时跳转到播放器。

- [ ] **Step 2: 创建 js/player-bridge.js**

复制上述函数到新文件。

- [ ] **Step 3: 从 app.js 中删除 L1378-L1460**

- [ ] **Step 4: 在 index.html 中添加 player-bridge.js 的加载**

```html
<script src="js/api-search.js?v=v2.6.0"></script>
<script src="js/player-bridge.js?v=v2.6.0"></script> <!-- 新增 -->
```

注意：player-bridge.js 中的 `renderEpisodes` 使用全局变量 `currentEpisodes`, `currentEpisodeIndex`, `currentVideoTitle`（在 app.js 中定义）。所以 app.js 必须在 player-bridge.js 之前加载。

- [ ] **Step 5: 验证**

1. 页面正常加载
2. 搜索视频 → 点击详情弹窗 → 点击剧集 → 跳转到 player.html
3. 播放上一集/下一集按钮正常
4. 复制链接按钮正常

---

### Task 4: 清理 app.js 主入口

**文件:**
- Modify: `js/app.js`

- [ ] **Step 1: 确认 app.js 剩余内容**

拆分后 app.js 剩余的模块：
1. 全局变量：`selectedAPIs`, `customAPIs`, `currentEpisodeIndex`, `currentEpisodes`, `currentVideoTitle`, `episodesReversed`
2. 函数：`setupEventListeners` (L691), `saveStringAsFile` (L1673)
3. 底部 DOMContentLoaded 初始化逻辑

- [ ] **Step 2: 整理 app.js**

确保剩余的全局变量和函数清晰有序。`app.js` 成为真正的"入口文件"，各子模块的初始化逻辑都在 `setupEventListeners` 中注册。

- [ ] **Step 3: 验证**

运行 `npm run build`，确保无构建错误。
浏览器验证所有原有功能正常。

---

### Task 5: 将 config.js 改为 ES Module

**文件:**
- Modify: `js/config.js`
- Modify: `index.html`

- [ ] **Step 1: 分析 config.js 的导出内容**

```js
window.API_SITES = API_SITES;
window.extendAPISites = extendAPISites;
```

- [ ] **Step 2: 改为 export**

```js
export const API_SITES = [ /* ... */ ];
export function extendAPISites() { /* ... */ }
```

移除末尾的 `window.API_SITES = API_SITES; window.extendAPISites = extendAPISites;`

- [ ] **Step 3: 更新 index.html**

```html
<script type="module" src="js/config.js?v=v2.6.0"></script>
```

- [ ] **Step 4: 验证**

浏览器无 JS 错误。注意 — 当前 `API_SITES` 被 proxy-auth.js, loadBalancer.js, 等通过 `window.API_SITES` 引用，改为 export 后这些引用会中断。需要同步修改引用者（在后续 Task 中进行）。

因为采用渐进式策略，此 Task 会暂时保留 `window.API_SITES` 的兼容设定：

```js
export const API_SITES = [ /* ... */ ];
// 临时兼容：保留全局引用，待所有模块转为 ESM 后移除
window.API_SITES = API_SITES;
window.extendAPISites = extendAPISites;
```

---

### Task 6: 将 version-utils.js 改为 ES Module

**文件:**
- Modify: `js/version-utils.js`

- [ ] **Step 1: 改为 export**

```js
export const versionUtils = { /* ... */ };
// 临时兼容
window.versionUtils = versionUtils;
```

- [ ] **Step 2: 验证**

运行 `npm run build`，浏览器底部版本号显示正常。

---

### Task 7: 将 api.js 改为 ES Module

**文件:**
- Modify: `js/api.js`

- [ ] **Step 1: 分析 api.js 的导出内容**

api.js 定义了一系列工具函数和 `window.fetch` 重写。需要识别哪些函数被其他文件引用。

- [ ] **Step 2: 添加 export 并保留全局兼容**

```js
export function fetchJSON(url, options) { /* ... */ }
export function fetchFromAPISite(siteConfig) { /* ... */ }
// 临时兼容
window.fetchJSON = fetchJSON;
window.fetchFromAPISite = fetchFromAPISite;
```

---

### Task 8: 将 password.js 改为 ES Module

**文件:**
- Modify: `js/password.js`

- [ ] **Step 1: 添加 export**

```js
export function isPasswordProtected() { /* ... */ }
export function isPasswordRequired() { /* ... */ }
export function isPasswordVerified() { /* ... */ }
export function verifyPassword() { /* ... */ }
export function ensurePasswordProtection() { /* ... */ }
// 临时兼容
window.isPasswordProtected = isPasswordProtected;
// ... 其他 window 赋值
```

---

### Task 9: 将 search.js 和 tmdb.js 改为 ES Module

**文件:**
- Modify: `js/search.js`
- Modify: `js/tmdb.js`

- [ ] **Step 1: search.js 添加 export**

```js
export function searchVideo(keyword, sourceCode) { /* ... */ }
// 临时兼容
window.searchVideo = searchVideo;
```

- [ ] **Step 2: tmdb.js 添加 export**

```js
export function fetchTmdbCategories() { /* ... */ }
export function fetchTmdbCategoryVideos() { /* ... */ }
// 临时兼容
window.fetchTmdbCategories = fetchTmdbCategories;
window.fetchTmdbCategoryVideos = fetchTmdbCategoryVideos;
```

---

### Task 10: 将 ui.js 改为 ES Module

**文件:**
- Modify: `js/ui.js`

- [ ] **Step 1: 添加 export**

```js
export function showToast(message, type, duration) { /* ... */ }
export function showLoading(message) { /* ... */ }
export function hideLoading() { /* ... */ }
export function closeModal() { /* ... */ }
export function getSearchHistory() { /* ... */ }
export function saveSearchHistory(query) { /* ... */ }
export function renderSearchHistory() { /* ... */ }
export function deleteSingleSearchHistory(query) { /* ... */ }
export function clearSearchHistory() { /* ... */ }
export function getViewingHistory() { /* ... */ }
export function loadViewingHistory() { /* ... */ }
export function renderHistoryCard(item) { /* ... */ }
export function formatPlaybackTime(seconds) { /* ... */ }
export function deleteHistoryItem(encodedUrl) { /* ... */ }
export function playFromHistory(url, title, episodeIndex, playbackPosition) { /* ... */ }
export function addToViewingHistory(videoInfo) { /* ... */ }
export function clearViewingHistory() { /* ... */ }
export function clearLocalStorage() { /* ... */ }
export function showImportBox(fun) { /* ... */ }
// 临时兼容
window.showToast = showToast;
window.showLoading = showLoading;
// ... 其他 window 赋值
```

---

### Task 11: 将 app.js, player-bridge.js, api-config.js, api-search.js 改为 ES Module

- [ ] **Step 1: 三个新拆分文件添加 export**

`api-config.js`, `api-search.js`, `player-bridge.js` 都添加 `export` 关键字并保留 `window.` 兼容。

- [ ] **Step 2: app.js 入口改为 import**

```js
import './config.js';
import './proxy-auth.js';
import './loadBalancer.js';
import './api.js';
import './api-config.js';
import './api-search.js';
import './player-bridge.js';
import './password.js';
import './search.js';
import './tmdb.js';
import './ui.js';
// 原有 setupEventListeners 和页面初始化逻辑
```

- [ ] **Step 3: index.html 简化**

```html
<script type="module" src="js/app.js?v=v2.6.0"></script>
```

---

### Task 12: 将 player.js 改为 ES Module

**文件:**
- Modify: `js/player.js`
- Modify: `player.html`

- [ ] **Step 1: player.js 添加 export**

```js
export function goHome(event) { /* ... */ }
export function initializePageContent() { /* ... */ }
export function initPlayer(videoUrl) { /* ... */ }
export function showError(message) { /* ... */ }
export function renderEpisodes() { /* ... */ }
export function playEpisode(index) { /* ... */ }
// ... 其他函数
// 临时兼容
window.goHome = goHome;
window.initializePageContent = initializePageContent;
```

- [ ] **Step 2: player.html 简化**

```html
<script type="module" src="js/player.js?v=v2.6.0"></script>
```

移除其他不需要的脚本标签（如 ui.js, app.js 等——如果 player.html 当前加载了它们）。

- [ ] **Step 3: 验证播放器功能**

1. 正常播放视频
2. 选集、上下集切换
3. 快捷键、锁按钮、自动连播
4. 加载/错误状态

---

### Task 13: 移除所有临时 window 兼容代码

**文件:** 所有添加了 `// 临时兼容` 注释的 JS 文件

- [ ] **Step 1: 逐一检查每个文件**

验证没有其他文件通过 `window.xxx` 引用其符号。移除所有 `window.xxx = xxx;` 兼容行。

- [ ] **Step 2: 验证**

完整测试所有功能。

---

### Task 14: 运行构建并更新文档

**文件:**
- Modify: `CODE_WIKI.md`
- Modify: `README.md`

- [ ] **Step 1: 运行构建**

```bash
npm run build
```
预期：exit code 0，无错误。

- [ ] **Step 2: 更新 README.md**

更新 JS 文件列表、加载顺序、模块说明。

- [ ] **Step 3: 更新 CODE_WIKI.md**

同步更新 Wiki 文档的模块描述、加载顺序表。

- [ ] **Step 4: 重建 GitNexus 索引**

```bash
npx gitnexus analyze --force
```