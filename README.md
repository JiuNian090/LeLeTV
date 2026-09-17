# LeLeTV - 乐乐影视

<div align="center">
  <img src="image/logo.png" alt="LeLeTV Logo" width="180">
  <br>
  <p><strong>自用学习项目，请勿公开分享</strong></p>
</div>

<p align="center">
  <a href="https://leletv.776645.xyz" target="_blank">在线访问</a> ·
  <a href="#-项目简介">项目简介</a> ·
  <a href="#-功能特性">功能特性</a> ·
  <a href="#-邀请码验证系统">邀请码验证</a> ·
  <a href="#-架构说明">架构说明</a> ·
  <a href="#-部署指南">部署指南</a> ·
  <a href="#-更新日志">更新日志</a>
</p>

---

## 📖 项目简介

LeLeTV 是一个自用的在线视频搜索与观看平台，仅用于个人学习与技术研究。核心是一个**纯前端单页应用（SPA）**：聚合 21 个第三方视频采集站 API 完成搜索与播放，通过 **TMDB（The Movie Database）** 提供分类浏览、影片详情与智能筛选。

部署采用 **Cloudflare Pages + Pages Functions + Workers + D1** 的纯静态 + 无服务器架构，无需自建后端。

### 项目规模

| 指标 | 数据 |
|------|------|
| JS 模块 | 43 个手写模块（`js/` 下 8 个子目录） |
| 第三方库 | 4 个（`libs/`：ArtPlayer / HLS.js / marked / sha256） |
| 样式 | 5 个手写 CSS + Tailwind 编译输出（`css/output.css`） |
| 构建产物 | 3 个 esbuild bundle（core / app / player，带内容哈希） |
| 搜索源 | 21 个内置采集站（11 公开 + 10 隐藏）+ 最多 5 个自定义源，另支持云端下发 |
| 页面 | `index.html`（SPA，1548 行）+ `player.html`（独立播放页，301 行） |
| 数据库 | Cloudflare D1（`invitation_codes` + `devices` + `api_sites`） |
| 代码图谱 | CodeGraph 1,232 节点 / 5,840 边 · GitNexus 2,346 符号 / 207 执行流 |

## ⚠️ 重要声明

- 本项目**仅供个人学习使用**，禁止用于任何商业用途
- 本项目**必须部署邀请码系统**（Cloudflare D1 + Worker），否则页面无法进入
- 本项目不存储、上传或分发任何视频内容，所有结果均来自第三方接口
- 如因违反上述规定导致的任何法律问题，使用者需自行承担责任

## ✨ 功能特性

### 视频搜索
- 聚合 21 个第三方采集站 API，多源并发搜索
- 搜索结果内存缓存（5 分钟 TTL），减少重复请求
- **搜索历史下拉菜单**：点击搜索框展开，输入实时过滤，支持逐条删除与清空
- **结果源过滤标签**：按来源切换结果，标签带实时计数
- **智能排序**：解析片名中的季/部/集序号做数值排序（含「第十二季」等中文数字）
- **智能负载均衡**：动态评分算法自动选源与故障转移（详见下文）
- **私密内容过滤**：可选开关，密码保护

### TMDB 分类浏览
- 支持 **电影 / 电视剧 / 动漫 / 综艺** 四大类型
- **多维筛选**：类型流派、年份（可折叠）、评分、语言、地区、剧集状态
- 8 种排序方式；智能分页（省略号逻辑）+ 响应式网格
- 分类页会记住上次选择的标签，`hidden` 数据域下另存一套

### 视频播放
- 基于 **ArtPlayer + HLS.js**，支持 M3U8 流媒体
- **多资源切换**：实时测试各源延迟并显示，便于挑最流畅的线路
- **上下集切换 / 自动连播**：剧集导航 + 快捷键（Alt + ←/→）
- **广告过滤**：自定义 HLS.js Loader 拦截 M3U8 分片广告
- **手机横屏自动全屏**、**长按二倍速**（鼠标与触摸均支持）
- **进度恢复**：自动保存播放进度，返回时续播
- **Media Session API**：接入系统媒体控制中心
- **Window Controls Overlay**：PWA 模式下的原生窗口控制栏

### 主题与外观
- **主题色系统**：内置预设主题 + 自定义配色，正常/私密模式各保存一套
- Tailwind 的 `pink` 色板映射到 CSS 变量，主题切换时全站工具类自动跟随
- **HarmonyOS 深色调色板**：纯黑背景 + 霓虹粉（`#ec4899`）主色
- 极光背景、粒子聚散、粒子切主题等动效；播放中或页面后台时自动暂停以省电
- 响应式设计（xs/sm/md/lg 四档断点）、按压反馈、骨架屏、Toast 队列

### 历史与设备
- **观看历史**：自动记录集数与进度（30 秒防抖），今天/昨天/本周/更早分组，最多 50 条
- **设备管理**：查看本邀请码下的设备列表，支持重命名本设备、剔除其他设备
- **分享**：移动端调起系统分享面板，桌面端复制「站点地址 + 邀请码」文案

### 数据源与缓存
- 设置页可勾选/重置/导入/导出数据源配置，最多添加 5 个自定义采集站
- 云端数据源：采集源存放在 D1，可在 `/admin` 面板在线增删改，前端启动时自动同步并缓存；内置源始终兜底
- 智能缓存管理：24 小时清理临时数据，保护用户设置与历史
- PWA 可安装（`standalone` + `window-controls-overlay`）
- 版本更新自动检测，提示后重载生效

## 🔐 邀请码验证系统

项目内置基于 **Cloudflare D1** 的邀请码验证系统，是**唯一**的访问控制方式：设备指纹 + 心跳机制管理访问权限。

### 工作原理

```
用户打开页面
    │
    ├── 已登录 ───── 自动校验设备心跳，进入首页
    │
    └── 未登录 ───── 弹出邀请码登录界面
            │
            ├── 普通用户：输入设备名 + 邀请码
            │       │
            │       └── POST /invite/verify
            │               ├── 邀请码无效 ──── 拒绝访问
            │               ├── 邀请码已禁用 ── 拒绝访问
            │               └── 验证成功
            │                       ├── 已有指纹记录 ── 更新活跃时间
            │                       └── 新设备
            │                               ├── 未超上限 ── 注册新设备
            │                               └── 超上限 ──── 移除最久未活跃设备
            │
            ├── 管理员：输入 ADMINUSER + ADMINKEY
            │       │
            │       └── POST /invite/verify
            │               └── 匹配管理员凭证 ── 跳过数据库校验，进入管理员模式
            │
            └── 启动心跳（每 5 分钟）── 更新设备最后活跃时间
```

### 核心机制

| 机制 | 说明 |
|------|------|
| **设备指纹** | 浏览器特征（UA、screen、时区、语言等）经 SHA-256 生成，绑定设备身份 |
| **心跳** | 每 5 分钟上报一次，页面 `pagehide` 时补发，维持设备活跃状态 |
| **设备上限** | 每个邀请码默认最多 5 台设备，超限自动剔除最久未活跃设备 |
| **持久登录** | 验证信息存入 localStorage，关闭页面无需重新登录 |
| **邀请码格式** | `LELE-XXXX-XXXX`（排除易混淆字符 O/0/I/1） |
| **管理员登录** | 用环境变量 `ADMINUSER` + `ADMINKEY` 登录，无需额外密码弹窗 |

### 相关文件

| 文件 | 说明 |
|------|------|
| `js/auth/invite-auth.js` | 指纹生成、验证、心跳、登录状态、管理员 token 计算 |
| `js/auth/admin-panel.js` | 管理员面板：生成/启停/删除邀请码、统计、备注、设备管理 |
| `js/auth/user-devices.js` | 普通用户设备面板：查看邀请码与设备、重命名、剔除设备 |
| `workers/tmdb-worker.js` | Worker 端 `/invite/*` API（verify / heartbeat / generate / list / toggle / stats / my-devices / remove-device / set-remark / rename-device / delete-code）、`/api-sites` 数据源下发、`/admin` 管理面板 |
| `migrations/001_create_tables.sql` | D1 表结构（`invitation_codes` + `devices`） |
| `migrations/002_add_remark.sql` | 邀请码备注字段 |
| `migrations/003_add_device_signature.sql` | 设备签名字段（同型号设备区分） |
| `migrations/004_add_api_sites.sql` | 云端数据源表 `api_sites`（源名称、接口、私密、启停、排序） |

> 本地开发无需自建邀请码服务：`server.mjs` 只提供静态资源、视频代理与 TMDB 代理，邀请码相关请求统一由 `.env` 中的 `TMDB_WORKER_URL` 指向的线上 Worker 处理。

## 🧰 技术栈

| 层 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML5 + CSS3 + JavaScript (ES6+) | 无框架，纯原生 |
| 样式 | Tailwind CSS 3.4 + PostCSS | CSS 变量驱动主题 |
| 播放器 | ArtPlayer + HLS.js | M3U8 播放 + 广告过滤 |
| 构建 | esbuild + Node 脚本 | 3 个 bundle + 版本注入 |
| 本地服务 | Node.js + Express 5 | 静态服务 + 视频代理 + TMDB 代理 |
| 托管 | Cloudflare Pages | 静态资源 |
| 边缘函数 | Pages Functions | HTML 注入 + 视频/图片代理 |
| 无服务器 | Cloudflare Workers | TMDB 代理 + 邀请码 API |
| 数据库 | Cloudflare D1 | 邀请码与设备数据 |
| PWA | Web App Manifest | 可安装为独立应用 |

### 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| axios | ^1.9.0 | HTTP 请求（服务端代理） |
| cors | ^2.8.5 | CORS 中间件 |
| dotenv | ^16.5.0 | 环境变量加载 |
| express | ^5.1.0 | 本地 Web 服务器 |
| node-fetch | ^3.3.2 | 服务端 fetch |

开发依赖：`esbuild`（打包）、`tailwindcss` + `postcss` + `autoprefixer`（样式）、`nodemon`（热重载）、`better-sqlite3`（本地脚本）。

### 第三方前端库

| 文件 | 说明 |
|------|------|
| `libs/artplayer.min.js` | ArtPlayer 播放器核心 |
| `libs/hls.min.js` | HLS.js 流媒体引擎 |
| `libs/marked.min.js` | Markdown 渲染（项目说明页） |
| `libs/sha256.min.js` | js-sha256（HTTP 环境下的 Web Crypto 备用） |

## 🏗️ 架构说明

### 生产部署架构（Cloudflare）

```
用户浏览器
    │
    ├── Cloudflare Pages ─────────── 静态资源（HTML / CSS / JS / 图片）
    │       ├── Pages Functions ──── HTML 注入（HIDDENKEY 哈希、Worker 地址、版本号）
    │       ├── Pages Functions ──── 视频/图片代理（/proxy/*，鉴权 + 内容类型白名单 + 缓存）
    │       └── Cloudflare D1 ───── 邀请码 + 数据源配置（经 Worker 访问）
    │               ├── invitation_codes ── 邀请码、状态、备注、设备上限
    │               ├── devices ─────────── 指纹、设备名、浏览器、IP、活跃时间
    │               └── api_sites ───────── 云端采集源配置（名称、接口、私密、启停、排序）
    │
    ├── Cloudflare Worker ────────── TMDB 代理 + 邀请码 API + 数据源下发
    │       ├── TMDB API v3（首页/分类/详情边缘缓存 24h，搜索缓存 1h）
    │       ├── GET / ────────────── 部署状态控制台（自检密钥与绑定）
    │       ├── /invite/* ────────── 邀请码 API 路由
    │       ├── /api-sites ───────── 云端数据源下发（私密源走 /api-sites/hidden）
    │       └── /admin ───────────── 数据源管理面板（登录后在线增删改查）
    │
    └── 第三方采集站 API ─────────── 视频搜索与播放源（经 Functions 代理）
```

### 本地开发架构

```
用户浏览器
    │
    ├── Node.js + Express（server.mjs，360 行）
    │       ├── express.static ───── 静态资源
    │       ├── GET / ────────────── HTML 注入（版本号、Worker 地址等）
    │       ├── GET /s=:keyword ──── 搜索直达路由
    │       ├── GET /proxy/:url ──── 视频源代理
    │       ├── GET /api/tmdb ────── TMDB 代理（无 Worker 时的回退）
    │       └── GET /api/version ─── 版本号 API
    │
    └── 邀请码 API ───────────────── 由 .env 的 TMDB_WORKER_URL 指向线上 Worker
```

### 构建流程

```bash
npm run build
# ├─ node scripts/generate-version.mjs   # 读取 VERSION.txt，注入 {{LELETV_VERSION}} 与 ?v= 缓存参数
# ├─ node scripts/build-bundles.mjs      # 按 CORE / APP / PLAYER 三类拼接并用 esbuild 压缩 → dist/
# └─ npx tailwindcss@3.4.19 …            # 编译 css/tailwind.css → css/output.css（--minify）
```

打包分组：

| Bundle | 内容 | 引用方 |
|--------|------|--------|
| `leletv-core.*.js` | `js/core`、`js/api/remote-sources.js`、`js/auth`、`js/ui/ui-core.js` | `index.html` + `player.html` |
| `leletv-app.*.js` | `js/api`、`js/ui`、`js/app`、`js/effects`、`js/utils` | `index.html` |
| `leletv-player.*.js` | `js/player` + 播放页所需的 api/ui 模块 | `player.html` |

> `dist/` 内的文件名带内容哈希，由构建生成（`.gitignore` 已忽略）。未列入 bundle 的模块（如 `js/auth/user-devices.js`、`js/auth/admin-panel.js`、`js/ui/theme-system.js`）由 HTML 以 `<script defer>` 单独加载。

### SPA 页面路由

| 页面 | 路由 | DOM 容器 |
|------|------|----------|
| 首页（搜索） | `/`、`/s=关键词` | `#page-home` |
| 分类浏览 | JS 切换 | `#page-category` |
| 观看历史 | JS 切换 | `#page-history` |
| 设置 | JS 切换 | `#page-settings` |
| 关于 | JS 切换 | `#page-about` |
| 项目说明 / README | JS 切换 | 独立视图 |
| 播放器 | `/player.html` | 独立页面 |

### 目录结构

```
LeLeTV/
├── index.html                  # SPA 主入口
├── player.html                 # 独立播放页
├── server.mjs                  # 本地开发服务器（Express）
├── service-worker.js           # 已退役的 SW（仅用于注销旧缓存，勿添加逻辑）
├── manifest.json               # PWA Manifest
├── _headers                    # Pages 响应头（缓存策略 + CSP）
├── _routes.json                # Pages Functions 路由排除规则
├── wrangler.toml               # Cloudflare Workers 配置
├── css/                        # 样式
│   ├── variables.css           #   CSS 变量与主题色盘
│   ├── styles.css              #   全局样式
│   ├── pages.css               #   二级页面样式
│   ├── player.css              #   播放器样式
│   ├── tailwind.css            #   Tailwind 入口
│   └── output.css              #   Tailwind 编译输出
├── js/                         # 43 个手写模块
│   ├── core/                   #   全局配置、存储、监听器追踪、时序工具
│   ├── api/                    #   采集站 API、负载均衡、搜索、TMDB、远端数据源同步
│   ├── auth/                   #   邀请码验证、管理员面板、设备管理
│   ├── player/                 #   播放器核心与 UI、剧集、清晰度、详情、快捷键
│   ├── ui/                     #   搜索结果卡片、分类页、历史、Toast、主题系统
│   ├── app/                    #   入口、路由、搜索流程、配置管理
│   ├── effects/                #   极光背景、标题动效
│   └── utils/                  #   版本检测、首页脚本
├── dist/                       # esbuild 构建产物（构建生成，不提交）
├── libs/                       # 第三方库
├── functions/                  # Cloudflare Pages Functions
│   ├── _middleware.js          #   HTML 注入
│   └── proxy/[[path]].js       #   视频/图片代理
├── workers/
│   └── tmdb-worker.js          #   TMDB 代理 + 邀请码 API + 数据源下发 + /admin 面板
├── migrations/                 # D1 迁移脚本（001 表结构 → 004 数据源表）
├── scripts/                    # 版本生成、打包、钩子安装脚本
├── image/                      # Logo 与占位图
├── docs/                       # 版本规则等文档
└── .github/                    # Issue 模板与工作流
```

## 🚀 快速开始（本地开发）

```bash
# 克隆项目
git clone https://github.com/JiuNian090/leletv.git
cd leletv

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env：至少填写 TMDB_WORKER_URL（线上 Worker 地址）

# 构建（版本注入 + 打包 + 样式）
npm run build

# 启动开发服务器（热重载）
npm run dev
# 访问 http://localhost:8080
```

> 本地开发时邀请码校验、设备管理、TMDB 数据全部由线上 Worker 处理，请确认 `TMDB_WORKER_URL` 指向已部署且配置好环境变量的 Worker。

### npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | nodemon 热重载开发服务器 |
| `npm start` | 生产模式启动 |
| `npm run build` | 版本注入 + esbuild 打包 + Tailwind 编译 |
| `npm run setup:hooks` | 安装 Git 钩子 |

## 📦 部署指南

### 第一步：获取 TMDB API 密钥

1. 访问 [TMDB](https://www.themoviedb.org/) 注册账号并验证邮箱
2. 右上角头像 → **账户设置** → 左侧 **API** → **请求 API 密钥**
3. 选择 **Developer**（免费），填写用途与应用 URL 后提交
4. 复制得到的 **API 密钥 (v3 auth)** 备用

### 第二步：部署 Cloudflare Worker（TMDB 代理 + 邀请码 API）

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **创建 Worker**
2. 命名（例如 `leletv-tmdb-proxy`）并部署
3. **编辑代码**，用 `workers/tmdb-worker.js` 的内容覆盖默认代码，保存并部署
4. 进入 Worker **设置** → **变量**，添加加密变量：

   | 变量名 | 必填 | 说明 |
   |--------|------|------|
   | `TMDB_API_KEY` | 是 | 第一步获取的 TMDB 密钥 |
   | `ADMINUSER` | 是 | 管理员登录设备名（例如 `admin`） |
   | `ADMINKEY` | 是 | 管理员登录邀请码 |
   | `HIDDENKEY` | 否 | 私密内容过滤密码 |

   也可用 CLI：`npx wrangler secret put TMDB_API_KEY` 等。

5. 绑定 D1 数据库（见下），并将数据库绑定名设为 `INVITE_DB`
6. 记录 Worker 地址（自定义域名或 `*.workers.dev`）

> 验证：浏览器访问 Worker 根路径 `https://你的worker域名/`，会打开「LeLeTV TMDB Proxy」状态控制台，页面会自检 TMDB 密钥与 D1 绑定；也可请求 `https://你的worker域名/?endpoint=configuration`，能返回 TMDB 配置 JSON 即代理正常。

### 第二步（可选）：创建 D1 数据库

1. Cloudflare Dashboard → **Workers & Pages** → **D1** → **创建数据库**（例如 `leletv-invite-db`）
2. 在 D1 控制台按顺序执行 `migrations/` 下的脚本：`001_create_tables.sql`、`002_add_remark.sql`、`003_add_device_signature.sql`、`004_add_api_sites.sql`（`004` 为云端数据源表，未执行时前端自动回退内置源）
3. 回到 Worker → **设置** → **绑定** → 添加 D1 绑定，**变量名填 `INVITE_DB`**
4. 在 `wrangler.toml` 中补上对应的 `[[d1_databases]]` 配置后重新部署

### 第三步：部署 Cloudflare Pages（前端）

1. Fork 或克隆本仓库到你的 GitHub 账号
2. Cloudflare Dashboard → **Workers & Pages** → **创建应用程序** → **Pages** → **连接到 Git**，选择仓库
3. 构建设置：

   | 项 | 值 |
   |------|------|
   | 构建命令 | `npm run build` |
   | 输出目录 | `/`（项目根目录，`dist/` 是其子目录） |
   | 根目录 | `/`（默认） |

4. 部署完成后，进入 Pages **设置** → **环境变量** → **生产环境**，添加：

   | 变量名 | 必填 | 说明 |
   |--------|------|------|
   | `TMDB_WORKER_URL` | 是 | Worker 地址，**不要带末尾斜杠** |
   | `HIDDENKEY` | 否 | 与 Worker 保持一致，用于 HTML 注入哈希 |
   | `CACHE_TTL` / `MAX_RECURSION` / `USER_AGENTS_JSON` / `DEBUG` | 否 | 视频代理行为调优 |

5. 回到 **部署** 列表，对最新部署执行 **重试部署** 让变量生效

> **注意**：`ADMINUSER`、`ADMINKEY`、`TMDB_API_KEY` 属于 **Worker** 的环境变量，不要填到 Pages。

### 验证整个流程

1. 访问 Pages 域名，应弹出邀请码登录界面
2. 用有效邀请码（或 `ADMINUSER` / `ADMINKEY`）登录进入首页
3. 打开 **分类** 页，应能看到 TMDB 数据
4. 若分类页空白，依次检查：Worker 根路径状态控制台是否显示密钥已就绪 → Pages 的 `TMDB_WORKER_URL` 是否填写正确 → Worker 的 `TMDB_API_KEY` 是否生效

## ⚙️ 环境变量

### Worker（生产）

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `TMDB_API_KEY` | 是 | TMDB 密钥（加密） |
| `ADMINUSER` | 是 | 管理员登录设备名（加密） |
| `ADMINKEY` | 是 | 管理员登录邀请码（加密） |
| `HIDDENKEY` | 否 | 私密内容过滤密码（加密） |
| `INVITE_DB` | 是 | D1 数据库绑定名 |

> `ADMINUSER` / `ADMINKEY` 同时用于 Worker `/admin` 数据源管理面板的登录鉴权。

### Pages Functions（生产）

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `TMDB_WORKER_URL` | 是 | Worker 地址 |
| `HIDDENKEY` | 否 | 与 Worker 一致，用于 HTML 注入哈希 |
| `CACHE_TTL` | 否 | 代理缓存秒数（例如 `86400`） |
| `MAX_RECURSION` | 否 | 代理重定向跟随上限 |
| `USER_AGENTS_JSON` | 否 | 代理轮换 UA 列表（JSON 数组字符串） |
| `DEBUG` | 否 | 代理调试日志 |
| `LELETV_PROXY_KV` | 否 | 代理用 KV 绑定（如启用） |

### 本地开发（`.env`）

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `TMDB_WORKER_URL` | 是 | Worker 地址，所有邀请码与 TMDB 请求都走它 |
| `TMDB_API_KEY` | 否 | 仅在使用本地 `/api/tmdb` 回退时需要 |
| `PORT` | 否 | 本地端口（默认 8080） |
| `CORS_ORIGIN` | 否 | CORS 允许源（默认 `*`） |
| `REQUEST_TIMEOUT` | 否 | 请求超时毫秒（默认 5000） |
| `MAX_RETRIES` | 否 | 最大重试次数（默认 2） |
| `CACHE_MAX_AGE` | 否 | 静态资源缓存时间（默认 1d） |
| `USER_AGENT` | 否 | 代理请求 UA |
| `DEBUG` | 否 | 调试模式 |

> 本地**不需要**设置 `ADMINUSER`、`ADMINKEY`、`HIDDENKEY`，这些都在 Worker 端。

## 🗂️ 缓存与版本管理

### 响应头缓存策略（`_headers`）

| 路径 | 策略 | 说明 |
|------|------|------|
| `/*.html`、`/` | `no-cache` | 每次回源校验 |
| `/service-worker.js`、`/CHANGELOG.md`、`/VERSION.txt` | `no-cache` | 必须实时更新 |
| `/css/*`、`/js/*`、`/image/*`、`/libs/*` | `public, max-age=604800, immutable` | 缓存 7 天，配合 `?v=` 失效 |
| `/dist/*` | `public, max-age=31536000, immutable` | 文件名带内容哈希，缓存 1 年 |
| `/*` | CSP | 见 `_headers` 中的 `Content-Security-Policy` |

> `/proxy/*` 与 `/api/*` 不匹配上述规则，走 Cloudflare 默认行为。

### 应用层缓存

| 缓存 | 存储位置 | 有效期 |
|------|----------|--------|
| 搜索结果缓存 | 内存 Map | 5 分钟 |
| 搜索历史 | localStorage | 2 个月 |
| 观看历史 | localStorage | 永久（最多 50 条） |
| 负载均衡统计 | localStorage | 永久 |
| 云端数据源配置 | localStorage | 保留上次成功拉取的结果（首屏先用缓存，随后后台同步最新） |
| 临时播放进度 | localStorage | 24 小时自动清理 |
| TMDB 边缘缓存 | Cloudflare 边缘 | 首页/分类/详情 24h，搜索 1h |

### 版本管理

版本号保存在 `VERSION.txt`（当前 `v3.6.0`），`npm run build` 时由 `scripts/generate-version.mjs` 完成：

1. 替换 HTML 中的 `{{LELETV_VERSION}}` 占位符
2. 为所有 CSS/JS 引用追加 `?v=<版本号>` 缓存参数
3. 更新 `window.__LELETV_VERSION__`

关于页面的更新日志从 `/CHANGELOG.md` 实时拉取渲染。

## 📝 更新日志

> 最近 3 条，完整历史见 [CHANGELOG.md](CHANGELOG.md) 或站内「关于」页面。

### v3.6.0 (2026-09-17)
- 🎉 新增 数据源支持云端统一管理，采集源可远程下发，调整时无需重新部署
- 🎉 新增 管理面板支持在线增删改数据源，新增与编辑改为弹窗操作
- ✨ 优化 页面优先读取本地缓存的数据源配置，打开速度更快

### v3.5.9 (2026-09-17)
- 🔧 修复 设备登录后可能被误判为已移除、导致无法进入网站的问题
- 🔧 修复 管理端移除设备、停用或删除邀请码时偶发提示失败的问题

### v3.5.8 (2026-09-16)
- 🎉 新增 关于页新增「提交反馈」入口，可直接提交问题与建议
- 🎨 样式 启动加载页改用纯样式绘制，等待时不再白屏闪烁
- ✨ 优化 设备被移除后自动退出登录，不再残留无效的登录状态

<p align="center"><a href="CHANGELOG.md"><strong>更多更新日志 →</strong></a></p>

## 🤖 代码图谱与 AI 集成

项目已建立代码知识图谱，便于人（和 AI）快速理解与安全改动：

| 工具 | 能力 | 规模 |
|------|------|------|
| **CodeGraph** | 符号查询、调用链、影响范围 | 63 文件 / 1,232 节点 / 5,840 边 |
| **GitNexus** | 执行流、上下文、安全重命名、变更检测 | 2,346 符号 / 4,206 关系 / 207 执行流 |

常用命令：

```bash
codegraph query search          # 搜索符号
codegraph callers searchByAPIAndKeyWord
codegraph impact shareInviteInfo

npx gitnexus query "搜索流程"
npx gitnexus detect_changes
```

相关说明文件：`AGENTS.md`、`CLAUDE.md`、`CODE_WIKI.md`，以及 `.claude/skills/gitnexus/`、`.agents/skills/`、`.agents/rules/` 下的技能与规则。

## 📄 免责声明

本项目仅作为学习工具，不存储、上传或分发任何视频内容，所有视频均来自第三方 API 接口提供的搜索结果，如有侵权请联系相应内容提供方。

本项目开发者不对使用本项目产生的任何后果负责，使用时请遵守当地法律法规。

## 📮 联系方式

如有功能建议或问题，欢迎[联系作者](mailto:jiunian929@gmail.com)。

## 📜 许可证

[Apache-2.0](LICENSE)
