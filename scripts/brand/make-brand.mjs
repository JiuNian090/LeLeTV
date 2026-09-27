#!/usr/bin/env node
/**
 * 一键重出品牌位图：6 张图标 PNG + 27 张 iOS 启动图。
 *
 * 用法：
 *   node scripts/brand/make-brand.mjs                       # 按 image/brand/*.svg 现有颜色重出
 *   node scripts/brand/make-brand.mjs --color '#FFFFFF'     # 先把源 SVG 里 Le 的填充改成该色，再重出
 *   node scripts/brand/make-brand.mjs --bump le3            # 顺带把 HTML/manifest 的缓存版本号升到 le3
 *
 * 注意：源 SVG 里 Le 路径的 fill 会被 --color 改写（radialGradient 的粉色氛围光晕不动）。
 * 输出直接覆盖 image/brand/ 与 image/splash/，改动后记得走一遍 git diff 核对。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BRAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(BRAND_DIR, '..', '..');
const IMG = path.join(ROOT, 'image', 'brand');
const SPLASH = path.join(ROOT, 'image', 'splash');

// 会被改色的源 SVG（Le 路径所在）
const SVG_SOURCES = ['leletv-favicon.svg', 'leletv-app-icon.svg', 'leletv-app-icon-maskable.svg'];

// 图标产物：源 SVG、输出名、像素尺寸。
// 背景一律 transparent——应用图标 SVG 是圆角矩形，四角必须是透明，
// 若渲染成不透明背景会在深色壁纸上留出一圈白角。
const ICONS = [
  { svg: 'leletv-favicon.svg', out: 'favicon-32.png', w: 32, h: 32 },
  { svg: 'leletv-app-icon.svg', out: 'apple-touch-icon-180.png', w: 180, h: 180 },
  { svg: 'leletv-app-icon.svg', out: 'leletv-icon-192.png', w: 192, h: 192 },
  { svg: 'leletv-app-icon.svg', out: 'leletv-icon-512.png', w: 512, h: 512 },
  { svg: 'leletv-app-icon-maskable.svg', out: 'leletv-icon-maskable-192.png', w: 192, h: 192 },
  { svg: 'leletv-app-icon-maskable.svg', out: 'leletv-icon-maskable-512.png', w: 512, h: 512 },
];

const SPLASH_LOGO_PX = 1024; // 启动图 logo 源的分辨率（缩放到设备短边的 0.2197）

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const color = opt('--color');
const bump = opt('--bump');

// ---------- 1. 可选改色 ----------
if (color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    console.error('--color 需要形如 #FFFFFF 的十六进制色值');
    process.exit(2);
  }
  console.log(`[1/4] 把源 SVG 的 Le 填充改为 ${color}`);
  for (const f of SVG_SOURCES) {
    const p = path.join(IMG, f);
    const s = fs.readFileSync(p, 'utf8');
    const next = s.replace(/(<path\b[^>]*?\bfill=")[^"]*(")/, '$1' + color + '$2');
    if (next === s) {
      console.warn(`  未匹配到 <path fill>: ${f}（跳过）`);
      continue;
    }
    fs.writeFileSync(p, next, 'utf8');
    console.log(`  ${f}  →  ${color}`);
  }
} else {
  console.log('[1/4] 未指定 --color，按源 SVG 现有颜色重出');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leletv-brand-'));
const run = (script, args, cwd) => execFileSync('node', [path.join(BRAND_DIR, script), ...args], { cwd: cwd || ROOT, stdio: 'inherit' });

try {
  // ---------- 2. 渲染图标并量化 ----------
  console.log('[2/4] 渲染图标（临时真彩）');
  const rawIcons = [];
  for (const ic of ICONS) {
    const raw = path.join(tmp, 'raw-' + ic.out);
    run('render-svg.mjs', [path.join(IMG, ic.svg), raw, String(ic.w), String(ic.h), 'transparent']);
    rawIcons.push({ raw, out: path.join(IMG, ic.out) });
  }

  console.log('[3/4] 量化到 256 色调色板并落地 image/brand/');
  for (const { raw, out } of rawIcons) run('quantize.mjs', [raw, out]);

  // ---------- 3. 启动图 ----------
  const logo = path.join(tmp, 'logo-app-icon.png');
  run('render-svg.mjs', [path.join(IMG, 'leletv-app-icon.svg'), logo,
    String(SPLASH_LOGO_PX), String(SPLASH_LOGO_PX), 'transparent']);
  console.log('[4/4] 生成 27 张启动图 → image/splash/');
  run('gen-splash.mjs', [logo, '0.2197', SPLASH]);

  // ---------- 4. 可选升版本号 ----------
  if (bump) {
    console.log(`\n[bump] 升级品牌图片缓存版本号 → ${bump}`);
    run('bump-version.mjs', [bump]);
  } else {
    console.log('\n提示：图片内容变了，记得升缓存版本号：node scripts/brand/bump-version.mjs le3');
  }

  console.log('\n完成。核对：node scripts/brand/png-info.mjs image/brand/*.png');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
