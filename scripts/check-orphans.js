#!/usr/bin/env node
/**
 * 零引用文件检测（REFACTOR_PLAN 5.7；阶段 5B-5 起基于真实 import 图）
 *
 * 只报告，不删除。分级：
 *   A 可自动删候选：零引用 + 不在白名单
 *   B 需人工确认：零引用 + dynamic 白名单（动态加载 / 命名疑似动态）
 *   C 明确保留：keep 白名单
 *
 * 判定口径：
 *   1. 以 build.config.js 的 5 个 ESM 入口为根；
 *   2. TS/JS 的相对 import / export ... from / 动态 import / require 递归解析为真实文件；
 *   3. HTML / CSS / JSON / 字符串路径继续做文本引用扫描（page-loader 的片段、样式、fetch JSON 等）；
 *   4. 入口文件本身不算零引用。
 *
 * 用法：
 *   node scripts/check-orphans.js                # 报告，退出码 0
 *   node scripts/check-orphans.js --fail-on-a    # 存在 A 级时退出码 1
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import config from './orphans.config.js';
import { BUNDLES } from '../build.config.js';

const ROOT = process.cwd();
const FAIL_ON_A = process.argv.includes('--fail-on-a');

const tracked = execSync('git ls-files', { encoding: 'utf8', cwd: ROOT })
  .trim().split(/\r?\n/).filter(Boolean);

const CANDIDATE = /\.(js|mjs|ts|tsx|css|html|svg|png|webp|jpg|jpeg|woff2|json)$/;
// 引用源：只算代码 / 页面 / 构建配置，不算文档与 AI 资产
const REF_SOURCE = /\.(js|mjs|ts|tsx|html|css|json|toml|yml|yaml|txt)$/;
const SKIP_SOURCE = [/^\.agents\//, /^docs\//];
const CODE_SOURCE = /\.(js|mjs|ts|tsx)$/;
const RESOLVE_EXT = ['.ts', '.tsx', '.js', '.mjs', '.jsx', '.json'];

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp('^' + escaped + '$');
}

const keepRes = config.keep.map(globToRegExp);
const dynamicRes = config.dynamic.map(globToRegExp);

const candidates = tracked.filter(p => CANDIDATE.test(p) && !p.startsWith('.agents/'));
const sourceFiles = tracked.filter(p =>
  REF_SOURCE.test(p) &&
  !SKIP_SOURCE.some(re => re.test(p))
);

const texts = new Map();
for (const file of sourceFiles) {
  try {
    texts.set(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch {
    // 二进制或不可读，跳过
  }
}

/** 相对 specifier → 真实文件（None 表示外部包或未找到） */
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  const candidates = [
    base,
    ...RESOLVE_EXT.map(e => base + e),
    ...RESOLVE_EXT.map(e => path.join(base, 'index' + e)),
  ];
  const hit = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  return hit ? path.relative(ROOT, hit).replace(/\\/g, '/') : null;
}

/** 提取 TS/JS 的模块引用说明符 */
function extractSpecs(code) {
  const specs = [];
  const patterns = [
    /(?:^|[;\s}])(?:import|export)\s+type\s[^;]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|[;\s}])(?:import|export)\s+(?!type\s)[^;]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) specs.push(m[1]);
  }
  return specs;
}

const referenced = new Set();

// 1) 真实 import 图
for (const [file, text] of texts) {
  if (!CODE_SOURCE.test(file)) continue;
  for (const spec of extractSpecs(text)) {
    const target = resolveSpec(file, spec);
    if (target) referenced.add(target);
  }
}

// 2) 文本引用（HTML / CSS / JSON / 字符串路径）
function referencedByText(target) {
  const base = path.basename(target);
  const safeBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^A-Za-z0-9_.\\-])' + safeBase + '([^A-Za-z0-9_.\\-]|$)');
  const hits = [];
  for (const [source, text] of texts) {
    if (source === target) continue;
    if (text.includes(target) || re.test(text)) hits.push(source);
  }
  return hits;
}

for (const target of candidates) {
  if (referenced.has(target)) continue;
  if (referencedByText(target).length) referenced.add(target);
}

// 3) 入口是根，不算零引用
const roots = new Set(BUNDLES.map(b => b.entry.replace(/\\/g, '/')));

const A = [];
const B = [];
const C = [];

for (const target of candidates) {
  if (roots.has(target)) continue;
  if (keepRes.some(re => re.test(target))) {
    C.push(target);
    continue;
  }
  if (referenced.has(target)) continue;
  if (dynamicRes.some(re => re.test(target))) B.push(target);
  else A.push(target);
}

console.log(`[orphans] 候选 ${candidates.length} 个；入口 ${roots.size} 个；A=${A.length} B=${B.length} C=${C.length}`);
console.log('\nA 级（零引用，可自动删候选 —— 阶段 4.5 需人工批准）');
for (const p of A) console.log('  A ' + p);
console.log('\nB 级（零引用，但命中 dynamic 白名单 —— 人工确认）');
for (const p of B) console.log('  B ' + p);
console.log('\nC 级（keep 白名单，直接保留）');
for (const p of C) console.log('  C ' + p);

if (FAIL_ON_A && A.length) {
  console.error('\n[orphans] FAIL：存在 A 级候选');
  process.exit(1);
}
console.log('\n[orphans] 完成（阶段 4.5 前不删除任何文件）');
