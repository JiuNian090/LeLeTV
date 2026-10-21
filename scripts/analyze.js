#!/usr/bin/env node
/**
 * LeLeTV — 构建体积分析（阶段 0 基线）
 *
 * 现状约束（见 REFACTOR_PLAN 阶段 -1 报告 C-2）：
 *   当前 scripts/build-bundles.mjs 是「按清单字符串拼接 + esbuild.transform」，
 *   不是 esbuild.build()，因此拿不到原生 metafile。本脚本用等价方式产出
 *   可比较的基线：逐个源文件 minify 体积 + 拼接后 bundle minify 体积 +
 *   dist/ 实际产物体积。
 *
 * 用法：
 *   node scripts/analyze.js                 # 写入 docs/BASELINE.md
 *   node scripts/analyze.js --out docs/x.md # 写入指定文件
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'BASELINE.md');

// 与 scripts/build-bundles.mjs 的清单保持一致（阶段 3 重写构建后改为单一来源）
const BUNDLES = [
  {
    name: 'leletv-core',
    firstScreen: true,
    files: [
      'js/core/config.js', 'js/api/remote-sources.js',
      'js/core/leletv-global.js', 'js/core/storage-service.js',
      'js/core/listener-tracker.js', 'js/core/timing.js',
      'js/auth/proxy-auth.js', 'js/auth/password.js', 'js/auth/invite-auth.js',
      'js/ui/ui-core.js', 'js/ui/motion-pref.js', 'js/ui/line-probe.js',
    ],
  },
  {
    name: 'leletv-app',
    firstScreen: true,
    files: [
      'js/api/api-config.js', 'js/api/loadBalancer.js',
      'js/ui/ui-search-history.js', 'js/ui/ui-viewing-history.js', 'js/ui/ui.js',
      'js/api/api.js', 'js/api/search.js',
      'js/player/player-bridge.js', 'js/ui/search-cards.js', 'js/ui/movies-page.js',
      'js/app/app-search.js', 'js/app/app-config.js', 'js/api/source-port.js', 'js/app/app.js',
      'js/app/app-init.js', 'js/app/page-loader.js', 'js/app/app-routing.js',
      'js/utils/version-updater.js', 'js/core/cache-manager.js',
      'js/effects/hub-flow.js', 'js/ui/brand-canvas.js', 'js/ui/home-shelves.js', 'js/ui/hero-glass.js',
      'js/ui/home-recent.js', 'js/ui/nav-search.js', 'js/ui/pwa-install.js', 'js/ui/layout-pref.js',
      'js/app/boot-sequence.js',
    ],
  },
  {
    name: 'leletv-category',
    firstScreen: false,
    files: ['js/api/tmdb.js'],
  },
  {
    name: 'leletv-settings',
    firstScreen: false,
    files: [
      'js/ui/theme-system.js', 'js/auth/admin-panel.js', 'js/auth/user-devices.js',
    ],
  },
  {
    name: 'leletv-player',
    firstScreen: false,
    files: [
      'js/api/api.js', 'js/api/search.js', 'js/ui/ui-viewing-history.js',
      'js/player/player-manager.js', 'js/player/player-shortcuts.js',
      'js/player/player-core.js', 'js/player/player-episodes.js',
      'js/player/player-ui.js', 'js/player/player-failover.js', 'js/player/player-lights.js',
      'js/player/player-detail.js', 'js/player/player-quality.js', 'js/player/player.js',
      'js/utils/version-updater.js', 'js/core/cache-manager.js',
    ],
  },
];

const kb = n => (n / 1024).toFixed(1);
const num = n => n.toLocaleString('en-US');

async function minifiedSize(content) {
  const result = await esbuild.transform(content, {
    minify: true,
    target: ['es2020'],
    sourcefile: 'analyze.js',
  });
  return Buffer.byteLength(result.code, 'utf8');
}

function concatFiles(files) {
  return files.map(f => {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) return '';
    return '/* ' + f + ' */\n' + fs.readFileSync(abs, 'utf8');
  }).join('\n');
}

function findDist(name, distFiles) {
  return distFiles.find(f => f.startsWith(name + '.') && f.endsWith('.js')) || null;
}

async function main() {
  const outIdx = process.argv.indexOf('--out');
  let outPath = DEFAULT_OUT;
  if (outIdx > -1) {
    const value = process.argv[outIdx + 1];
    if (!value) {
      console.error('[analyze] --out 需要一个路径');
      process.exit(1);
    }
    outPath = path.resolve(ROOT, value);
  }

  const version = fs.readFileSync(path.join(ROOT, 'VERSION.txt'), 'utf8').trim();
  const distFiles = fs.existsSync(DIST)
    ? fs.readdirSync(DIST).filter(f => f.endsWith('.js'))
    : [];

  const results = [];
  for (const bundle of BUNDLES) {
    const missing = bundle.files.filter(f => !fs.existsSync(path.join(ROOT, f)));
    const modules = await Promise.all(bundle.files.map(async file => {
      const abs = path.join(ROOT, file);
      if (!fs.existsSync(abs)) return { file, raw: 0, min: 0, missing: true };
      const src = fs.readFileSync(abs, 'utf8');
      return { file, raw: Buffer.byteLength(src, 'utf8'), min: await minifiedSize(src), missing: false };
    }));
    modules.sort((a, b) => b.min - a.min);

    const bundleMin = await minifiedSize(concatFiles(bundle.files));
    const distFile = findDist(bundle.name, distFiles);
    const distSize = distFile ? fs.statSync(path.join(DIST, distFile)).size : 0;
    const rawTotal = modules.reduce((a, m) => a + m.raw, 0);
    const moduleMinTotal = modules.reduce((a, m) => a + m.min, 0);

    results.push({
      ...bundle, modules, missing, distFile, bundleMin, distSize, rawTotal, moduleMinTotal,
    });
  }

  const firstScreen = results.filter(r => r.firstScreen);
  const firstScreenMin = firstScreen.reduce((a, r) => a + r.bundleMin, 0);
  const firstScreenDist = firstScreen.reduce((a, r) => a + r.distSize, 0);

  const lines = [];
  lines.push('# 构建体积基线');
  lines.push('');
  lines.push(`> 生成命令：\`node scripts/analyze.js\`  `);
  lines.push(`> 版本：\`${version}\`  `);
  lines.push(`> 生成时间：${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('## 口径说明');
  lines.push('');
  lines.push('- **原始**：源文件字节数之和。');
  lines.push('- **模块 minified**：每个源文件单独交给 `esbuild.transform({ minify: true })` 后的字节数，用于模块间排序，不等于最终 bundle 体积。');
  lines.push('- **bundle minified**：与 `scripts/build-bundles.mjs` 相同的拼接顺序压缩后的字节数。');
  lines.push('- **dist 实际**：`dist/` 中当前构建产物（带内容哈希）的字节数；若为 0，说明尚未构建。');
  lines.push('');
  lines.push('## 总览');
  lines.push('');
  lines.push('| bundle | 首屏 | 模块数 | 原始 | 模块 minified 合计 | bundle minified | dist 实际 |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| \`${r.name}\` | ${r.firstScreen ? '是' : '否'} | ${r.modules.length} | ${kb(r.rawTotal)} KB | ${kb(r.moduleMinTotal)} KB | ${kb(r.bundleMin)} KB | ${r.distFile ? kb(r.distSize) + ' KB' : '未构建'} |`);
  }
  lines.push(`| **首屏 core + app** | 是 | — | **${kb(firstScreen.reduce((a, r) => a + r.rawTotal, 0))} KB** | — | **${kb(firstScreenMin)} KB** | **${firstScreenDist ? kb(firstScreenDist) + ' KB' : '未构建'}** |`);
  lines.push('');
  lines.push('## 模块体积排序');
  lines.push('');
  for (const r of results) {
    lines.push(`### ${r.name}${r.firstScreen ? '（首屏）' : ''}`);
    lines.push('');
    if (r.missing.length) {
      lines.push(`> ⚠️ 缺失文件：${r.missing.map(f => '`' + f + '`').join('、')}`);
      lines.push('');
    }
    lines.push('| # | 模块 | 原始 | minified |');
    lines.push('|---|---|---|---|');
    r.modules.forEach((m, i) => {
      lines.push(`| ${i + 1} | \`${m.file}\` | ${kb(m.raw)} KB | ${kb(m.min)} KB |`);
    });
    lines.push('');
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log('[analyze] version:', version);
  console.log('[analyze] bundles:', results.length);
  for (const r of results) {
    console.log(`[analyze] ${r.name}: raw ${num(r.rawTotal)} B, bundle-min ${num(r.bundleMin)} B, dist ${r.distSize ? num(r.distSize) + ' B' : '未构建'}`);
  }
  console.log(`[analyze] 首屏 core+app bundle-min: ${num(firstScreenMin)} B (${kb(firstScreenMin)} KB)`);
  console.log('[analyze] ->', path.relative(ROOT, outPath).replace(/\\/g, '/'));
}

main().catch(err => {
  console.error('[analyze] failed:', err);
  process.exit(1);
});
