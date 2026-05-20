# LeLeTV 项目 Code Wiki

> 生成日期：2026-05-20 | 项目版本：v2.5.20.2

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [整体架构](#3-整体架构)
4. [目录结构](#4-目录结构)
5. [前端模块详解](#5-前端模块详解)
   - [5.1 主入口 - index.html](#51-主入口---indexhtml)
   - [5.2 核心应用逻辑 - app.js](#52-核心应用逻辑---appjs)
   - [5.3 搜索模块 - search.js](#53-搜索模块---searchjs)
   - [5.4 播放器模块 - player.js](#54-播放器模块---playerjs)
   - [5.5 TMDB 分类模块 - tmdb.js](#55-tmdb-分类模块---tmdbjs)
   - [5.6 UI 工具 & 观看历史 - ui.js](#56-ui-工具--观看历史---uijs)
   - [5.7 密码保护 - password.js](#57-密码保护---passwordjs)
   - [5.8 代理鉴权 - proxy-auth.js](#58-代理鉴权---proxyauthjs)
   - [5.9 全局配置 - config.js](#59-全局配置---configjs)
   - [5.10 负载均衡 - loadBalancer.js](#510-负载均衡---loadbalancerjs)
   - [5.11 负载均衡 UI - loadBalancerUI.js](#511-负载均衡-ui---loadbalanceruijs)
   - [5.12 缓存管理 - cache-manager.js](#512-缓存管理---cache-managerjs)
   - [5.13 版本管理](#513-版本管理)
   - [5.14 其他模块](#514-其他模块)
6. [服务端](#6-服务端)
   - [6.1 本地服务器 - server.mjs](#61-本地服务器---servermjs)
   - [6.2 Cloudflare Worker - tmdb-worker.js](#62-cloudflare-worker---tmdb-workerjs)
   - [6.3 Cloudflare Pages Functions](#63-cloudflare-pages-functions)
7. [PWA & Service Worker](#7-pwa--service-worker)
8. [构建系统与脚本](#8-构建系统与脚本)
9. [数据流](#9-数据流)
10. [关键设计模式](#10-关键设计模式)
11. [环境变量配置](#11-环境变量配置)
12. [缓存策略](#12-缓存策略)
13. [安全机制](#13-安全机制)
14. [错误处理策略](#14-错误处理策略)
15. [AI 开发集成](#15-ai-开发集成)

---

## 1. 项目概述

**LeLeTV（乐乐影视）** 是一个自用的在线视频搜索与观看平台，纯前端 SPA（单页应用）架构，聚合 21 个第三方视频采集站 API 实现搜索和播放，通过 TMDB（The Movie Database）提供分类浏览、影片详情和智能筛选功能。

- **作者**：JiuNian (jiunian090@gmail.com)
- **许可证**：Apache-2.0
- **生产部署**：Cloudflare Pages + Cloudflare Workers（静态 + 无服务器架构）
- **本地开发**：Node.js + Express (server.mjs, 412 行)
- **播放器**：ArtPlayer + HLS.js（约 2390 行 JS）
- **样式框架**：Tailwind CSS 3.4 + PostCSS
- **UI 风格**：HarmonyOS 深色调色板，霓虹粉 #ec4899 主色
- **AI 索引**：GitNexus MCP 知识图谱（1809 符号，3031 关系）

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vanilla JS (ES6+) | 无框架，纯原生 JS |
| 样式 | Tailwind CSS 3.4 + PostCSS | HarmonyOS 深色调色板 / 赛博朋克霓虹美学 |
| 播放器 | ArtPlayer + HLS.js v1.x | M3U8 流媒体播放，广告过滤 |
| 后端（本地） | Node.js + Express 5.x | 静态服务 + 视频代理 + TMDB 代理 |
| 部署平台 | Cloudflare Pages | 纯静态资源托管 |
| 无服务器 | Cloudflare Workers | TMDB API 代理 |
| Pages Functions | Cloudflare Pages Functions | 密码注入 + 视频代理 |
| PWA | Service Worker + Manifest | 离线缓存 + 可安装到桌面 |
| 密码安全 | SHA-256 哈希（Web Crypto API） | 客户端/服务端双重验证 |
| 构建工具 | Node.js 脚本 + npm scripts | 版本生成、样式构建 |
| AI 辅助 | GitNexus MCP | 代码知识图谱索引与分析 |

### 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| axios | ^1.9.0 | HTTP 请求（服务端代理） |
| cors | ^2.8.5 | CORS 中间件 |
| dotenv | ^16.5.0 | 环境变量加载 |
| express | ^5.1.0 | Web 服务器 |
| node-fetch | ^3.3.2 | 服务端 fetch |

### 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| tailwindcss | ^3.4.19 | CSS 框架 |
| postcss | ^8.5.14 | CSS 处理 |
| autoprefixer | ^10.5.0 | CSS 前缀 |
| nodemon | ^3.1.10 | 热重载 |

### 第三方前端库

| 文件 | 说明 |
|------|------|
| `libs/artplayer.min.js` | ArtPlayer 播放器 |
| `libs/hls.min.js` | HLS.js 流媒体引擎 |
| `libs/sha256.min.js` | js-sha256（HTTP 兼容备用） |

---

## 3. 整体架构

### 3.1 生产部署架构（Cloudflare）

```
用户浏览器
    │
    ├── Cloudflare Pages ─────────── 静态资源（HTML/CSS/JS）
    │       ├── Pages Functions ──── 密码注入（环境变量 → HTML 模板）
    │       └── Pages Functions ──── 视频代理（/proxy/*，通配路由）
    │
    ├── Cloudflare Worker ────────── TMDB API 代理
    │       └── workers/tmdb-worker.js ──── TMDB API v3
    │       └── /health 健康检查端点
    │
    ├── 第三方采集站 API (21 个) ──── 视频搜索和播放源
    │       ├── 14 个普通源（dyttzy、bdzy、moduzy 等）
    │       └── 7 个成人标记源（ckzy、fhzy、ywzy 等）
    │
    └── TMDB API ────────────────── 影片元数据
            └── api.themoviedb.org
```

### 3.2 本地开发架构

```
用户浏览器
    │
    ├── Node.js + Express（server.mjs, 412 行）
    │       ├── 静态资源服务（express.static）
    │       ├── / → HTML 模板注入（密码哈希、TMDB_URL、版本号）
    │       ├── /proxy/:encodedUrl → 视频源代理（鉴权 + URL 安全验证 + 重试）
    │       ├── /api/tmdb → TMDB API 代理（支持 Worker 转发 + 直连）
    │       └── /api/version → 版本号 API
    │
    └── 第三方采集站 API (21 源) ──── 视频搜索和播放源
```

### 3.3 页面路由（SPA）

| 页面 | 路由 | 对应 DOM | 说明 |
|------|------|----------|------|
| 首页（搜索） | `/` / `/s=keyword` | `#page-home` | 视频搜索 + 最近搜索历史 |
| 分类浏览 | JS 切换 | `#page-category` | TMDB 分类 + 多维筛选（惰性加载） |
| 观看历史 | JS 切换 | `#page-history` | 分组展示（今天/昨天/本周/更早）+ 进度条 |
| 设置 | JS 切换 | `#page-settings` | 数据源、自定义 API、功能开关（黄色过滤） |
| 关于 | JS 切换 | `#page-about` | 隐私政策 + 更新日志（CHANGELOG.md 动态加载） |
| 播放器 | `/player.html` | 独立页面 | ArtPlayer 全屏播放（2390 行 JS） |
| 中转页 | `/watch.html` | 独立页面 | 播放前参数中转 |

### 3.4 JS 文件加载顺序

```
index.html 底部脚本加载顺序:
  libs/sha256.min.js         ← SHA-256 工具库
  js/config.js               ← 全局配置（最先，定义常量与 21 个 API 源）
  js/proxy-auth.js           ← 代理鉴权（密码哈希 + 时间戳参数）
  js/customer_site.js        ← 自定义站点扩展（第三方资源共享）
  js/loadBalancer.js         ← 负载均衡核心（自动实例化）
  js/loadBalancerUI.js       ← 负载均衡状态面板 UI
  js/ui.js                   ← UI 工具（Toast/Loading/历史管理）
  js/api.js                  ← API 请求工具
  js/password.js             ← 密码保护系统
  js/search.js               ← 搜索模块
  js/tmdb.js                 ← TMDB 分类浏览
  js/app.js                  ← 主入口（初始化所有逻辑，1765 行）
  js/version-utils.js        ← 版本工具函数
  js/version-check.js        ← 版本检测
  js/version-updater.js      ← 版本更新自动检测
  js/index-page.js           ← 首页弹窗 + URL 搜索参数处理
```

---

## 4. 目录结构

```
LeLeTV/
├── api/                        # Cloudflare Pages Functions
│   └── proxy/[...path].mjs     #   视频代理（通配路由）
├── css/                        # 样式文件（3794 行手写）
│   ├── styles.css              #   全局样式（1147 行：滚动条、动画、HarmonyOS 变量）
│   ├── index.css               #   首页 + 搜索卡片（1170 行）
│   ├── player.css              #   播放器页面（1248 行）
│   ├── watch.css               #   中转页面（229 行）
│   ├── tailwind.css            #   Tailwind CSS 入口（@tailwind 指令）
│   └── output.css              #   Tailwind 编译输出（压缩版）
├── docs/
│   └── VERSION_RULES.md        #   版本号规则说明
├── functions/                  # Vercel/Netlify 兼容中间件
│   ├── _middleware.js          #   密码注入中间件
│   └── proxy/[[path]].js       #   代理函数
├── image/                      # 图片资源
│   ├── logo.png                #   网站 Logo（圆形）
│   ├── logo-black.png          #   PWA 图标（方形黑色）
│   └── nomedia.png             #   无封面占位图
├── js/                         # JavaScript 核心模块（19 个文件）
│   ├── config.js               #   全局常量与配置（284 行：21 个 API 源、配置对象）
│   ├── app.js                  #   主入口（1765 行：初始化、搜索、播放跳转）
│   ├── search.js               #   视频搜索（缓存、并发、分页、负载均衡）
│   ├── player.js               #   播放器（2390 行，最大模块：ArtPlayer + HLS.js）
│   ├── watch.js                #   播放中转页面
│   ├── tmdb.js                 #   TMDB 分类浏览（筛选/分页/惰性加载）
│   ├── ui.js                   #   UI 工具（Toast/Loading/历史管理）
│   ├── api.js                  #   API 请求工具函数
│   ├── password.js             #   密码保护系统
│   ├── proxy-auth.js           #   代理请求鉴权
│   ├── loadBalancer.js         #   负载均衡核心（类实现，评分算法）
│   ├── loadBalancerUI.js       #   负载均衡状态面板 UI
│   ├── cache-manager.js        #   智能缓存管理（类实现，24h 清理）
│   ├── customer_site.js        #   第三方资源共享扩展
│   ├── version-check.js        #   版本检测 + CHANGELOG 解析
│   ├── version-utils.js        #   版本号格式转换工具
│   ├── version-updater.js      #   版本更新 + SW 缓存清理
│   ├── index-page.js           #   首页弹窗 + URL 搜索参数
│   └── sha256.js               #   SHA-256 实现（备用）
├── libs/                       # 第三方库（本地引用）
│   ├── artplayer.min.js        #   ArtPlayer 播放器
│   ├── hls.min.js              #   HLS.js 核心
│   └── sha256.min.js           #   js-sha256 库
├── scripts/                    # 自动化脚本（9 个）
│   ├── generate-version.mjs    #   版本号生成 + HTML 注入
│   ├── create-tag.js           #   Git 标签创建
│   ├── update-version.js       #   版本号更新
│   ├── update-all-versions.js  #   全量版本同步
│   ├── changelog-updater.js    #   CHANGELOG 维护
│   ├── version-tracker.js      #   版本跟踪
│   ├── create-historical-releases.js  #   历史 Release 创建
│   ├── create-releases.ps1     #   PowerShell 发布脚本
│   └── test-auto-release.js    #   自动发布测试
├── workers/
│   └── tmdb-worker.js          #   Cloudflare Worker 脚本
├── .claude/                    # GitNexus 技能文件
│   └── skills/gitnexus/        #   6 个技能（exploring/impact/debug/refactoring/guide/cli）
├── .env                        # 本地环境变量（不提交）
├── .gitignore
├── .trae/                      # Trae IDE 配置
│   ├── .ignore
│   └── skills/leletv-ai-developer/SKILL.md  # AI 开发技能
├── _headers                    # CF Pages 缓存头策略
├── AGENTS.md                   # AI 代理指南（GitNexus）
├── CLAUDE.md                   # Claude 集成配置（GitNexus）
├── CODE_WIKI.md                # 本文档
├── index.html                  # SPA 主入口
├── player.html                 # 播放器独立页面
├── watch.html                  # 播放中转页面
├── about.html                  # 关于页面（已废弃，内容嵌入 SPA）
├── manifest.json               # PWA Web App Manifest
├── middleware.js                # Vercel 中间件
├── package.json                # 项目配置
├── postcss.config.js           # PostCSS 配置
├── server.mjs                  # Node.js 本地服务器（412 行）
├── service-worker.js           # Service Worker
├── tailwind.config.js          # Tailwind CSS 配置
└── wrangler.toml               # Cloudflare Workers 配置
```

---

## 5. 前端模块详解

### 5.1 主入口 - index.html

**文件**: [index.html](file:///e:/Code/JiunianTV/LeLeTV/index.html)

**职责**:
- SPA 页面容器：包含 5 个页面区域（home、category、history、settings、about）
- 导航栏定义（搜索、分类、历史、设置、关于）
- 模态框定义（详情弹窗、密码验证、使用说明、Toast 提示、Loading）
- 环境变量注入脚本（PASSWORD、ADMINPASSWORD、TMDB_WORKER_URL、版本号）
- JS 脚本加载控制（按依赖顺序 defer 加载，16 个脚本）
- 页面切换逻辑（`switchPage()` 函数）
- CHANGELOG.md 动态加载与解析渲染

**关键 DOM 结构**:

| ID | 用途 |
|----|------|
| `#page-home` | 首页搜索区域 |
| `#page-category` | TMDB 分类筛选 + 结果 |
| `#page-history` | 观看历史列表 |
| `#page-settings` | 设置面板（API 源、功能开关） |
| `#page-about` | 关于页面（隐私、版权、更新日志） |
| `#modal` | 视频详情弹窗 |
| `#passwordModal` | 密码验证弹窗 |
| `#disclaimerModal` | 使用说明弹窗 |
| `#toast` | Toast 提示框 |
| `#loading` | 加载提示框 |

### 5.2 核心应用逻辑 - app.js

**文件**: [app.js](file:///e:/Code/JiunianTV/LeLeTV/js/app.js)（1765 行）

**职责**: 应用的全局核心逻辑，包括页面初始化、API 选择管理、搜索流程、详情展示、播放跳转、配置导入导出。

**关键函数**:

| 函数名 | 说明 |
|--------|------|
| `initAPICheckboxes()` | 初始化设置页面的 API 源复选框列表 |
| `applyNewDataSourceLogic()` | 应用数据源选择策略（v1 版本逻辑） |
| `getRandomDataSources(count)` | 随机选择指定数量的非成人数据源 |
| `updateSelectedAPIs()` | 同步复选框状态到 localStorage |
| `selectAllAPIs(selectAll, excludeAdult)` | 全选/取消全选 API 源 |
| `addCustomApi()` | 添加自定义 API 源（最多 5 个，URL 格式校验） |
| `removeCustomApi(index)` | 删除自定义 API 源并重新索引 |
| `checkAdultAPIsSelected()` | 检查是否选中了成人内容 API，联动禁用过滤开关 |
| `verifyAdminPassword()` | 管理员密码验证（关闭黄色过滤时触发） |
| `search()` | 核心搜索函数（防抖 + 渐进式渲染 + 负载均衡集成） |
| `_buildSearchCardsHtml(items)` | 生成搜索卡片 HTML（XSS 保护，HTML 转义） |
| `playDirectly(id, vod_name, sourceCode)` | 直接跳转播放（绕过详情弹窗） |
| `showDetails(id, vod_name, sourceCode)` | 显示视频详情弹窗 |
| `playVideo(url, vod_name, sourceCode, episodeIndex)` | 播放视频（跳转 watch.html 中转） |
| `renderEpisodes(vodName, sourceCode, vodId)` | 渲染剧集按钮网格 |
| `toggleEpisodeOrder(sourceCode, vodId)` | 切换剧集正序/倒序 |
| `importConfig()` / `exportConfig()` | 配置文件导入/导出（含哈希校验） |
| `setupEmailClickHandlers()` | 邮箱点击处理器（复制 + 打开客户端） |

**数据流**:
```
用户输入 → search() → searchByAPIAndKeyWord() × N → 渐进式渲染结果
         → 解析 episode URL → playDirectly() / showDetails()
         → watch.html → player.html → ArtPlayer 播放
         → 实时保存观看进度到 localStorage（30 秒防抖）
```

### 5.3 搜索模块 - search.js

**文件**: [search.js](file:///e:/Code/JiunianTV/LeLeTV/js/search.js)

**职责**: 封装视频搜索请求，支持缓存、多页获取、负载均衡集成。

**关键函数**:

| 函数名 | 说明 |
|--------|------|
| `_getCachedResult(apiId, query)` | 从内存缓存获取搜索结果（5 分钟 TTL） |
| `_setCachedResult(apiId, query, results)` | 缓存搜索结果（超过 100 条自动清理） |
| `searchByAPIAndKeyWord(apiId, query)` | 对单个 API 源执行搜索（支持自定义 API） |

**搜索流程**:
```
1. 检查内存缓存 (Map, 5min TTL)
2. 构建 API URL (内置 API 或自定义 API)
3. 通过 proxy-auth 添加鉴权参数 → 代理 URL
4. AbortController 15 秒超时控制
5. 处理第 1 页结果 → 添加 source_name/source_code 标记
6. 并发获取第 2~3 页（最多 maxPages=3 页）
7. 合并所有页结果 → 写入缓存 → 返回
8. 错误时调用 loadBalancer.recordApiResult()
```

### 5.4 播放器模块 - player.js

**文件**: [player.js](file:///e:/Code/JiunianTV/LeLeTV/js/player.js)（约 2390 行，最复杂的模块）

**职责**: 基于 ArtPlayer 和 HLS.js 的完整视频播放功能，支持 M3U8 流媒体、广告过滤、键盘快捷键、进度恢复、观看历史等。

**关键类**:

| 类名 | 说明 |
|------|------|
| `CustomHlsJsLoader` | 自定义 HLS.js Loader，拦截 manifest/level 请求过滤广告 |

**关键函数**:

| 函数名 | 说明 |
|--------|------|
| `goHome(event)` | 返回首页（全屏时先退出全屏） |
| `initializePageContent()` | 页面初始化（URL 参数解析、状态恢复、播放器创建） |
| `initPlayer(videoUrl)` | 创建 ArtPlayer + HLS.js 实例（完整配置） |
| `playEpisode(index)` | 切换剧集（保留进度、清理状态） |
| `showSwitchResourceModal()` | 显示资源切换弹窗（含速率测试和排序） |
| `testVideoSourceSpeed(sourceKey, vodId)` | 测试视频源响应速度 |
| `switchToResource(sourceKey, vodId)` | 切换到指定视频源 |
| `addNextEpisodeDirectly(art)` | 向 ArtPlayer 控制栏注入「下一集」按钮 |
| `setupProgressBarPreciseClicks()` | 精确进度条点击/拖拽跳转 |
| `handleKeyboardShortcuts(e)` | 键盘快捷键处理 |
| `setupLongPressSpeedControl()` | 长按二倍速播放（桌面鼠标 + 移动端触摸） |
| `saveToHistory()` | 保存/更新观看历史记录 |
| `saveCurrentProgress()` | 保存当前播放进度（30 秒防抖） |
| `renderPlayerDetailInfo()` | 渲染播放器详情面板（类型/年份/导演/主演/简介） |
| `updateMediaSession()` | 更新 Media Session API 元数据 |
| `filterAdsFromM3U8(m3u8Content, strictMode)` | M3U8 内容广告过滤 |
| `fetchTmdbPlayerDetail(title)` | 异步获取 TMDB 详情增强信息 |

**HLS.js 配置要点**:
- 自定义 Loader（`CustomHlsJsLoader`）用于过滤 `#EXT-X-DISCONTINUITY` 广告段
- 分片重试最大 6 次、manifest 重试 3 次
- bufferAppendError 自动恢复机制
- 致命错误分级处理：NETWORK → 重新加载, MEDIA → recoverMediaError

**快捷键一览**:

| 按键 | 功能 |
|------|------|
| ← | 快退 5 秒 |
| → | 快进 5 秒 |
| ↑ | 音量 +10% |
| ↓ | 音量 -10% |
| 空格 | 播放/暂停 |
| F | 切换全屏 |
| Alt + ← | 上一集 |
| Alt + → | 下一集 |

### 5.5 TMDB 分类模块 - tmdb.js

**文件**: [tmdb.js](file:///e:/Code/JiunianTV/LeLeTV/js/tmdb.js)

**职责**: TMDB 影片分类浏览，支持电影/电视剧/动漫/综艺四种类型，多维度筛选和排序。

**状态管理（TMDB_STATE 对象）**:
```javascript
{
  type: 'movie' | 'tv' | 'anime' | 'variety',
  page: 1,
  totalPages: 500 (max),
  selectedGenre: null,
  selectedYear: '',
  selectedSort: 'primary_release_date.desc',
  voteRating: '',
  originalLanguage: '',
  originCountry: '',
  tvStatus: '',
  isLoaded: false,
  isLoading: false
}
```

**关键函数**:

| 函数名 | 说明 |
|--------|------|
| `initTmdbCategory()` | 初始化分类页面（惰性加载，仅一次） |
| `resetTmdbFilters()` | 重置所有筛选条件 |
| `renderTmdbFilters()` | 渲染完整筛选面板（HTML 字符串） |
| `loadTmdbResults()` | 异步加载影片数据并构建 API 请求 |
| `renderTmdbCards(items)` | 生成影片卡片（海报 + 评分 + 类型标签） |
| `renderTmdbPagination()` | 渲染智能分页（省略号逻辑） |
| `tmdbFetch(endpoint, params)` | 通用 TMDB API 请求 |
| `tmdbSearchVideo(title)` | 从分类页跳转到搜索 |

**筛选维度**:
- 类型切换（电影/电视剧/动漫/综艺）
- 流派（Genre，19 种电影 + 16 种电视剧）
- 国家/地区（12 个选项）
- 语言（11 个选项）
- 剧集状态（电视剧特有：已播完/拍摄中/连载中等）
- 年份（从当前年份回溯到 1960 年代，折叠展开）
- 评分（5 分以上 ~ 9 分以上）
- 排序（热门/评分/日期/名称等 8 种方式）

### 5.6 UI 工具 & 观看历史 - ui.js

**文件**: [ui.js](file:///e:/Code/JiunianTV/LeLeTV/js/ui.js)

**职责**: 全局 UI 工具函数、Toast 通知队列、Loading 状态、观看历史管理与渲染。

#### Toast 通知系统
```
showToast(message, type, duration)
  ↓
加入 toastQueue 队列
  ↓
showNextToast() → 先进先出依次显示
  ↓
支持类型: error / success / info / warning
```

#### 搜索历史管理

| 函数 | 说明 |
|------|------|
| `getSearchHistory()` | 获取搜索历史（兼容新旧格式） |
| `saveSearchHistory(query)` | 保存搜索历史（最长 5 条，2 个月过期） |
| `renderSearchHistory()` | 渲染历史标签（含时间 tooltip + 单条删除） |
| `clearSearchHistory()` | 清空所有搜索历史 |

#### 观看历史管理

| 函数 | 说明 |
|------|------|
| `getViewingHistory()` | 从 localStorage 获取观看历史 |
| `loadViewingHistory()` | 渲染分组历史（今天/昨天/本周/更早） |
| `renderHistoryCard(item)` | 渲染单条历史卡片（封面 + 标题 + 进度条） |
| `addToViewingHistory(videoInfo)` | 添加/更新观看历史（去重，最大 50 条） |
| `playFromHistory(url, title, episodeIndex, position)` | 从历史播放（含剧集同步） |
| `deleteHistoryItem(encodedUrl)` | 删除单条历史 |
| `clearViewingHistory()` | 清空全部历史 |

#### 其他工具

| 函数 | 说明 |
|------|------|
| `showLoading(message)` | 显示 Loading（30 秒自动关闭） |
| `hideLoading()` | 隐藏 Loading |
| `closeModal()` | 关闭详情弹窗 |
| `formatTimestamp(timestamp)` | 格式化时间为"X 分钟前/X 小时前" |
| `formatPlaybackTime(seconds)` | 格式化播放时间为 mm:ss |
| `clearLocalStorage()` | 清除全部本地存储（含确认弹窗） |
| `showImportBox(callback)` | 拖拽/选择文件导入框 |

### 5.7 密码保护 - password.js

**文件**: [password.js](file:///e:/Code/JiunianTV/LeLeTV/js/password.js)

**职责**: 前端密码验证系统，SHA-256 哈希比对，30 天验证有效期。

**关键函数**:

| 函数名 | 说明 |
|--------|------|
| `isPasswordProtected()` | 检查是否设置了有效的 PASSWORD（64 位哈希且非全零） |
| `isPasswordRequired()` | 检查是否强制要求密码 |
| `ensurePasswordProtection()` | 强制密码检查，不通过则弹出弹窗并抛异常 |
| `verifyPassword(password)` | 验证用户输入密码（SHA-256 哈希比对） |
| `isPasswordVerified()` | 检查验证状态是否有效（30 天 TTL） |
| `showPasswordModal()` | 显示密码弹窗 |
| `hidePasswordModal()` | 隐藏密码弹窗 |
| `initPasswordProtection()` | 页面加载时初始化密码保护 |

**验证流程**:
```
页面加载 → initPasswordProtection()
  ├── 无密码 → 显示提示弹窗（要求设置 PASSWORD）
  ├── 有密码 + 已验证 + 未过期 → 正常显示
  └── 有密码 + 未验证 → 显示输入弹窗
       ↓ 用户输入
  sha256(input) === window.__ENV__.PASSWORD ?
       ↓ YES                        ↓ NO
  保存验证状态(localStorage)   显示错误提示
  触发 'passwordVerified' 事件
```

### 5.8 代理鉴权 - proxy-auth.js

**文件**: [proxy-auth.js](file:///e:/Code/JiunianTV/LeLeTV/js/proxy-auth.js)

**职责**: 为代理请求添加基于密码哈希的鉴权参数，防止代理被未授权调用。

**关键函数**:

| 函数名 | 说明 |
|--------|------|
| `getPasswordHash()` | 获取密码哈希（优先级：缓存 → 验证状态 → 用户密码 → 环境变量） |
| `addAuthToProxyUrl(url)` | 为 URL 添加 `auth=<hash>&t=<timestamp>` 参数 |
| `validateProxyAuth(authHash, serverHash, ts)` | 验证鉴权（哈希 + 10 分钟时间戳窗口） |
| `clearAuthCache()` | 清除本地鉴权缓存 |

### 5.9 全局配置 - config.js

**文件**: [config.js](file:///e:/Code/JiunianTV/LeLeTV/js/config.js)（284 行）

**职责**: 定义全部全局常量和配置对象。

**配置对象一览**:

| 配置名 | 说明 |
|--------|------|
| `PROXY_URL` | 代理路径 `/proxy/` |
| `SEARCH_HISTORY_KEY` | 搜索历史 localStorage 键名 |
| `MAX_HISTORY_ITEMS` | 最大搜索历史条数 = 5 |
| `TMDB_WORKER_URL` | TMDB Worker 地址（从环境变量注入） |
| `PASSWORD_CONFIG` | 密码验证配置（存储键名、30 天 TTL） |
| `SITE_CONFIG` | 网站信息（名称、URL、版本、作者） |
| `API_SITES` | 21 个内置视频采集站 API 配置（含 adult 标记） |
| `AGGREGATED_SEARCH_CONFIG` | 聚合搜索配置（超时、分页、并发） |
| `API_CONFIG` | API 请求模板（search/detail path + headers） |
| `PLAYER_CONFIG` | 播放器配置（自动连播、广告过滤） |
| `ERROR_MESSAGES` | 错误信息本地化字典 |
| `SECURITY_CONFIG` | 安全配置（XSS 保护、URL 清理、最大搜索长度） |
| `CACHE_CONFIG` | 缓存管理配置（清理间隔、保留键名、临时键前缀） |
| `CUSTOM_API_CONFIG` | 自定义 API 配置（最大 5 个、URL 验证、缓存 2 个月） |
| `LOAD_BALANCER_CONFIG` | 负载均衡器配置（健康检查、失败阈值、冷却期） |

**内置 API 源列表（21 个）**:
- 普通（14 个）：dyttzy(电影天堂)、bdzy(百度资源)、moduzy(魔都资源)、zy360(360资源)、bfzy(暴风资源)、tyyszy(天涯资源)、wolong(卧龙资源)、jisu(极速资源)、dbzy(豆瓣资源)、mozhua(魔爪资源)、zuid(最大资源)、wujin(无尽资源)、mtzy(茅台资源)、ikun(iKun资源)、hnzy(红牛资源)
- 成人标记（7 个）：ckzy、fhzy、ywzy、mdzy、kgzy、nxzy、lbzy

### 5.10 负载均衡 - loadBalancer.js

**文件**: [loadBalancer.js](file:///e:/Code/JiunianTV/LeLeTV/js/loadBalancer.js)

**职责**: `LoadBalancer` 类，智能分配 API 请求，避免单一源过载，实现健康检查和故障转移。

**类结构**:
```
LoadBalancer
├── 属性:
│   ├── apiStats: Map<apiKey, ApiStat>
│   ├── healthCheckInterval: timer
│   ├── requestQueue: Map
│   └── activeRequests: Map
├── 初始化:
│   ├── constructor() → init() → loadStats() + initializeApiStats() + startHealthCheck()
│   └── createApiStat(apiKey) → { isHealthy, responseTime, successCount, ... }
├── 核心算法:
│   ├── getBestApi(preferredApis) → 过滤健康 → 评分排序 → 加权随机
│   ├── calculateApiScore(stat) → 基础 100 分 × 响应时间 × 成功率 - 负载惩罚 × ...
│   ├── isApiHealthy(stat) → 黑名单? 连续失败? 成功率? 响应时间?
│   └── selectBestFromCandidates() → 加权随机选择
├── 状态记录:
│   ├── recordApiResult(apiKey, success, responseTime, error)
│   ├── increaseApiLoad(apiKey) / decreaseApiLoad(apiKey)
│   └── isApiOverloaded(apiKey) → 超并发限制?
├── 健康检查:
│   ├── startHealthCheck() → 每 5 分钟执行 performHealthCheck()
│   └── checkApiHealth(apiKey) → 搜索"test" → 记录结果
└── 持久化:
    ├── saveStats() → localStorage
    └── loadStats() → 恢复统计数据
```

**评分公式**:
```
score = 基础 100 分
     × (响应时间评分: max(0, 100 - avgResponseTime/100) / 100)
     × (成功率: successCount / totalRequests)
     - (负载惩罚: min(load × 10, 50))
     × (优先级加成: priority × 1.2)
     × (连续失败惩罚: 0.8^consecutiveFailures)
     × (最近成功加成: 1.2, 若 1 分钟内成功过)
```

**黑名单机制**:
- 连续失败 ≥ 5 次 → 加入黑名单
- 冷却期：10 分钟
- 冷却后自动恢复评估

### 5.11 负载均衡 UI - loadBalancerUI.js

**职责**: 渲染负载均衡器状态面板，实时显示各 API 源的健康状态、成功率、响应时间和负载情况。

### 5.12 缓存管理 - cache-manager.js

**文件**: [cache-manager.js](file:///e:/Code/JiunianTV/LeLeTV/js/cache-manager.js)

**职责**: `CacheManager` 类，自动清理 localStorage 中的过期临时数据。

**清理规则**:
- **保留数据**：selectedAPIs、customAPIs、yellowFilterEnabled、adFilteringEnabled、hasInitializedDefaults、viewingHistory、videoSearchHistory、passwordVerified
- **清理目标**：videoProgress_*、lastPageUrl、currentPlayingId 等临时键
- **清理间隔**：24 小时
- **TTL**：临时数据 24 小时过期
- **手动触发**：`cacheManager.manualCleanup()`
- **自动触发**：每 24 小时定时器自动检查

### 5.13 版本管理

模块由 3 个文件协作完成：

**version-utils.js**: 版本号格式转换工具
- `convertToSemanticVersion(numericVersion)` - 将 `YYYYMMDDHHMM` 转换为 `vN.Y.X.Z` 语义化版本
- `updateFooterVersion()` - 从 CHANGELOG.md 获取版本并更新到页脚

**version-check.js**: 版本检测逻辑
- `formatVersion(versionString)` - 格式化版本号显示
- `parseChangelogMarkdown(markdownContent)` - 解析 CHANGELOG.md 为版本条目数组
- `getLatestVersionFromChangelog()` - 提取 CHANGELOG 中最新版本号

**version-updater.js**: 版本更新自动检测
- `checkForUpdates()` - 对比 CHANGELOG 版本与 localStorage 记录
- `initFooterBtn()` - 初始化页脚版本显示 + 更新按钮
- `performUpdate()` - 执行更新（清除 SW 缓存 + 清除 browser cache + 重载）
- `setupSwUpdateListener()` - 监听 SW 更新消息

### 5.14 其他模块

| 文件 | 说明 |
|------|------|
| `api.js` | API 请求工具函数封装 |
| `sha256.js` | 纯 JS SHA-256 实现（备用，优先使用 Web Crypto API） |
| `customer_site.js` | 第三方资源共享扩展（`CUSTOMER_SITES` 对象，通过 `extendAPISites()` 合并到 `API_SITES`） |
| `watch.js` | 播放中转页面逻辑（解析 URL 参数 → 重定向到 player.html） |
| `index-page.js` | 首页初始化（使用说明弹窗 + URL 搜索参数 `/s=keyword` 处理） |

---

## 6. 服务端

### 6.1 本地服务器 - server.mjs

**文件**: [server.mjs](file:///e:/Code/JiunianTV/LeLeTV/server.mjs)（412 行）

**职责**: Node.js + Express 本地开发服务器。

**路由表**:

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` `/index.html` `/player.html` | GET | HTML 模板注入（密码哈希 + TMDB URL + 版本号） |
| `/s=:keyword` | GET | 搜索页面渲染 |
| `/proxy/:encodedUrl` | GET | 视频源代理（含鉴权、URL 安全验证、重试逻辑、响应头过滤） |
| `/api/tmdb` | GET | TMDB API 代理（支持 Worker 转发 + 直连两种模式） |
| `/api/version` | GET | 返回当前版本号 JSON |
| 静态资源 | - | express.static 服务所有文件 |

**模板注入流程**（`renderPage()`）:
```
读取 HTML 文件 → 替换占位符:
  {{PASSWORD}}      → sha256(password)
  {{ADMINPASSWORD}}  → sha256(adminPassword)
  {{TMDB_WORKER_URL}} → config.tmdbWorkerUrl
  {{LELETV_VERSION}} → VERSION.txt 内容
```

**代理安全机制**:
1. **URL 验证（`isValidUrl()`）**：仅允许 http/https，阻止 localhost/内网 IP
2. **鉴权验证（`validateProxyAuth()`）**：SHA-256 哈希匹配 + 10 分钟时间戳窗口
3. **超时控制**：默认 5000ms
4. **重试机制**：默认 2 次
5. **响应头过滤**：移除 CSP、Cookie、Set-Cookie 等敏感头

### 6.2 Cloudflare Worker - tmdb-worker.js

**文件**: [tmdb-worker.js](file:///e:/Code/JiunianTV/LeLeTV/workers/tmdb-worker.js)

**职责**: 部署在 Cloudflare Workers 上的 TMDB API 代理。

**核心功能**:
- `/health` → 健康检查端点
- `?endpoint=discover/movie&...` → 两种方式传递端点参数
- API Key 通过 Worker 环境变量 `TMDB_API_KEY` 安全注入
- 端点白名单：仅允许 `discover/`、`search/`、`genre/`、`movie/`、`tv/` 等前缀
- CORS 全开（`Access-Control-Allow-Origin: *`）
- 响应缓存策略：`max-age=120, stale-while-revalidate=600`

### 6.3 Cloudflare Pages Functions

**目录**: `api/proxy/[...path].mjs`

**职责**: Cloudflare Pages 上的视频代理函数（通配路由），在生产环境中替代 Node.js 的 `/proxy` 路由。

---

## 7. PWA & Service Worker

**文件**: [service-worker.js](file:///e:/Code/JiunianTV/LeLeTV/service-worker.js)

**缓存策略**:

| 缓存名 | 内容 | 策略 |
|--------|------|------|
| `leletv-cache-{version}` | 静态资源（HTML/CSS/JS） | 预缓存 + 版本变更清理 |
| `leletv-api-{version}` | API 代理响应 | 最多 50 条 |
| `leletv-images-{version}` | 图片资源 | 最多 100 张 |

**版本更新机制**:
1. 新版本 SW 安装 → 激活 → 发送 `SW_UPDATED` 消息到页面
2. 页面收到消息 → 设置 `hasNewVersion = true` → 页脚按钮变为「立即更新」
3. 用户点击更新 → 清除 SW 缓存 + 注销 SW + 带时间戳重载

**Manifest 文件**: `manifest.json` - PWA 配置（名称、图标、主题色、显示模式，`display_override: ["window-controls-overlay"]`）

---

## 8. 构建系统与脚本

**构建命令**: `npm run build`
```
1. node scripts/generate-version.mjs
   → 生成时间戳版本号 (YYYYMMDDHHMM)
   → 写入 VERSION.txt
   → 替换 HTML 中 {{LELETV_VERSION}} 占位符
   → 更新 service-worker.js 中 CACHE_VERSION
   → 为 CSS/JS 引用添加 ?v= 缓存参数
2. tailwindcss -i ./css/tailwind.css -o ./css/output.css --minify
   → 编译 Tailwind CSS 并压缩
```

**其他脚本**:

| 脚本 | 说明 |
|------|------|
| `create-tag.js` | 创建 Git 版本标签 |
| `changelog-updater.js` | 更新 CHANGELOG.md |
| `version-tracker.js` | 版本追踪 |
| `create-historical-releases.js` | 创建历史 Release |
| `create-releases.ps1` | PowerShell 发布脚本 |

**版本号格式**: `v{年偏移}.{月}.{日}.{当日提交序号}`
- 年偏移：2025 = 1，2026 = 2，依此类推
- 例如 `v2.5.20.2` = 2026 年 5 月 20 日第 2 次提交

---

## 9. 数据流

### 9.1 搜索数据流

```
用户输入关键词
  ↓
search() (app.js)
  ├── 密码验证 (ensurePasswordProtection)
  ├── 保存搜索历史 (saveSearchHistory)
  ├── 显示骨架屏 (generateSkeletonCards)
  ├── 并发请求所有选中 API 源
  │   └── searchByAPIAndKeyWord(apiId, query) (search.js)
  │       ├── 查缓存 (5min TTL)
  │       ├── 构建 API URL
  │       ├── ProxyAuth.addAuthToProxyUrl()
  │       ├── 请求代理 URL → LoadBalancer 记录结果
  │       ├── 处理第 1 页 → 并发获取 2~3 页
  │       └── 写入缓存 → 返回带来源标记的结果
  ├── 黄色内容过滤（如启用，涉及 ADMINPASSWORD 验证）
  ├── 渐进式渲染卡片 (insertAdjacentHTML)
  ├── 最终排序（按名称）
  └── 更新 URL (pushState)
```

### 9.2 播放数据流

```
点击搜索结果
  ↓
playDirectly() / showDetails()
  ├── 构建 API 参数 (source, customApi)
  ├── fetch /api/detail?id=...（服务端代理）
  ├── 获取 episodes 数组
  ├── 保存状态到 localStorage
  └── 跳转 player.html?url=...&title=...&source=...
```

```
player.html 加载
  ↓
initializePageContent() (player.js)
  ├── 解析 URL 参数
  ├── 从 localStorage 恢复状态
  ├── 获取 TMDB 详情增强（异步）
  ├── initPlayer(videoUrl) → ArtPlayer + HLS.js
  │   ├── CustomHlsJsLoader（广告过滤）
  │   ├── 恢复播放进度（URL position > localStorage progress）
  │   ├── Media Session API 元数据
  │   └── 定期保存进度（30s 间隔）
  └── renderEpisodes / renderPlayerDetailInfo / updateMediaSession
```

### 9.3 TMDB 分类数据流

```
进入分类页面
  ↓
switchPage('category') → handlePageLoad('category')
  ↓
initTmdbCategory()（惰性加载，仅一次）
  ├── resetTmdbFilters()
  ├── renderTmdbFilters() → 生成筛选面板 HTML
  └── loadTmdbResults() → 发起 TMDB API 请求
      ├── tmdbFetch('discover/movie', params)
      │   └── GET TMDB_WORKER_URL?endpoint=...&...
      ├── renderTmdbCards(results)
      └── renderTmdbPagination()
```

---

## 10. 关键设计模式

| 模式 | 实现 | 位置 |
|------|------|------|
| **单例模式** | `LoadBalancer` / `CacheManager` 全局实例 | loadBalancer.js / cache-manager.js |
| **观察者模式** | `passwordVerified` 自定义事件触发播放器初始化 | password.js → player.js |
| **策略模式** | 数据源选择逻辑（`applyNewDataSourceLogic` v1 策略） | app.js |
| **代理模式** | 视频请求通过 `/proxy/` 中转、TMDB 通过 Worker 中转 | server.mjs / tmdb-worker.js |
| **队列模式** | Toast 通知队列（`toastQueue` 先进先出） | ui.js |
| **节流/防抖** | 搜索节流锁（`_searchThrottled`）、进度保存防抖（30s） | app.js / player.js |
| **惰性加载** | TMDB 分类页面首次访问才初始化（`isLoaded` 标记） | tmdb.js |

---

## 11. 环境变量配置

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `PASSWORD` | **是** | 用户访问密码（明文，服务端做 SHA-256 后注入页面） |
| `ADMINPASSWORD` | 否 | 管理员密码（控制黄色内容过滤开关） |
| `TMDB_WORKER_URL` | 推荐 | Cloudflare Worker 地址 |
| `TMDB_API_KEY` | 否 | TMDB API v3 密钥（本地直连时使用，生产配在 Worker 中） |
| `PORT` | 否 | 本地服务器端口（默认 8080） |
| `CORS_ORIGIN` | 否 | CORS 允许的源（默认 *） |
| `REQUEST_TIMEOUT` | 否 | 请求超时毫秒（默认 5000） |
| `MAX_RETRIES` | 否 | 最大重试次数（默认 2） |
| `CACHE_MAX_AGE` | 否 | 静态资源缓存时间（默认 1d） |
| `USER_AGENT` | 否 | 代理请求 UA |
| `DEBUG` | 否 | 调试模式（默认 false） |

---

## 12. 缓存策略

### 12.1 浏览器缓存（`_headers` 文件，Cloudflare Pages）

| 文件类型 | Cache-Control | 说明 |
|---------|--------------|------|
| `.html` | `no-cache` | 每次请求回源校验 |
| `CHANGELOG.md` | `no-cache` | 实时获取最新版本 |
| `.css` `.js` 图片 | `public, max-age=604800, immutable` | 缓存 7 天，配合 `?v=` 缓存破坏 |

### 12.2 应用层缓存

| 缓存 | 存储位置 | TTL | 说明 |
|------|---------|-----|------|
| 搜索结果缓存 | 内存 Map | 5 分钟 | `_searchCache` 对象 |
| 密码验证状态 | localStorage | 30 天 | `passwordVerified` |
| 搜索历史 | localStorage | 2 个月 | `videoSearchHistory` |
| 观看历史 | localStorage | 永久（最多 50 条） | `viewingHistory` |
| API 统计 | localStorage | 永久（持久化） | `loadBalancerStats` |
| 临时数据 | localStorage | 24 小时自动清理 | `videoProgress_*` 等 |
| SW 缓存 | Cache Storage | 版本更新时清理 | 静态资源和服务端响应 |

---

## 13. 安全机制

| 层级 | 机制 | 说明 |
|------|------|------|
| **身份验证** | SHA-256 密码哈希 | 客户端/服务端双重验证 |
| **代理鉴权** | 时间戳 + 哈希参数 | 10 分钟有效期防重放 |
| **URL 安全** | `isValidUrl()` 白名单 | 阻止 SSRF（localhost/内网 IP） |
| **XSS 防护** | 输出编码 | `_buildSearchCardsHtml` 中的 HTML 转义 |
| **HTTP 头** | `X-Content-Type-Options` | `nosniff` |
| | `X-Frame-Options` | `SAMEORIGIN` |
| | `X-XSS-Protection` | `1; mode=block` |
| **CORS** | 服务端 cors 中间件 | 可配置 origin |
| **输入限制** | 搜索最大长度 100 字符 | `SECURITY_CONFIG.maxQueryLength` |
| **环境变量** | 密码不提交代码 | 通过 `.env` + Cloudflare 环境变量管理 |

---

## 14. 错误处理策略

| 层级 | 策略 | 实现 |
|------|------|------|
| **搜索** | 单个 API 失败不影响其他源 | try-catch 包裹每个 API 请求 |
| **搜索** | 超时控制 | AbortController + 15 秒超时 |
| **搜索** | 降级方案 | 无 LoadBalancer 时使用传统搜索 |
| **播放器** | HLS 致命错误分级处理 | NETWORK → 重新加载, MEDIA → recoverMediaError |
| **播放器** | 连续错误计数 | 错误超过 3 次才显示用户提示 |
| **网络请求** | axios 重试逻辑 | `maxRetries` 配置（默认 2 次） |
| **localStorage** | try-catch 包裹所有读写操作 | 防止隐私模式下 QuotaExceededError |
| **Loading** | 30 秒自动关闭 | 防止无限 Loading |
| **Toast** | 队列机制 | 避免多个 Toast 同时显示 |
| **密码保护** | 关键操作前强制检查 | `ensurePasswordProtection()` 抛异常拦截 |

---

## 15. AI 开发集成

本项目通过 **GitNexus MCP** 实现 AI 编辑器深度集成：

### GitNexus 索引

| 指标 | 数据 |
|------|------|
| 索引版本 | GitNexus v1.6.5 |
| 符号数 | 1809 |
| 关系数 | 3031 |
| 集群数 | 57 |
| 执行流 | 133 |

### MCP 工具列表

| 工具名 | 用途 |
|--------|------|
| `gitnexus_query` | 语义化搜索代码概念和执行流 |
| `gitnexus_context` | 获取符号的完整上下文（调用者/被调用者/执行流） |
| `gitnexus_impact` | 影响范围分析（上游/下游/双向） |
| `gitnexus_detect_changes` | 变更检测（提交前验证） |
| `gitnexus_rename` | 基于调用图的符号重命名 |
| `gitnexus_cypher` | 直接查询知识图谱 |

### 技能文件

| 文件 | 说明 |
|------|------|
| `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` | 架构探索 |
| `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` | 影响范围分析 |
| `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` | 调试辅助 |
| `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` | 重构辅助 |
| `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` | 工具与资源参考 |
| `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` | CLI 命令参考 |

---

> 本文档基于项目源代码和 GitNexus 知识图谱生成，涵盖 LeLeTV 项目的完整架构、模块职责、关键函数、数据流和运维配置。版本 v2.5.20.2。
