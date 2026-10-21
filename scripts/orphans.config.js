/**
 * 零引用检测白名单（阶段 4.5 前的初版）
 *
 * dynamic：运行时动态加载，静态分析看不到引用 → B 级（人工确认）
 * keep：明确保留，不进入候选 → C 级
 *
 * 禁止 AI 自行扩充；新增条目需人类 review 并在 CLEANUP.md 记录理由。
 */

export default {
  dynamic: [
    'src/services/sources/**',   // 采集站按站点名动态加载
    'src/styles/themes/**',      // 主题动态切换
    'src/router/**',             // 路由动态 import 页面
    'src/styles/views.css',       // page-loader 运行时插入 <link>
    'css/v2/admin.css',          // page-loader 运行时插入 <link>
    'pages/**',                  // page-loader 运行时 fetch（尚未迁移的页面）
    'src/pages/**',              // page-loader 运行时 fetch（已迁移的页面模板）
    'js/filter-config.json',     // app-search 运行时 fetch
    'js/auth/sha256.js',         // proxy-auth 动态 import
    'libs/marked.min.js',        // app-routing 动态插入 <script>
    'service-worker.js',         // 老访客残留 SW 的 kill-switch
  ],

  keep: [
    '.agents/**',
    '.github/**',
    '.vscode/**',
    'docs/**',
    'functions/**',
    'workers/**',
    'migrations/**',
    'scripts/**',
    'public/**',
    'wrangler.toml',
    'package.json',
    'nodemon.json',
    'tsconfig.json',
    'manifest.json',
    '_headers',
    '_routes.json',
    '.env.example',
    '.gitignore',
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'VERSION.txt',
  ],
};
