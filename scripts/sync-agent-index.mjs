#!/usr/bin/env node
/**
 * 生成 / 校验 AI Agent 索引
 *
 *   node scripts/sync-agent-index.mjs          写入索引
 *   node scripts/sync-agent-index.mjs --check  只检查是否已同步，不一致时退出码 1
 *
 * 数据源（单一内容源，不依赖任何工具的私有目录）：
 *   .agents/skills/<name>/SKILL.md  → 读 frontmatter 的 name / description
 *   .agents/rules/*.md              → 读首个一级标题
 *
 * 输出：
 *   AGENTS.md 中 <!-- AGENT-INDEX:START --> … <!-- AGENT-INDEX:END --> 之间的区块
 *   .agents/skills/INDEX.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
const RULES_DIR = path.join(ROOT, '.agents', 'rules');
const AGENTS_MD = path.join(ROOT, 'AGENTS.md');
const INDEX_MD = path.join(SKILLS_DIR, 'INDEX.md');

const START = '<!-- AGENT-INDEX:START -->';
const END = '<!-- AGENT-INDEX:END -->';

const isCheck = process.argv.includes('--check');

function stripQuotes(s) {
  return s.trim().replace(/^["']/, '').replace(/["']$/, '').trim();
}

/** 取第一句并限长，避免索引被超长 description 撑爆 */
function summarize(raw, max = 88) {
  let t = stripQuotes(raw);
  const cut = t.search(/[。.](\s|$)/);
  if (cut > 10) t = t.slice(0, cut);
  if (t.length > max) {
    const clipped = t.slice(0, max);
    const sp = Math.max(clipped.lastIndexOf(' '), clipped.lastIndexOf('、'), clipped.lastIndexOf(','));
    t = (sp > max * 0.6 ? clipped.slice(0, sp) : clipped) + '…';
  }
  return t || '—';
}

/**
 * 索引技能，支持两种存放结构：
 *   顶层  .agents/skills/<name>/SKILL.md
 *   分组  .agents/skills/<group>/<name>/SKILL.md   ← 工具注入式技能（gitnexus / codegraph 等）常用
 * 同名技能优先取顶层，避免工具重装后出现重复条目。
 */
function collectSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const found = [];
  const seen = new Set();

  const push = (dir, fallbackName) => {
    const file = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(file)) return;
    const head = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(0, 20);
    let name = fallbackName;
    let desc = '';
    let nameSet = false;
    for (const line of head) {
      const mn = line.match(/^name:\s*(.+)$/);
      const md = line.match(/^description:\s*(.+)$/);
      if (mn && !nameSet) {
        name = stripQuotes(mn[1]);
        nameSet = true;
      }
      if (md && !desc) desc = summarize(md[1]);
    }
    if (seen.has(name)) return;
    seen.add(name);
    found.push({
      name,
      desc: desc || '（未填写 description）',
      rel: path.relative(ROOT, dir).replace(/\\/g, '/'),
    });
  };

  const topDirs = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // 先顶层，保证同名时优先顶层
  for (const name of topDirs) push(path.join(SKILLS_DIR, name), name);
  // 再扫一层分组目录
  for (const group of topDirs) {
    let subs;
    try {
      subs = fs
        .readdirSync(path.join(SKILLS_DIR, group), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue;
    }
    for (const name of subs) push(path.join(SKILLS_DIR, group, name), name);
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function collectRules() {
  if (!fs.existsSync(RULES_DIR)) return [];
  return fs
    .readdirSync(RULES_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md'))
    .map((d) => {
      const text = fs.readFileSync(path.join(RULES_DIR, d.name), 'utf8');
      const m = text.match(/^#\s+(.+)$/m);
      return { file: d.name, title: m ? m[1].trim() : d.name };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

function buildAgentsBlock(skills, rules) {
  const skillRows = skills.map((s) => `| \`${s.name}\` | ${s.desc} |`).join('\n');
  const ruleRows = rules.map((r) => `| \`.agents/rules/${r.file}\` | ${r.title} |`).join('\n');
  return [
    START,
    '',
    `> 由 \`node scripts/sync-agent-index.mjs\` 自动生成（${skills.length} 个技能、${rules.length} 个规则文件），请勿手改。`,
    `> 新增技能或规则后重跑该脚本：\`node scripts/sync-agent-index.mjs\``,
    '',
    '### 技能',
    '',
    '| 技能 | 用途 |',
    '|------|------|',
    skillRows,
    '',
    '### 规则文件',
    '',
    '| 文件 | 标题 |',
    '|------|------|',
    ruleRows,
    '',
    END,
  ].join('\n');
}

function buildIndexMd(skills, rules) {
  const skillRows = skills.map((s) => `| \`${s.name}\` | ${s.desc} | \`${s.rel}/\` |`).join('\n');
  const ruleRows = rules.map((r) => `| \`.agents/rules/${r.file}\` | ${r.title} |`).join('\n');
  return [
    '# 技能与规则索引',
    '',
    '> 由 `node scripts/sync-agent-index.mjs` 自动生成，请勿手改。',
    '> 技能实体在 `.agents/skills/<name>/SKILL.md`，规则实体在 `.agents/rules/`。',
    '> 各 AI 工具的接线方式见 `.agents/README.md`。',
    '',
    '---',
    '',
    `## 技能（${skills.length}）`,
    '',
    '| 技能 | 用途 | 路径 |',
    '|------|------|------|',
    skillRows,
    '',
    `## 规则文件（${rules.length}）`,
    '',
    '| 文件 | 标题 |',
    '|------|------|',
    ruleRows,
    '',
    '---',
    '',
    '## 新增内容后',
    '',
    '```bash',
    'node scripts/sync-agent-index.mjs          # 重新生成索引',
    'node scripts/sync-agent-index.mjs --check  # 只检查是否已同步',
    '```',
    '',
    '## 完整技能树与场景分派',
    '',
    '场景 → 技能的对应关系见 `.agents/rules/skill-scheduling-rules.md`，',
    '任务分类铁律见 `.agents/rules/project-rules.md`。',
    '',
  ].join('\n');
}

function replaceBlock(text, block) {
  const i = text.indexOf(START);
  const j = text.indexOf(END);
  if (i === -1 || j === -1 || j < i) {
    throw new Error(`AGENTS.md 缺少 ${START} / ${END} 标记区块`);
  }
  return text.slice(0, i) + block + text.slice(j + END.length);
}

function main() {
  const skills = collectSkills();
  const rules = collectRules();

  const currentAgents = fs.readFileSync(AGENTS_MD, 'utf8');
  const nextAgents = replaceBlock(currentAgents, buildAgentsBlock(skills, rules));
  const nextIndex = buildIndexMd(skills, rules);
  const currentIndex = fs.existsSync(INDEX_MD) ? fs.readFileSync(INDEX_MD, 'utf8') : '';

  if (isCheck) {
    const stale = [];
    if (nextAgents !== currentAgents) stale.push('AGENTS.md');
    if (nextIndex !== currentIndex) stale.push('.agents/skills/INDEX.md');
    if (stale.length) {
      console.error(`[sync-agent-index] 索引未同步: ${stale.join(', ')}`);
      console.error('运行 `node scripts/sync-agent-index.mjs` 重新生成。');
      process.exit(1);
    }
    console.log(`[sync-agent-index] 索引已同步（${skills.length} 个技能、${rules.length} 个规则文件）`);
    return;
  }

  fs.writeFileSync(AGENTS_MD, nextAgents, 'utf8');
  fs.writeFileSync(INDEX_MD, nextIndex, 'utf8');
  console.log(`[sync-agent-index] 已更新 AGENTS.md 与 .agents/skills/INDEX.md`);
  console.log(`  技能: ${skills.length} 个`);
  console.log(`  规则: ${rules.length} 个`);
}

main();
