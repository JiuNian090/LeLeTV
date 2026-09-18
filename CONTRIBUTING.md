# 私有学习项目声明

## 🚨 重要说明

本项目是一个**私有学习库**，仅用于作者个人学习和技术研究用途。**不接受任何外部贡献**，包括但不限于代码提交、问题报告、功能建议等。

## 📚 项目性质

- 本项目仅供个人学习使用，禁止用于任何商业用途
- 本项目必须设置密码保护，禁止公开分享或部署为公共服务
- 如因违反上述规定导致的任何法律问题，使用者需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任

## 🔒 安全提示

访问控制由**邀请码验证系统**承担，密钥一律在 Cloudflare Worker 端通过环境变量配置，禁止写进源码。

- `ADMINUSER` + `ADMINKEY`：管理员账号，用于生成与管理邀请码
- `HIDDENKEY`：隐藏内容模式的管理密钥

详见 [README 的邀请码验证系统章节](README.md#-邀请码验证系统)。

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

## 🛠️ 本地开发指南

如需在本地进行开发和测试，请按照以下步骤操作：

1. 克隆本仓库
   ```bash
   git clone <your-repo-url>
   cd LeLeTV
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 配置环境变量
   ```bash
   cp .env.example .env
   # 按需修改 .env，至少填写 TMDB_WORKER_URL
   ```

4. 启动开发服务器
   ```bash
   npm run dev
   ```

5. 访问应用
   ```
   打开浏览器访问 http://localhost:8080
   ```

## 📂 目录结构

```
LeLeTV/
├── css/              # 样式文件
├── functions/        # Cloudflare Pages Functions（代理与环境变量注入）
├── image/            # 图片资源
├── js/               # JavaScript文件
├── libs/             # 第三方库
├── scripts/          # 脚本文件
├── .gitignore        # Git忽略文件
├── CHANGELOG.md      # 更新日志
├── CONTRIBUTING.md   # 贡献指南
├── README.md         # 项目说明
├── manifest.json     # PWA配置文件
├── package.json      # 项目配置
├── server.mjs        # 服务器入口文件
├── service-worker.js # Service Worker文件
└── ...               # HTML页面文件
```

## 🔄 版本管理

项目采用语义化版本控制，版本号格式为 `v{主}.{次}.{修订}`（如 `v3.6.1`），保存在 `VERSION.txt`，更新日志记录在 `CHANGELOG.md`。

`npm run build` 时由 `scripts/generate-version.mjs` 把版本号注入 HTML 与 `?v=` 缓存参数。仓库不含自动打标签的脚本，需要时手动创建：

```bash
git tag v3.6.1
git push origin v3.6.1
```

`npm run setup:hooks` 安装的 pre-commit 钩子负责两件事：`VERSION.txt` 变更时同步版本号到 HTML / Service Worker，以及 `js/` 变更但 `dist/` 未暂存时自动构建 bundle。

---

**本项目为个人学习资源，请勿传播或用于非学习目的。** 📖