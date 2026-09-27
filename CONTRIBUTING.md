# 贡献指南 / Contributing to LeLeTV

感谢你对 LeLeTV 感兴趣！本项目**欢迎 Issue 与 Pull Request**，包括代码、文档、翻译和改进建议。

提交之前，请花几分钟读完这份指南——尤其是[技术约束](#-技术约束)和[许可与授权](#-许可与授权)两节。

---

## 📚 项目性质与使用边界

- 本项目**源码公开、欢迎贡献**，但**禁止任何商业用途**，详见 [LICENSE](LICENSE)
- 项目本身**不存储、不提供、不分发任何影视内容**，只做第三方数据源的检索与播放链接聚合
- 作者自己的部署保留了邀请码门禁；你要部署一份的话，请自行遵守当地法律法规，并对自己的部署与使用行为负责
- 因使用本项目产生的任何后果由使用者自行承担，作者不承担法律责任

## 🤝 可以怎么贡献

| 方式 | 说明 |
|------|------|
| 🐛 报告 Bug | 走 [Issue 模板](../../issues/new/choose)，附复现步骤与控制台日志；**先搜一下有没有重复** |
| 💡 功能建议 | 同上，说明使用场景，而不只是"想要某个功能" |
| 🔧 提交代码 | 见下面的[提交流程](#-提交流程) |
| 📄 文档与翻译 | 修正错别字、补充说明、改进 README 都很有价值 |
| 🔌 新增资源站 | 在 `js/api/api-config.js` 的 `API_SITES` 里按现有格式添加，并**确认站点可用** |

> ⚠️ **请不要在公开 Issue / PR 里粘贴任何密钥**（`HIDDENKEY` / `ADMINKEY` / `TMDB_API_KEY` 等）。安全漏洞请走 [SECURITY.md](SECURITY.md) 的私密渠道。

## 🚀 提交流程

1. **先讨论再动手**：影响面较大的改动（新模块、改架构、改部署方式）请先开 Issue 说明思路，避免白做
2. **Fork 本仓库**，从 `main` 切出分支，分支名用 `feat/xxx`、`fix/xxx`、`style/xxx`、`docs/xxx`
3. **开发并自测**：跑 `npm run dev`，控制台不能有报错；涉及界面的改动请桌面与手机各看一遍
4. **改了 `js/` 就重新打包**：
   ```bash
   npm run build
   ```
   它会把 `js/` 打成 `dist/` 的 bundle，并同步 `index.html` / `player.html` 里的引用（产物不在版本库中，别单独提交 `dist/`）
5. **提交**：提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)
   ```
   feat(搜索): 结果页支持按年份排序
   fix(player): 修复 iPad 横屏起播黑屏
   style(home): 聚合动效卡片间距调整
   ```
6. **发起 Pull Request**，按 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)填写，逐项确认自查清单
7. **等待 Review**：个人项目，回复可能不及时，但一定会看

## 🧱 技术约束

本项目刻意保持轻量，请遵守以下约束（不满足的 PR 会被要求返工）：

| 约束 | 说明 |
|------|------|
| **无前端框架** | 原生 JS（ES6+）+ HTML5 + 手写 CSS，**不引入** React / Vue / Vite 等构建框架 |
| **不擅自加依赖** | 新增第三方库需先在 Issue 里说明理由、体积与必要性，经同意再加 |
| **样式只改 `css/v2/`** | 页面只加载 `css/v2/` 下的样式（`tokens → base → home → views → admin`，播放页 `player.css`），改动请落在对应文件 |
| **新模块要登记** | 在 `js/` 下新增模块后，**必须**把它加进 `scripts/build-bundles.mjs` 的 `CORE` / `APP` / `PLAYER` 清单，否则不会被加载 |
| **不动部署配置** | `wrangler.toml` / `_headers` / `_routes.json` / `functions/` / `workers/` / CI 文件非必要不要改；确需改动请在 PR 里说明理由 |
| **密钥不进源码** | 一律通过环境变量注入，详见 [SECURITY.md](SECURITY.md) |
| **主题色** | 主色 `#ec4899`（霓虹粉），配色变量集中在 `css/v2/tokens.css` 与 `js/ui/theme-system.js` |

## 🔒 安全提示

访问控制由**邀请码验证系统**承担，密钥一律在 Cloudflare Worker 端通过环境变量配置，禁止写进源码。

- `ADMINUSER` + `ADMINKEY`：管理员账号，用于生成与管理邀请码
- `HIDDENKEY`：隐藏内容模式的管理密钥

详见 [README 的邀请码验证系统章节](README.md#-邀请码验证系统)，以及本仓库的 [安全策略](SECURITY.md)。

## ⚙️ 环境变量配置

本地开发（`.env`，模板见 `.env.example`）：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `TMDB_WORKER_URL` | 是 | Cloudflare Worker 地址，TMDB 请求与邀请码验证都走它 |
| `TMDB_API_KEY` | 否 | TMDB API 密钥，仅在本地直连 TMDB 时需要 |
| `PORT` | 否 | 本地服务器端口，默认为 8080 |
| `HIDDENKEY` | 否 | 隐藏内容模式的管理密钥（本地调试用） |
| `CORS_ORIGIN` | 否 | CORS 允许的源，默认为 * |
| `REQUEST_TIMEOUT` | 否 | 上游请求超时时间（毫秒），默认为 5000 |
| `MAX_RETRIES` | 否 | 请求最大重试次数，默认为 2 |
| `CACHE_MAX_AGE` | 否 | 静态资源缓存时间，默认为 1d |
| `USER_AGENT` | 否 | 上游请求 User-Agent，默认为 Chrome |
| `BLOCKED_HOSTS` | 否 | 代理禁止访问的主机名，默认为 `localhost,127.0.0.1,0.0.0.0,::1` |
| `BLOCKED_IP_PREFIXES` | 否 | 代理禁止访问的网段前缀，默认为 `192.168.,10.,172.` |
| `DEBUG` | 否 | 设为 `false` 关闭调试日志 |

> 没有配置 `TMDB_WORKER_URL` 时进"本地模式"：邀请码弹窗不校验、设备与管理面板不渲染；首页热门与「最近更新」在缺少 TMDB 数据时为空，**搜索与播放不受影响**。

## 🛠️ 本地开发

```bash
git clone https://github.com/JiuNian090/LeLeTV.git
cd LeLeTV
npm install
cp .env.example .env      # 按需修改，至少填写 TMDB_WORKER_URL
npm run dev               # 启动开发服务器
```

打开 <http://localhost:8080> 即可。

| 命令 | 说明 |
|------|------|
| `npm run dev` | 热重载开发服务器（nodemon + Express 本地代理，默认 8080） |
| `npm run build` | 版本号注入 + esbuild 打包（改完 `js/` 必跑） |
| `npm start` | 生产模式启动 |
| `npm run setup:hooks` | 安装 pre-commit 钩子（版本号同步 + bundle 自动构建） |

手机联调：`HOST=0.0.0.0 node server.mjs`，然后用手机访问 `http://<你的电脑 IP>:8080`（浏览器原生的 PWA 安装框只在 HTTPS 或 localhost 出现，局域网 http 下没有，这是浏览器行为）。

## 📂 目录结构

```
LeLeTV/
├── .agents/          # AI Agent 规则与技能（索引见 AGENTS.md）
├── .github/          # Issue / PR 模板与工作流
├── css/v2/           # 手写样式（tokens / base / home / views / admin / player）
├── dist/             # esbuild 打包产物（构建生成，不入版本库）
├── functions/        # Cloudflare Pages Functions：/proxy/* 采集站代理 + 环境变量注入
├── image/            # 图片资源（brand/ 品牌图、splash/ iOS 启动图）
├── js/               # 前端源码（api / app / auth / core / effects / player / ui / utils）
├── libs/             # 第三方库（artplayer / hls.js / marked / sha256 / geist 字体）
├── migrations/       # Cloudflare D1 迁移脚本
├── scripts/          # 构建与品牌图脚本（build-bundles.mjs 是打包入口）
├── workers/          # Cloudflare Workers：tmdb-worker.js
├── index.html        # 首页（单页应用主入口）
├── player.html       # 播放页
├── server.mjs        # 本地开发服务器
├── manifest.json     # PWA 配置
├── service-worker.js # 仅用于注销历史遗留的 Service Worker
└── ...               # CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / README.md 等
```

## 🔄 版本管理

项目采用语义化版本控制，版本号格式为 `v{主}.{次}.{修订}`（如 `v3.6.5`），保存在 `VERSION.txt`，更新日志记录在 `CHANGELOG.md`。

`npm run build` 时由 `scripts/generate-version.mjs` 把版本号注入 HTML 与 `?v=` 缓存参数。

**贡献者请勿自行改动 `VERSION.txt` / `CHANGELOG.md` 或打 tag** —— 发版由维护者统一处理；你的改动合入后会出现在下一个版本的更新日志里。

`npm run setup:hooks` 安装的 pre-commit 钩子负责两件事：`VERSION.txt` 变更时同步版本号到 HTML / Service Worker，以及 `js/` 变更但 `dist/` 未暂存时自动构建 bundle。

## 📜 许可与授权

- 本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)：**源码公开，但禁止任何商业用途**
- 你提交的贡献（代码、文档、翻译等）将按同一许可证授权给本项目，并可被自由分发
- 因此请不要提交你无权授权的代码（例如从别处复制的、有冲突许可证的片段）
- 需要商业授权请联系作者

提交 PR 即视为同意以上条款。另请遵守本项目的[行为准则](CODE_OF_CONDUCT.md)。

---

**本项目仅供个人学习与技术研究，请勿用于商业用途。** 📖
