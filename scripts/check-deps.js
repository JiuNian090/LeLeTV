#!/usr/bin/env node
/**
 * 分层与循环依赖检查（REFACTOR_PLAN 4）
 *
 * - 扫描 js/ 与 src/ 中的相对 import / require / 动态 import
 * - 按 src/ 的层规则判断依赖方向
 * - 检测循环依赖
 * - 统计剩余 .js 数量作为迁移进度
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'js'].filter(d => fs.existsSync(path.join(ROOT, d)));

const EXT = ['.ts', '.tsx', '.js', '.mjs', '.jsx', '.json'];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx|js|mjs|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function layerOf(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('src/core/')) return 'core';
  if (rel.startsWith('src/services/')) return 'services';
  if (rel.startsWith('src/ui/')) return 'ui';
  if (rel.startsWith('src/pages/')) return 'pages';
  if (rel.startsWith('src/router/')) return 'router';
  if (rel === 'src/main.ts') return 'main';
  return null;
}

const ALLOWED = {
  core: new Set(['core']),
  services: new Set(['core', 'services']),
  ui: new Set(['core', 'ui']),
  pages: new Set(['core', 'services', 'ui', 'pages']),
  router: new Set(['core', 'pages', 'router']),
  main: new Set(['core', 'services', 'ui', 'pages', 'router', 'main']),
};

function pageNameOf(file) {
  const rel = path.relative(path.join(ROOT, 'src/pages'), file).replace(/\\/g, '/');
  return rel.split('/')[0];
}

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...EXT.map(e => base + e), ...EXT.map(e => path.join(base, 'index' + e))];
  return candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile()) || base;
}

function extractImports(code) {
  const results = [];
  const patterns = [
    { re: /(?:^|[;\s}])(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g, dynamic: false },
    { re: /\bimport\s*['"]([^'"]+)['"]/g, dynamic: false },
    { re: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, dynamic: true },
    { re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, dynamic: false },
  ];
  for (const { re, dynamic } of patterns) {
    let m;
    while ((m = re.exec(code))) results.push({ spec: m[1], dynamic });
  }
  return results;
}

const files = SCAN_DIRS.flatMap(d => walk(path.join(ROOT, d)));
const graph = new Map();
const errors = [];
let srcCount = 0;
let jsCount = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('src/') && rel.endsWith('.js')) {
    srcCount++;
    errors.push(`src/ 下出现 .js 文件：${rel}`);
  }
  if (rel.startsWith('js/') && rel.endsWith('.js')) jsCount++;

  const fromLayer = layerOf(file);
  const code = fs.readFileSync(file, 'utf8');
  const targets = [];

  for (const { spec, dynamic } of extractImports(code)) {
    const target = resolveSpec(file, spec);
    if (!target) continue;
    const targetRel = path.relative(ROOT, target).replace(/\\/g, '/');
    targets.push(targetRel);
    const toLayer = layerOf(target);
    if (!fromLayer || !toLayer) continue;

    if (fromLayer === 'pages' && toLayer === 'pages' && pageNameOf(file) !== pageNameOf(target)) {
      errors.push(`${rel} 跨页面 import ${targetRel}（pages 之间禁止互相 import）`);
      continue;
    }
    if (toLayer === 'pages' && fromLayer !== 'router' && fromLayer !== 'main'
        && !(fromLayer === 'pages' && pageNameOf(file) === pageNameOf(target))) {
      errors.push(`${rel}（${fromLayer}）import 页面 ${targetRel}`);
      continue;
    }
    if (fromLayer === 'router' && toLayer === 'pages' && !dynamic) {
      errors.push(`${rel} 静态 import 页面 ${targetRel}（router 只能用动态 import）`);
      continue;
    }
    if (!ALLOWED[fromLayer].has(toLayer)) {
      errors.push(`${rel}（${fromLayer}）不允许依赖 ${toLayer}：${targetRel}`);
    }
  }
  graph.set(rel, targets);
}

// 循环依赖（三色 DFS）
const state = new Map();
function dfs(node, stack) {
  state.set(node, 1);
  stack.push(node);
  for (const next of graph.get(node) || []) {
    if (!graph.has(next)) continue;
    if (state.get(next) === 1) {
      const start = stack.indexOf(next);
      errors.push('循环依赖：' + stack.slice(start).concat(next).join(' -> '));
    } else if (!state.get(next)) {
      dfs(next, stack);
    }
  }
  stack.pop();
  state.set(node, 2);
}
for (const node of graph.keys()) if (!state.get(node)) dfs(node, []);

console.log(`[deps] 扫描 ${files.length} 个文件（src ${files.filter(f => path.relative(ROOT, f).startsWith('src')).length} / js ${jsCount}）`);
console.log(`[deps] 迁移进度：剩余 js/ .js = ${jsCount}，src/ .js = ${srcCount}`);

if (errors.length) {
  console.error('\n[deps] FAIL');
  for (const e of [...new Set(errors)]) console.error(' - ' + e);
  process.exit(1);
}
console.log('[deps] OK');
