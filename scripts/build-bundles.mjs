#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { BUNDLES } from '../build.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const version = fs.readFileSync(path.join(ROOT, 'VERSION.txt'), 'utf8').trim();
console.log('[build] version:', version);

// Bundle 清单的单一来源见 build.config.js
const byName = (name) => {
  const bundle = BUNDLES.find((item) => item.name === name);
  if (!bundle) throw new Error('未知 bundle：' + name);
  return bundle;
};

const CORE = byName('leletv-core');
const APP = byName('leletv-app');
const CATEGORY = byName('leletv-category');
const SETTINGS = byName('leletv-settings');
const PLAYER = byName('leletv-player');

/** 各 bundle 的持久 ESM 入口（阶段 5B-5：不再生成临时入口） */
function makeEntryPoints() {
  return [CORE, APP, CATEGORY, SETTINGS, PLAYER].map(config => ({
    in: path.join(ROOT, config.entry),
    out: config.name,
  }));
}

/** metafile 里的输出路径（相对 cwd）→ 相对 DIST 的 posix 路径 */
function distRelative(outPath) {
  const rel = path.relative(DIST, path.resolve(ROOT, outPath)).replace(/\\/g, '/');
  return rel;
}

/** 入口的静态 import（共享 chunk）→ modulepreload 标签 */
function preloadLinks(entryFiles, prefix, eol) {
  const seen = new Set();
  const links = [];
  for (const file of entryFiles) {
    const info = result.metafile.outputs[file];
    if (!info) continue;
    for (const imp of info.imports || []) {
      if (imp.kind !== 'import-statement') continue;
      const rel = distRelative(imp.path).replace(/^\.\//, '');
      if (seen.has(rel)) continue;
      seen.add(rel);
      links.push('    <link rel="modulepreload" href="' + prefix + rel + '?v=' + version + '">');
    }
  }
  return links.join(eol);
}

function stripJsScripts(html) {
  // 兼容普通 <script src> 与 5B-4 的 <script type="module" src>，避免重复注入
  return html.replace(/    <script[^>]*\bsrc="(\/)?(js|dist)\/.*?"[^>]*><\/script>\r?\n/g, '');
}

/** 上一次构建注入的 modulepreload 先移除，避免重复叠加 */
function stripModulePreloads(html) {
  return html.replace(/    <link rel="modulepreload" href="[^"]*"[^>]*>\r?\n/g, '');
}

/** 文件行尾：HTML 用 CRLF，写回时保持原样，避免把 LF 混进 CRLF 文件 */
function detectEol(html) {
  return html.includes('\r\n') ? '\r\n' : '\n';
}

/** 连续空行压成一个（3 个以上换行 → 2 个）：
    必须按 \r?\n 计数，否则 CRLF 文件里 \n 之间隔着 \r 匹配不到，每构建一次就多攒一个空行 */
function collapseBlankLines(html) {
  const eol = detectEol(html);
  return html.replace(/(?:\r?\n){3,}/g, eol + eol);
}

let result;

async function main() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(DIST)) {
    if (f.endsWith('.js') || f.endsWith('.js.map') || f.startsWith('.entry-')) {
      fs.unlinkSync(path.join(DIST, f));
    }
  }
  const chunksDir = path.join(DIST, 'chunks');
  if (fs.existsSync(chunksDir)) fs.rmSync(chunksDir, { recursive: true, force: true });

  console.log('[build] building (esm + splitting)...\n');
  const entryPoints = makeEntryPoints();
  result = await esbuild.build({
    entryPoints,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    outdir: DIST,
    entryNames: '[name].[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    logLevel: 'silent',
  });

  // 入口源文件 → 输出文件
  const bySource = new Map(entryPoints.map(e => [path.resolve(e.in), e.out]));
  const entryFiles = {};
  const entryMeta = {};
  for (const [outPath, info] of Object.entries(result.metafile.outputs)) {
    if (!info.entryPoint) continue;
    const name = bySource.get(path.resolve(ROOT, info.entryPoint));
    if (!name) continue;
    entryFiles[name] = distRelative(outPath);
    entryMeta[name] = outPath;
    const size = (info.bytes / 1024).toFixed(1);
    console.log('[build] ' + entryFiles[name] + ' (' + size + 'KB, entry)');
  }
  for (const [outPath, info] of Object.entries(result.metafile.outputs)) {
    if (info.entryPoint) continue;
    if (!outPath.endsWith('.js')) continue;
    console.log('[build] ' + distRelative(outPath) + ' (' + (info.bytes / 1024).toFixed(1) + 'KB, chunk)');
  }

  const coreFile = entryFiles[CORE.name];
  const appFile = entryFiles[APP.name];
  const playerFile = entryFiles[PLAYER.name];
  const categoryFile = entryFiles[CATEGORY.name];
  const settingsFile = entryFiles[SETTINGS.name];
  if (!coreFile || !appFile || !playerFile || !categoryFile || !settingsFile) {
    throw new Error('缺少入口产物：' + JSON.stringify(entryFiles));
  }

  // 供 check-budget 计算入口 + 共享 chunk 的真实体积
  fs.writeFileSync(path.join(DIST, '.build-meta.json'), JSON.stringify({
    outputs: result.metafile.outputs,
    entries: entryFiles,
    entryMeta,
  }));

  console.log('\n[build] updating HTML...');

  // --- index.html：源在 src/index.html，装配结果写根 index.html（Cloudflare Pages 入口）---
  let idx = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
  const idxEol = detectEol(idx);
  idx = stripModulePreloads(stripJsScripts(idx));
  const envMarker = '    <!-- \u73af\u5883\u53d8\u91cf\u6ce8\u5165\u811a\u672c -->';
  const idxPreload = preloadLinks([entryMeta[CORE.name], entryMeta[APP.name]], 'dist/', idxEol);
  const idxBundle = (idxPreload ? idxPreload + idxEol : '')
    + '    <script type="module" src="dist/' + coreFile + '?v=' + version + '"></script>' + idxEol
    + '    <script type="module" src="dist/' + appFile + '?v=' + version + '"></script>';
  idx = idx.replace(envMarker, idxBundle + idxEol + idxEol + envMarker);
  // 结果页预取播放页资源用的 bundle 名
  idx = idx.replace(/dist\/leletv-player\.[A-Za-z0-9]+\.js/g, 'dist/' + playerFile);
  // 页面按需 bundle 的映射（src/router/page-loader.ts 读取）
  const pageBundles = JSON.stringify({
    category: 'dist/' + categoryFile,
    settings: 'dist/' + settingsFile,
  });
  idx = idx.replace(/<meta name="leletv-page-bundles"[^>]*>/, '<meta name="leletv-page-bundles" content=\'' + pageBundles + '\'>');
  idx = collapseBlankLines(idx);
  fs.writeFileSync(path.join(ROOT, 'index.html'), idx, 'utf8');
  console.log('[src/index.html -> index.html] -> dist/' + coreFile + ' + dist/' + appFile);
  console.log('[page bundles] -> dist/' + categoryFile + ' + dist/' + settingsFile);

  // --- src/pages/player/index.html ---
  const PLAYER_PAGE = path.join(ROOT, 'src/pages/player/index.html');
  let ply = fs.readFileSync(PLAYER_PAGE, 'utf8');
  const plyEol = detectEol(ply);
  ply = stripModulePreloads(stripJsScripts(ply));
  // Insert after artplayer script (outside any <script> block)
  const plyAnchor = '    <script src="/libs/artplayer.min.js?v=' + version + '" defer crossorigin="anonymous"></script>';
  const plyPreload = preloadLinks([entryMeta[CORE.name], entryMeta[PLAYER.name]], '/dist/', plyEol);
  const plyBundle = (plyPreload ? plyPreload + plyEol : '')
    + '    <script type="module" src="/dist/' + coreFile + '?v=' + version + '"></script>' + plyEol
    + '    <script type="module" src="/dist/' + playerFile + '?v=' + version + '"></script>';
  ply = ply.replace(plyAnchor, plyAnchor + plyEol + plyBundle);
  ply = collapseBlankLines(ply);
  fs.writeFileSync(PLAYER_PAGE, ply, 'utf8');
  console.log('[src/pages/player/index.html] -> /dist/' + coreFile + ' + /dist/' + playerFile);

  console.log('\n[build] all done');
}

main().catch(err => {
  console.error('[build] failed:', err);
  process.exit(1);
});
