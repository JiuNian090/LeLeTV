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

function concatFiles(fileList) {
  return fileList.map(f => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { console.warn('[warn] missing:', p); return ''; }
    return '/* ' + f + ' */\n' + fs.readFileSync(p, 'utf8');
  }).join('\n');
}

function hashContent(content) {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h) + content.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36).substring(0, 8);
}

async function buildBundle(config) {
  const content = concatFiles(config.files);
  const h = hashContent(content);
  const outName = config.name + '.' + h + '.js';
  const outPath = path.join(DIST, outName);

  const result = await esbuild.transform(content, {
    minify: true,
    sourcemap: true,
    sourcefile: config.name + '.ts',
    loader: 'ts',
    target: ['es2020'],
  });

  fs.writeFileSync(outPath, result.code);
  if (result.map) {
    const mapPath = outPath + '.map';
    const map = JSON.parse(result.map);
    map.sources = map.sources.map(s => '../' + (config.files[0] || s));
    fs.writeFileSync(mapPath, JSON.stringify(map));
  }

  console.log('[build] ' + outName + ' (' + (result.code.length / 1024).toFixed(1) + 'KB)');
  return outName;
}

function stripJsScripts(html) {
  return html.replace(/    <script src="(\/)?(js|dist)\/.*?"[^>]*><\/script>\r?\n/g, '');
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

async function main() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(DIST)) {
    if (f.endsWith('.js') || f.endsWith('.js.map')) {
      fs.unlinkSync(path.join(DIST, f));
    }
  }
  console.log('[build] building...\n');

  const [coreFile, appFile, playerFile, categoryFile, settingsFile] = await Promise.all([
    buildBundle(CORE), buildBundle(APP), buildBundle(PLAYER),
    buildBundle(CATEGORY), buildBundle(SETTINGS),
  ]);

  console.log('\n[build] updating HTML...');

  // --- index.html：源在 src/index.html，装配结果写根 index.html（Cloudflare Pages 入口）---
  let idx = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
  const idxEol = detectEol(idx);
  idx = stripJsScripts(idx);
  const envMarker = '    <!-- \u73af\u5883\u53d8\u91cf\u6ce8\u5165\u811a\u672c -->';
  const idxBundle = '    <script src="dist/' + coreFile + '?v=' + version + '" defer></script>' + idxEol
    + '    <script src="dist/' + appFile + '?v=' + version + '" defer></script>';
  idx = idx.replace(envMarker, idxBundle + idxEol + idxEol + envMarker);
  // 结果页预取播放页资源用的 bundle 名
  idx = idx.replace(/dist\/leletv-player\.[a-z0-9]+\.js/g, 'dist/' + playerFile);
  // 页面按需 bundle 的映射（js/app/page-loader.js 读取）
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
  ply = stripJsScripts(ply);
  // Insert after artplayer script (outside any <script> block)
  const plyAnchor = '    <script src="/libs/artplayer.min.js?v=' + version + '" defer crossorigin="anonymous"></script>';
  const plyBundle = '    <script src="/dist/' + coreFile + '?v=' + version + '" defer></script>' + plyEol
    + '    <script src="/dist/' + playerFile + '?v=' + version + '" defer></script>';
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
