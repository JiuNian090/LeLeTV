/**
 * 零引用检测白名单（阶段 4.5 前；阶段 5B-5 校准）
 *
 * dynamic：运行时动态加载 / 字符串路径引用，静态 import 图看不到 → B 级（人工确认）
 * keep：明确保留，不进入候选 → C 级
 *
 * 注意：阶段 5B-5 起 check-orphans 已能解析 ESM 相对 import，
 * 并能对 HTML / CSS / JSON 做字符串引用扫描；本清单只登记扫描确实覆盖不到的运行时入口。
 * 禁止 AI 自行扩充；新增条目需人类 review 并在 CLEANUP.md 记录理由。
 */

export default {
  dynamic: [
    'src/services/sources/**',   // 采集站按站点名动态加载
    'src/styles/themes/**',      // 主题动态切换
    'src/router/**',             // 路由动态 import 页面
    'src/styles/views.css',      // page-loader 运行时插入 <link>
    'src/pages/**',              // page-loader 运行时 fetch 模板 / 样式
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
    // 阶段 4.5 用户确认保留：品牌源文件，不在运行时引用，供 scripts/brand 重新生成使用
    'image/brand/leletv-lockup.svg',
    'image/brand/leletv-mark.svg',
    'image/brand/leletv-wordmark-currentcolor.svg',
  ],
};
