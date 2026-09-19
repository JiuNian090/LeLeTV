#!/usr/bin/env node

/**
 * 从 manifest.json 派生 manifest-android.json
 *
 * 背景：
 *   Android 在「系统浅色模式」下会把 PWA 底部的系统导航栏画成白色。这层对比底色
 *   由 Android 自己绘制（原生侧对应 setNavigationBarContrastEnforced），网页 / PWA
 *   拿不到任何 API 去改它 —— 调 theme-color、color-scheme 都只影响顶部状态栏。
 *   网页侧唯一有效的手段是让 PWA 走 display:fullscreen 进入沉浸模式：系统栏不再常驻
 *   显示，且 Chromium 在 fullscreen 下会忽略 theme_color、把系统栏强制设为纯黑。
 *
 * 为什么要单独派生一份：
 *   display 字段是全平台生效的。直接改 manifest.json 会让桌面 Chrome/Edge 装的 PWA
 *   也变成无边框全屏窗口。所以这里只派生 Android 专用清单，由 index.html 按 UA 动态
 *   挂载 —— Android 用本文件，其余平台（含 iOS）仍用 manifest.json，行为不变。
 *
 * 本文件由 `npm run build` 自动生成，请勿手工编辑。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SRC = path.join(ROOT, 'manifest.json');
const OUT = path.join(ROOT, 'manifest-android.json');

// 仅这两个字段与 manifest.json 不同；其余字段（name/icons/colors…）全部继承，
// 保证两份清单的 start_url 一致 —— Chrome 以 start_url 作为 app 身份，
// 因此已安装的 PWA 会被识别为同一个应用更新，而不是装出第二个图标。
const OVERRIDES = {
  display: 'fullscreen',
  display_override: ['fullscreen', 'standalone', 'minimal-ui'],
};

if (!fs.existsSync(SRC)) {
  console.error('[错误] manifest.json 不存在，无法派生 Android 清单');
  process.exit(1);
}

let base;
try {
  base = JSON.parse(fs.readFileSync(SRC, 'utf8'));
} catch (e) {
  console.error(`[错误] manifest.json 不是合法 JSON：${e.message}`);
  process.exit(1);
}

const android = { ...base, ...OVERRIDES };
const output = JSON.stringify(android, null, 4) + '\n';

const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (current === output) {
  console.log('[manifest-android.json] 已是最新，跳过写入');
} else {
  fs.writeFileSync(OUT, output, 'utf8');
  console.log('[manifest-android.json] 已从 manifest.json 派生（display: fullscreen）');
}
