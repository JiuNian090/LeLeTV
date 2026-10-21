#!/usr/bin/env node
/**
 * 硬规则校验（REFACTOR_PLAN 阶段 1）
 * 校验对象：规则/技能/迁移文档是否齐备、src/ 是否混入 .js、类型逃逸、pages 互引。
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function read(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

const REQUIRED_RULES = [
  '01-layering.md', '02-page-structure.md', '03-chunking.md',
  '04-naming.md', '05-cloudflare.md', '06-forbidden.md', '07-typescript.md',
];
for (const rule of REQUIRED_RULES) {
  if (!fs.existsSync(path.join(ROOT, '.agents/rules', rule))) errors.push(`缺少规则：.agents/rules/${rule}`);
}

const agents = read('AGENTS.md');
if (!agents) errors.push('缺少 AGENTS.md');
else if (!agents.includes('<!-- AGENT-INDEX:START -->') || !agents.includes('<!-- AGENT-INDEX:END -->')) {
  errors.push('AGENTS.md 缺少 AGENT-INDEX 标记区块');
}

const claude = read('CLAUDE.md');
if (!claude) errors.push('缺少 CLAUDE.md');
else if (!claude.includes('@AGENTS.md')) errors.push('CLAUDE.md 未导入 @AGENTS.md');

for (const f of ['INVENTORY.md', 'MAP.md', 'APPROVALS.md', 'CLEANUP.md']) {
  if (!fs.existsSync(path.join(ROOT, '.agents/migration', f))) errors.push(`缺少迁移文档：.agents/migration/${f}`);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

for (const dir of ['src', 'js']) {
  for (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (rel.startsWith('src/') && rel.endsWith('.js')) errors.push(`src/ 下禁止 .js：${rel}`);
    if (!/\.(ts|js)$/.test(rel)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/(\bas\s+any\b|:\s*any\b|@ts-ignore|@ts-expect-error)/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) {
        errors.push(`类型逃逸 ${rel}:${i + 1}：${line.trim().slice(0, 100)}`);
      }
    });
  }
}

// pages 互引（src/pages/<a> -> src/pages/<b>）
const pagesDir = path.join(ROOT, 'src/pages');
if (fs.existsSync(pagesDir)) {
  for (const file of walk(pagesDir)) {
    if (!/\.(ts|js)$/.test(file)) continue;
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const self = rel.split('/')[2];
    const code = fs.readFileSync(file, 'utf8');
    const re = /from\s*['"](\.[^'"]*pages\/([^/'"]+))[^'"]*['"]/g;
    let m;
    while ((m = re.exec(code))) {
      if (m[2] !== self) errors.push(`${rel} 跨页面 import：${m[1]}`);
    }
  }
}

if (errors.length) {
  console.error('[agents] FAIL');
  for (const e of [...new Set(errors)]) console.error(' - ' + e);
  process.exit(1);
}
console.log('[agents] OK');
