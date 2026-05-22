# LeLeTV - 乐乐影视

<div align="center">
  <img src="image/logo.png" alt="LeLeTV Logo" width="180">
  <br>
  <p><strong>私有学习项目，禁止公开使用</strong></p>
</div>

<p align="center">
  <a href="https://leletv.776645.xyz" target="_blank">在线访问</a> · 
  <a href="#-功能特性">功能特性</a> · 
  <a href="#-技术栈">技术栈</a> · 
  <a href="#-部署指南">部署指南</a> ·
  <a href="#-目录结构">目录结构</a>
</p>

---

## 项目简介

LeLeTV 是一个自用的在线视频搜索与观看平台，仅用于个人学习和技术研究。项目以**纯前端单页应用（SPA）**为核心，聚合 21 个第三方视频采集站 API 实现搜索和播放，通过 **TMDB（The Movie Database）** 提供分类浏览、影片详情和智能筛选功能。

部署采用 **Cloudflare Pages + Cloudflare Workers** 的纯静态+无服务器架构，无需后端服务器即可运行。

<div align="center">
  <img src="image/image-screenshot.png" alt="项目截图" width="800">
</div>

### 项目规模

| 指标 | 数据 |
|------|------|
| JS 模块 | 19 个核心模块，约 2390 行最大模块（player.js） |
| CSS 样式 | 4 个手写样式文件（3794 行）+ Tailwind 编译 |
| 搜索源 | 21 个内置采集站 API（含 7 个隐藏标记） |
| 页面数 | 4 个独立 HTML 文件（SPA 主页面 + 3 个独立页面）|
| 部署配置 | Cloudflare Pages + Workers + Functions |

## 重要声明

- 本项目**仅供个人学习使用**，禁止用于任何商业用途
- 本项目**必须设置密码保护**，禁止公开分享或部署为公共服务
- 如因违反上述规定导致的任何法律问题，使用者需自行承担责任
- 本项目开发者不对用户的使用行为承担任何法律责任

## 密码保护

所有部署都必须设置 `PASSWORD` 环境变量，否则用户将看到设置密码的提示。

您还可以设置 `ADMINPASSWORD` 环境变量来启用隐藏内容过滤功能的管理权限。

> 注意：在 Cloudflare Pages 部署时，密码通过 Pages Functions Middleware 注入到 HTML 模板中，前端使用 SHA-256 哈希进行代理认证。

## 功能特性

### 视频搜索
- 聚合 21 个第三方视频采集站 API，支持多源并发搜索
- 搜索结果内存缓存（5 分钟 TTL），减少重复请求
- 最近搜索历史记录（最多保留 5 条，2 个月过期）
- **智能负载均衡**：动态评分算法（响应时间 x 成功率 ÷ 负载），自动故障转移
- **隐藏内容过滤**：可选开启，管理员密码保护开关

### TMDB 分类浏览
- 通过 TMDB API 获取影片数据，支持 **电影 / 电视剧 / 动漫 / 综艺** 四大类型
- **多维筛选**：按类型流派（Genre，19+16 种）、年份（含折叠展开）、评分、语言（11 种）、国家（12 个）、剧集状态进行过滤
- 多种排序方式：热门程度、评分高低、上映日期、名称排序等 8 种
- 智能分页（省略号逻辑），响应式网格布局

### 视频播放
- 基于 **ArtPlayer**（集成 HLS.js）的播放器，支持 M3U8 流媒体
- **多资源切换**：播放时可在不同视频源之间切换，实时测试并显示各源延迟
- **上下集切换**：支持剧集导航 + 键盘快捷键（Alt+左/右）
- **自动连播**：当前集播放结束后自动播放下一集
- **广告过滤**：自定义 HLS.js Loader 拦截 M3U8 分片广告
- **手机横屏自动全屏**：检测设备方向自动进入全屏
- **长按二倍速**：桌面鼠标 + 移动端触摸支持
- **进度恢复**：自动保存播放进度，支持精确进度条拖拽
- **Media Session API**：系统媒体控制中心集成
- **Window Controls Overlay**：PWA 模式下实现原生窗口控制栏

### 智能负载均衡
- **动态评分算法**：基础 100 分 × 响应时间评分 × 成功率 − 负载惩罚 + 优先级加成
- **定期健康检查**：每 5 分钟自动检查所有 API 源健康状态
- **黑名单机制**：连续失败 ≥ 5 次自动冷却 10 分钟，到期重新评估
- **可视化状态面板**：实时显示各 API 源的健康状态、成功率、响应时间和负载情况

### 智能缓存管理
- 自动清理过期的临时数据（24 小时间隔），释放存储空间
- 保护用户设置和历史记录（选中的 API 源、观看历史等）
- 支持手动触发缓存清理

### 观看历史
- 自动记录观看进度（集数和播放位置），30 秒防抖保存
- 分组式卡片布局（今天 / 昨天 / 本周 / 更早），左侧封面右侧内容
- 进度条显示观看完成度
- 支持单条删除和清空全部，最多保留 50 条

### 用户界面
- **HarmonyOS 深色调色板**：纯黑背景 + 霓虹粉（#ec4899）主色调
- 完整的响应式设计系统（xs/sm/md/lg 四档断点）
- 所有交互元素带按压反馈动画（scale 0.97）
- 骨架屏加载态、Toast 通知队列
- 赛博朋克/霓虹美学风格，克制使用单色

### PWA 支持
- 支持安装为桌面/移动应用（`display: standalone` + `window-controls-overlay`）
- Service Worker 三缓存策略（静态资源 / API 响应 / 图片）
- 版本检测自动提示更新（Cache Storage 版本化）

### 自定义 API
- 支持用户手动添加自定义视频采集站 API（最多 5 个，URL 格式校验）
- 可删除和管理已添加的自定义源（2 个月缓存）

### 版本管理
- 语义化版本号格式 `v{年偏移}.{月}.{日}.{当日提交序号}`
- 自动版本检测与更新提示（清除 SW 缓存 + 重载页面）
- 关于页面内嵌完整更新日志（从 CHANGELOG.md 动态加载）

## 技术栈

| 层 | 技术 | 说明 |
|------|------|------|
| **前端** | HTML5 + CSS3 + JavaScript (ES6+) | 无框架，纯原生 JS |
| **样式** | Tailwind CSS 3.4 + PostCSS | HarmonyOS 深色调色板 |
| **播放器** | ArtPlayer + HLS.js v1.x | M3U8 流媒体 + 广告过滤 |
| **后端（本地开发）** | Node.js + Express 5.x | 静态服务 + 视频代理 + TMDB 代理 |
| **部署平台** | Cloudflare Pages | 纯静态资源托管 |
| **无服务器函数** | Cloudflare Workers | TMDB API 代理 |
| **Pages Functions** | Cloudflare Pages Functions | 密码注入 + 视频代理 |
| **PWA** | Service Worker + Web App Manifest | 离线缓存 + 可安装 |
| **密码安全** | SHA-256 哈希（Web Crypto API） | 客户端 + 服务端双重验证 |
| **构建工具** | Node.js 脚本 + npm scripts | 版本生成、Tailwind 构建 |
| **AI 辅助开发** | GitNexus MCP | 代码知识图谱索引 |

### 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| axios | ^1.9.0 | HTTP 请求（服务端代理） |
| cors | ^2.8.5 | CORS 中间件 |
| dotenv | ^16.5.0 | 环境变量加载 |
| express | ^5.1.0 | Web 服务器 |
| node-fetch | ^3.3.2 | 服务端 fetch |

### 第三方前端库

| 文件 | 说明 |
|------|------|
| `libs/artplayer.min.js` | ArtPlayer 播放器核心 |
| `libs/hls.min.js` | HLS.js 流媒体引擎（由 ArtPlayer 按需加载） |
| `libs/sha256.min.js` | js-sha256 备用（优先使用 Web Crypto API） |

## 架构说明

### 生产部署架构（Cloudflare）

```
用户浏览器
    │
    ├── Cloudflare Pages ─────────── 静态资源（HTML/CSS/JS）
    │       ├── Pages Functions ──── 密码注入（环境变量 → HTML 模板）
    │       └── Pages Functions ──── 视频代理（/proxy/*）
    │
    ├── Cloudflare Worker ────────── TMDB API 代理
    │       └── workers/tmdb-worker.js ──── TMDB API v3
    │       └── /health 健康检查端点
    │
    ├── 第三方采集站 API (21 个) ──── 视频搜索和播放源
    │       └── 通过 Cloudflare Pages Functions 代理
    │
    └── TMDB API ────────────────── 影片元数据
            └── api.themoviedb.org
```

### 本地开发架构

```
用户浏览器
    │
    ├── Node.js + Express（server.mjs: 412 行）
    │       ├── 静态资源服务（express.static）
    │       ├── / → HTML 模板注入（密码哈希、TMDB_URL、版本号）
    │       ├── /proxy/:encodedUrl → 视频源代理（鉴权 + URL 安全验证）
    │       ├── /api/tmdb → TMDB API 代理
    │       └── /api/version → 版本号 API
    │
    └── 第三方采集站 API ──── 视频搜索和播放源
```

### SPA 页面路由

| 页面 | 路由 | DOM 容器 | 说明 |
|------|------|----------|------|
| 首页（搜索） | `/` | `#page-home` | 视频搜索 + 最近搜索历史 |
| 分类浏览 | JS 切换 | `#page-category` | TMDB 分类 + 多维筛选 |
| 观看历史 | JS 切换 | `#page-history` | 分组展示 + 进度条 |
| 设置 | JS 切换 | `#page-settings` | 数据源、自定义 API、功能开关 |
| 关于 | JS 切换 | `#page-about` | 隐私政策 + 更新日志 |
| 播放器 | `/player.html` | 独立页面 | ArtPlayer 全屏播放（2390 行 JS） |

### JS 加载顺序（index.html）

```
libs/sha256.min.js              ← SHA-256 工具库
js/config.js                    ← 全局配置（最先加载，定义常量与 API 列表）
js/proxy-auth.js                ← 代理鉴权（密码哈希 + 时间戳）
js/loadBalancer.js              ← 负载均衡核心（自动实例化）
js/loadBalancerUI.js            ← 负载均衡状态面板 UI
js/ui.js                        ← UI 工具（Toast / Loading / 历史管理）
js/api.js                       ← API 请求工具
js/password.js                  ← 密码保护系统
js/search.js                    ← 搜索模块
js/tmdb.js                      ← TMDB 分类浏览
js/app.js                       ← 主入口（初始化所有逻辑，1765 行）
js/version-utils.js             ← 版本工具函数
js/version-updater.js           ← 版本更新自动检测
js/index-page.js                ← 首页弹窗 + URL 搜索参数
```

## 部署指南

### 第一步：获取 TMDB API 密钥

TMDB（The Movie Database）提供免费的影片数据 API，获取密钥的步骤如下：

1. 访问 [TMDB 官网](https://www.themoviedb.org/)，点击右上角 **加入 TMDB**，注册账号并验证邮箱
2. 登录后，点击右上角头像 → **账户设置**
3. 在左侧菜单找到 **API**，点击 **请求 API 密钥** 下方的 "click here"
4. 选择 **Developer** 类型（免费），填写申请表单：
   - **用途/名称**：例如 "LeLeTV Personal Use"
   - **应用 URL**：选填，可填你的 Pages 域名
   - **简介**：可填 "Meet personalized needs, enrich website interfaces and functions"
5. 提交后即可看到你的 **API 密钥 (v3 auth)**，复制保存备用

> TMDB API 密钥是免费的，个人使用足够。申请后立即生效，无需等待审核。

### 第二步：部署 Cloudflare Worker（TMDB 代理）

TMDB API 在前端直接调用会遇到跨域限制，需要通过 Cloudflare Worker 中转：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages**
2. 点击 **创建应用程序** → **创建 Worker**
3. 给 Worker 命名（例如 `leletv-tmdb-proxy`），点击 **部署**
4. 部署后点击 **编辑代码**，将项目 `workers/tmdb-worker.js` 的全部内容粘贴覆盖默认代码，点击 **保存并部署**
5. 回到 Worker 页面，进入 **设置** → **变量**：
   - 在 **环境变量** 栏，添加变量名 `TMDB_API_KEY`，值填入第一步获取的 API 密钥
   - 点击 **保存并部署**
6. （可选，但推荐）绑定自定义域名：
   - 在 Worker **设置** → **触发器** → **自定义域名**，添加一个你拥有的域名（如 `tmdb-proxy.yourdomain.com`）
   - 没有自定义域名也可以使用 Cloudflare 提供的 `*.workers.dev` 域名
7. 记录 Worker 的访问地址，例如：
   - 自定义域名：`https://tmdb-proxy.yourdomain.com`
   - workers.dev 域名：`https://leletv-tmdb-proxy.xxx.workers.dev`

> **验证 Worker 是否正常工作**：在浏览器中访问 `https://你的worker域名/health`，返回 `{"status":"ok"}` 即表示部署成功。

### 第三步：部署 Cloudflare Pages（前端）

1. Fork 或克隆本仓库到你的 GitHub 账户
2. 进入 **Cloudflare Dashboard** → **Workers & Pages** → **创建应用程序** → **Pages** → **连接到 Git**
3. 授权并选择你的仓库
4. 构建设置：
   - **构建命令**：`npm run build`
   - **输出目录**：`dist`
   - **根目录**：`/`（使用默认即可）
5. 点击 **保存并部署**，首次部署会自动运行
6. 部署完成后，进入 Pages 项目的 **设置** → **环境变量**，添加以下变量：

   | 变量名 | 必填 | 值 |
   |--------|------|-----|
   | `PASSWORD` | **是** | 设置你的访问密码（纯文本，前端会做 SHA-256 哈希验证）|
   | `TMDB_WORKER_URL` | 推荐 | 第二步中记录的 Worker 地址，例如 `https://tmdb-proxy.yourdomain.com` |
   | `ADMINPASSWORD` | 否 | 管理员密码，用于管理隐藏内容过滤 |

7. 添加完成后，进入 Pages **部署** 页面，点击最后一个部署的 **...** → **重试部署**，让新环境变量生效

> **注意**：
> - 部署前端时必须设置 `PASSWORD` 变量，否则页面会一直提示设置密码
> - `TMDB_WORKER_URL` **不要加末尾斜杠**
> - `TMDB_API_KEY` 是 Worker 的环境变量，**不要**填到 Pages 的环境变量中

> **提示**：每次构建时会自动运行 `generate-version.mjs` 脚本，生成基于时间戳的版本号，更新 HTML 中的资源缓存参数和 Service Worker 缓存版本。

### 验证整个流程

部署完成后，按以下顺序验证：
1. 访问你的 Pages 域名（如 `https://你的项目.pages.dev`），应该弹出密码验证
2. 输入你在 `PASSWORD` 中设置的密码，进入首页
3. 点击导航栏的 **分类** 按钮，应该能看到 TMDB 的电影/电视剧列表
4. 如果分类页面无法加载内容，检查：
   - Worker 的 `/health` 端点是否返回 `{"status":"ok"}`
   - Pages 的 `TMDB_WORKER_URL` 是否填写正确（不要末尾斜杠）
   - Worker 的 `TMDB_API_KEY` 是否已正确设置

### 本地开发部署

```bash
# 克隆项目
git clone https://github.com/JiuNian090/leletv.git
cd leletv

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，设置 PASSWORD 等变量

# 构建样式
npm run build

# 启动开发服务器（带热重载）
npm run dev

# 访问应用
# http://localhost:8080
```

## 环境变量配置

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `PASSWORD` | **是** | 用户访问密码（明文，服务端做 SHA-256 后注入页面） |
| `ADMINPASSWORD` | 否 | 管理员密码（控制隐藏内容过滤开关） |
| `TMDB_WORKER_URL` | 推荐 | Cloudflare Worker 地址（`TMDB_API_KEY` 配置在 Worker 环境变量中） |
| `TMDB_API_KEY` | 否 | TMDB API v3 密钥（本地直连时使用，生产环境配在 Worker 中） |
| `PORT` | 否 | 本地服务器端口（默认 8080） |
| `CORS_ORIGIN` | 否 | CORS 允许的源（默认 *） |
| `REQUEST_TIMEOUT` | 否 | 请求超时毫秒（默认 5000） |
| `MAX_RETRIES` | 否 | 最大重试次数（默认 2） |
| `CACHE_MAX_AGE` | 否 | 静态资源缓存时间（默认 1d） |
| `USER_AGENT` | 否 | 代理请求 UA |
| `DEBUG` | 否 | 调试模式（默认 false） |

## 目录结构

```
LeLeTV/
├── api/                          # Cloudflare Pages Functions
│   └── proxy/[...path].mjs       #   视频代理（通配路由）
├── css/                          # 样式文件（3794 行手写）
│   ├── styles.css                #   全局样式（2335 行，含首页、搜索、设置、关于等）
│   ├── player.css                #   播放器页面（1248 行）
│   ├── watch.css                 #   中转页面（229 行）
│   ├── tailwind.css              #   Tailwind 入口（3 行）
│   └── output.css                #   Tailwind 编译输出（压缩版）
├── docs/
│   └── VERSION_RULES.md          #   版本号规则说明
├── functions/                    # Vercel/Netlify 兼容中间件
│   ├── _middleware.js            #   密码注入
│   └── proxy/[[path]].js         #   代理函数
├── image/                        # 图片资源
│   ├── logo.png                  #   网站 Logo
│   ├── logo-black.png            #   PWA 图标
│   └── nomedia.png               #   无封面占位图
├── js/                           # 19 个核心模块
│   ├── config.js                 #   全局常量与配置（284 行）
│   ├── app.js                    #   主入口（1765 行）
│   ├── player.js                 #   播放器（2390 行，最大模块）
│   ├── search.js                 #   视频搜索
│   ├── tmdb.js                   #   TMDB 分类浏览
│   ├── ui.js                     #   UI 工具（Toast/Loading/历史）
│   ├── loadBalancer.js           #   负载均衡核心（类实现）
│   ├── loadBalancerUI.js         #   负载均衡状态面板 UI
│   ├── cache-manager.js          #   智能缓存管理（类实现）
│   ├── password.js               #   密码保护系统
│   ├── proxy-auth.js             #   代理请求鉴权
│   ├── api.js                    #   API 请求工具函数
│   ├── index-page.js             #   首页弹窗 + URL 搜索参数
│   ├── version-updater.js        #   版本更新自动检测
│   ├── version-utils.js          #   版本号格式转换
│   └── sha256.js                 #   SHA-256 备用实现
├── libs/                         # 第三方库
│   ├── artplayer.min.js          #   ArtPlayer 播放器
│   ├── hls.min.js                #   HLS.js
│   └── sha256.min.js             #   js-sha256
├── scripts/                      # 自动化脚本
│   ├── generate-version.mjs      #   版本号生成
│   ├── create-tag.js             #   Git 标签创建
│   ├── changelog-updater.js      #   CHANGELOG 维护
│   ├── version-tracker.js        #   版本跟踪
│   └── ...（共 9 个脚本）
├── workers/
│   └── tmdb-worker.js            #   Cloudflare Worker 脚本
├── .claude/                      # GitNexus 技能文件
│   └── skills/gitnexus/          #   6 个技能（exploring/impact/debug 等）
├── .env                          # 本地环境变量（不提交）
├── .env.example                  # 环境变量模板
├── .gitignore
├── .trae/                        # Trae IDE 配置
│   ├── .ignore
│   └── skills/leletv-ai-developer/SKILL.md
├── _headers                      # CF Pages 缓存头策略
├── index.html                    # SPA 主入口
├── player.html                   # 播放器独立页面
├── manifest.json                 # PWA Manifest
├── middleware.js                  # Vercel 中间件
├── package.json                  # 项目配置
├── postcss.config.js             # PostCSS 配置
├── server.mjs                    # Node.js 本地服务器（412 行）
├── service-worker.js             # Service Worker
├── tailwind.config.js            # Tailwind CSS 配置
├── wrangler.toml                 # Cloudflare Workers 配置
├── AGENTS.md                     # AI 代理指南
├── CLAUDE.md                     # Claude 集成配置
├── CODE_WIKI.md                  # 代码 Wiki
├── LICENSE                       # Apache-2.0
├── CHANGELOG.md                  # 更新日志
├── CONTRIBUTING.md               # 贡献说明
└── README.md                     # 本文件
```

## 版本管理

项目采用语义化版本号格式：`v{年偏移}.{月}.{日}.{当天提交序号}`

- **年偏移**：2025 年为 1，之后每年递增（2026 = 2）
- **当天提交序号**：基于当日时间计算（每 5 分钟一个槽位）

版本号自动生成流程（`scripts/generate-version.mjs`）：
1. 生成基于时间戳的原始版本号 `YYYYMMDDHHmm`
2. 写入 `VERSION.txt`
3. 替换 HTML 中的 `{{LELETV_VERSION}}` 占位符
4. 更新 `service-worker.js` 中的 `CACHE_VERSION`
5. 为 CSS/JS 引用添加版本缓存参数 `?v=`

手动创建 Git 标签：

```bash
npm run tag
```

## 开发指南

```bash
# 克隆项目
git clone https://github.com/JiuNian090/leletv.git
cd leletv

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，设置 PASSWORD 等变量

# 构建样式
npm run build

# 启动开发服务器（带热重载）
npm run dev

# 访问应用
# http://localhost:8080
```

### npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | nodemon 热重载开发服务器 |
| `npm start` | 生产模式启动 |
| `npm run build` | 生成版本 + Tailwind 构建 |
| `npm run tag` | 手动创建 Git 版本标签 |

## 缓存策略

项目针对 Cloudflare Pages 部署实施了精细化的缓存策略（详见 `_headers`）：

| 文件类型 | 缓存策略 | 说明 |
|---------|---------|------|
| `.html` | `no-cache` | 每次请求回源校验 |
| `CHANGELOG.md` | `no-cache` | 实时获取最新版本历史 |
| `.css`, `.js`, 图片 | `public, max-age=604800, immutable` | 缓存 7 天，配合 `?v=` 参数做缓存失效 |

### 应用层缓存体系

| 缓存 | 存储位置 | TTL | 说明 |
|------|---------|-----|------|
| 搜索结果缓存 | 内存 Map | 5 分钟 | `_searchCache` 对象 |
| 密码验证状态 | localStorage | 30 天 | `passwordVerified` |
| 搜索历史 | localStorage | 2 个月 | `videoSearchHistory` |
| 观看历史 | localStorage | 永久（最多 50 条） | `viewingHistory` |
| API 负载均衡统计 | localStorage | 永久 | `loadBalancerStats` |
| 临时数据 | localStorage | 24 小时自动清理 | `videoProgress_*` 等 |
| SW 缓存 | Cache Storage | 版本更新时清理 | 静态资源 |

## AI 开发集成

本项目通过 **GitNexus MCP** 与 AI 编辑器深度集成，提供代码知识图谱索引和分析能力：

- **索引规模**：1809 个符号、3031 条关系、133 条执行流
- **分析工具**：影响范围分析、上下文查询、执行流追踪、重构辅助
- **技能文件**：`AGENTS.md`、`CLAUDE.md`、`.claude/skills/gitnexus/` 包含 6 个专项技能

在支持 MCP 的编辑器中（如 Trae、Cursor、Claude Code），AI 助手可直接获取整个代码库的架构视图，实现精准的代码理解和变更分析。

## 免责声明

本项目仅作为学习工具，不存储、上传或分发任何视频内容。所有视频均来自第三方 API 接口提供的搜索结果。如有侵权内容，请联系相应的内容提供方。

本项目开发者不对使用本项目产生的任何后果负责。使用本项目时，您必须遵守当地的法律法规。

## 联系方式

如有好的功能建议或问题，欢迎联系作者：jiunian929@gmail.com
