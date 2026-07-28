#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const version = fs.readFileSync(path.join(ROOT, 'VERSION.txt'), 'utf8').trim();
console.log('[build] version:', version);

// Bundle configs
const CORE = {
  name: 'leletv-core',
  files: [
    'js/core/config.js', 'js/core/leletv-global.js', 'js/core/storage-service.js',
    'js/core/listener-tracker.js', 'js/core/timing.js',
    'js/auth/proxy-auth.js', 'js/auth/password.js', 'js/auth/invite-auth.js',
    'js/ui/ui-core.js',
  ],
};

const APP = {
  name: 'leletv-app',
  files: [
    'js/api/api-config.js', 'js/api/loadBalancer.js',
    'js/ui/ui-search-history.js', 'js/ui/ui-viewing-history.js', 'js/ui/ui.js',
    'js/api/api.js', 'js/api/search.js', 'js/api/tmdb.js',
    'js/player/player-bridge.js', 'js/ui/search-cards.js',
    'js/app/app-search.js', 'js/app/app-config.js', 'js/app/app.js',
    'js/app/app-init.js', 'js/app/app-routing.js',
    'js/utils/version-updater.js', 'js/core/cache-manager.js',
    'js/effects/aurora-bg.js', 'js/effects/title-animation.js', 'js/utils/index-page.js',
  ],
};

const PLAYER = {
  name: 'leletv-player',
  files: [
    'js/api/api.js', 'js/api/search.js',
    'js/player/player-manager.js', 'js/player/player-shortcuts.js',
    'js/player/player-core.js', 'js/player/player-episodes.js',
    'js/player/player-ui.js', 'js/player/player-detail.js', 'js/player/player-quality.js', 'js/player/player.js',
    'js/utils/version-updater.js', 'js/core/cache-manager.js',
    'js/effects/aurora-bg.js',
  ],
};

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
    sourcefile: config.name + '.js',
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
  return html.replace(/    <script src="(js|dist)\/.*?"[^>]*><\/script>\r?\n/g, '');
}

async function main() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(DIST)) {
    if (f.endsWith('.js') || f.endsWith('.js.map')) {
      fs.unlinkSync(path.join(DIST, f));
    }
  }
  console.log('[build] building...\n');

  const [coreFile, appFile, playerFile] = await Promise.all([
    buildBundle(CORE), buildBundle(APP), buildBundle(PLAYER),
  ]);

  console.log('\n[build] updating HTML...');

  // --- index.html ---
  let idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  idx = stripJsScripts(idx);
  const envMarker = '    <!-- \u73af\u5883\u53d8\u91cf\u6ce8\u5165\u811a\u672c -->';
  const idxBundle = '    <script src="dist/' + coreFile + '?v=' + version + '" defer></script>\n    <script src="dist/' + appFile + '?v=' + version + '" defer></script>';
  idx = idx.replace(envMarker, idxBundle + '\n\n' + envMarker);
  idx = idx.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(ROOT, 'index.html'), idx, 'utf8');
  console.log('[index.html] -> dist/' + coreFile + ' + dist/' + appFile);

  // --- player.html ---
  let ply = fs.readFileSync(path.join(ROOT, 'player.html'), 'utf8');
  ply = stripJsScripts(ply);
  // Insert after artplayer script (outside any <script> block)
  const plyAnchor = '    <script src="libs/artplayer.min.js?v=' + version + '" defer crossorigin="anonymous"></script>';
  const plyBundle = '    <script src="dist/' + coreFile + '?v=' + version + '" defer></script>\n    <script src="dist/' + playerFile + '?v=' + version + '" defer></script>';
  ply = ply.replace(plyAnchor, plyAnchor + '\n' + plyBundle);
  ply = ply.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(ROOT, 'player.html'), ply, 'utf8');
  console.log('[player.html] -> dist/' + coreFile + ' + dist/' + playerFile);

  console.log('\n[build] all done');
}

main().catch(err => {
  console.error('[build] failed:', err);
  process.exit(1);
});
