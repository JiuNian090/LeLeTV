#!/usr/bin/env node
/**
 * LeLeTV — 构建体积分析（阶段 5B-5：基于 esbuild splitting metafile）
 *
 * 构建脚本会把 metafile 写到 dist/.build-meta.json；本脚本据此列出
 * 每个入口、入口依赖闭包与共享 chunk 的体积。
 *
 * 用法：
 *   node scripts/analyze.js                 # 写入 docs/BASELINE.md
 *   node scripts/analyze.js --out docs/x.md # 写入指定文件
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLES } from '../build.config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'BASELINE.md');

const kb = n => (n / 1024).toFixed(1);
const num = n => n.toLocaleString('en-US');

function readMeta() {
  const metaPath = path.join(DIST, '.build-meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (err) {
    console.error('[analyze] 无法解析 dist/.build-meta.json:', err.message);
    return null;
  }
}

/** 递归收集一个输出键的依赖闭包（含自身） */
function closure(meta, key) {
  const seen = new Set();
  (function walk(k) {
    if (!k || seen.has(k)) return;
    const info = meta.outputs[k];
    if (!info) return;
    seen.add(k);
    for (const imp of info.imports || []) {
      if (imp.kind !== 'import-statement') continue;
      walk(imp.path);
    }
  })(key);
  return seen;
}

function sizeOf(meta, keys) {
  return [...keys].reduce((sum, k) => sum + (meta.outputs[k]?.bytes || 0), 0);
}

function main() {
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
  const meta = readMeta();
  if (!meta) {
    console.error('[analyze] 缺少 dist/.build-meta.json，请先运行 npm run build');
    process.exit(1);
  }

  const results = BUNDLES.map(bundle => {
    const key = meta.entryMeta[bundle.name];
    if (!key) return { ...bundle, key: null, deps: new Set(), entrySize: 0, closureSize: 0 };
    const deps = closure(meta, key);
    return {
      ...bundle,
      key,
      deps,
      entrySize: meta.outputs[key].bytes,
      closureSize: sizeOf(meta, deps),
    };
  });

  const chunkKeys = Object.keys(meta.outputs).filter(k => !meta.outputs[k].entryPoint && k.endsWith('.js'));
  const firstScreen = new Set();
  for (const r of results) if (r.firstScreen) for (const k of r.deps) firstScreen.add(k);
  const firstScreenSize = sizeOf(meta, firstScreen);

  const lines = [];
  lines.push('# 构建体积基线');
  lines.push('');
  lines.push('> 生成命令：`node scripts/analyze.js`');
  lines.push('>');
  lines.push(`> 版本：\`${version}\``);
  lines.push('>');
  lines.push(`> 生成时间：${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('## 口径说明');
  lines.push('');
  lines.push('- **入口**：esbuild 入口文件体积（不含 import 的共享 chunk）。');
  lines.push('- **闭包**：入口及其静态 import 的全部 chunk（按 metafile 递归、去重）。');
  lines.push('- **首屏**：`leletv-core` + `leletv-app` 闭包并集，共享 chunk 只计一次。');
  lines.push('');
  lines.push('## 总览');
  lines.push('');
  lines.push('| bundle | 首屏 | 入口 | 闭包 | 产物 |');
  lines.push('|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| \`${r.name}\` | ${r.firstScreen ? '是' : '否'} | ${r.entrySize ? kb(r.entrySize) + ' KB' : '未构建'} | ${r.closureSize ? kb(r.closureSize) + ' KB' : '未构建'} | ${r.key || '—'} |`);
  }
  lines.push(`| **首屏 core + app** | 是 | — | **${kb(firstScreenSize)} KB** | 共享 chunk 去重 |`);
  lines.push('');
  lines.push('## 共享 chunk');
  lines.push('');
  if (!chunkKeys.length) {
    lines.push('无（未启用 splitting 或只构建了单入口）。');
  } else {
    lines.push('| chunk | 体积 |');
    lines.push('|---|---|');
    for (const k of chunkKeys) {
      lines.push(`| \`${k}\` | ${kb(meta.outputs[k].bytes)} KB |`);
    }
  }
  lines.push('');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log('[analyze] version:', version);
  for (const r of results) {
    console.log(`[analyze] ${r.name}: entry ${num(r.entrySize)} B, closure ${num(r.closureSize)} B`);
  }
  console.log(`[analyze] 首屏 core+app（含共享 chunk）: ${num(firstScreenSize)} B (${kb(firstScreenSize)} KB)`);
  console.log('[analyze] ->', path.relative(ROOT, outPath).replace(/\\/g, '/'));
}

main();
