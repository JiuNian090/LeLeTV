# 私有学习项目声明

## 🚨 重要说明

本项目是一个**私有学习库**，仅用于作者个人学习和技术研究用途。**不接受任何外部贡献**，包括但不限于代码提交、问题报告、功能建议等。

## 📚 项目性质

- 本项目仅供个人学习使用，禁止用于任何商业用途
- 本项目必须设置密码保护，禁止公开分享或部署为公共服务
- 如因违反上述规定导致的任何法律问题，使用者需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任

## 🔒 安全提示

所有部署都必须设置 `PASSWORD` 环境变量，确保项目的私有性和安全性。

您还可以设置 `ADMINPASSWORD` 环境变量来启用隐藏内容过滤功能的管理权限。

## ⚙️ 环境变量配置

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `PASSWORD` | 是 | 用户访问密码，必须设置 |
| `ADMINPASSWORD` | 否 | 管理员密码，用于管理隐藏内容过滤功能 |
| `PORT` | 否 | 服务器端口，默认为 8080 |
| `CORS_ORIGIN` | 否 | CORS 允许的源，默认为 * |
| `REQUEST_TIMEOUT` | 否 | 请求超时时间（毫秒），默认为 5000 |
| `MAX_RETRIES` | 否 | 请求最大重试次数，默认为 2 |
| `CACHE_MAX_AGE` | 否 | 静态资源缓存时间，默认为 1d |
| `USER_AGENT` | 否 | 请求 User-Agent，默认为 Chrome |

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
   # 根据需要修改 .env 文件中的配置，特别是设置 PASSWORD 变量
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
├── api/              # API代理服务
├── css/              # 样式文件
├── functions/        # Cloudflare Functions
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

项目采用语义化版本控制，版本号格式为 `v{年}.{月}.{日}.{当天提交序号}`。

每次提交代码时，系统会自动从 CHANGELOG.md 中提取最新版本号创建 Git 标签。如果提交信息中包含 `@CHANGELOG.md`，则跳过自动标签创建过程。

可以通过以下方式手动创建标签：

```bash
npm run tag
```

---

**本项目为个人学习资源，请勿传播或用于非学习目的。** 📖