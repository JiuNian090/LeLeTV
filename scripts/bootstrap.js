#!/usr/bin/env node
// ============================================================
// bootstrap.js — Cross-platform project detection & guidance
// ============================================================
//   node scripts/bootstrap.js          Detection + guidance
//   node scripts/bootstrap.js --check  Just check status, exit 0/1
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(__filename, '../..');

// ---- Colour helpers ----

function colour(code, text) {
  return process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
}

const info = (s) => console.log(colour('0;36', `ℹ ${s}`));
const ok = (s) => console.log(colour('0;32', `✔ ${s}`));
const warn = (s) => console.log(colour('1;33', `⚡ ${s}`));
const err = (s) => console.log(colour('0;31', `✘ ${s}`));

// ---- Detection ----

function detectProjectType() {
  if (fs.existsSync(path.join(ROOT_DIR, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(ROOT_DIR, 'pyproject.toml'))) return 'python';
  if (fs.existsSync(path.join(ROOT_DIR, 'requirements.txt'))) return 'python';
  if (fs.existsSync(path.join(ROOT_DIR, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(ROOT_DIR, 'go.mod'))) return 'go';
  return 'unknown';
}

function checkSkillsStatus() {
  const skillsDir = path.join(ROOT_DIR, '.agents', 'skills');
  const rulesDir = path.join(ROOT_DIR, '.agents', 'rules');

  if (!fs.existsSync(skillsDir)) return 'no-skills-dir';
  if (!fs.existsSync(path.join(skillsDir, 'INDEX.md'))) return 'no-index';

  const count = fs.readdirSync(skillsDir).filter((e) => {
    const skillMd = path.join(skillsDir, e, 'SKILL.md');
    return fs.statSync(path.join(skillsDir, e)).isDirectory() && fs.existsSync(skillMd);
  }).length;

  if (count === 0) return 'empty';

  // Check rules
  const rulesCount = fs.existsSync(rulesDir)
    ? fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')).length
    : 0;

  return { count, rulesCount };
}

const PROJECT_LABELS = {
  node: 'Node.js / Frontend',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  unknown: '未能自动识别',
};

// ---- Print guidance ----

function printGuidance(projectType, skillsStatus) {
  console.log();
  console.log('============================================');
  console.log('  Project Skills — Bootstrap Report');
  console.log('============================================');
  console.log();

  // Project type
  const label = PROJECT_LABELS[projectType] || projectType;
  if (projectType === 'unknown') {
    warn(`项目类型: ${label}（未找到 package.json/pyproject.toml/Cargo.toml/go.mod）`);
  } else {
    ok(`项目类型: ${label}`);
  }

  console.log();

  // Skills status
  if (typeof skillsStatus === 'string') {
    switch (skillsStatus) {
      case 'no-skills-dir':
        warn('技能尚未安装');
        info('解决方案: 在 IDE 中打开项目，输入「安装技能和规则」即可自动配置');
        break;
      case 'no-index':
      case 'empty':
        warn('技能目录存在但尚未完成安装');
        info('解决方案: 在 IDE 中打开项目，输入「安装技能和规则」即可自动安装');
        break;
    }
  } else {
    ok(`已安装 ${skillsStatus.count} 个技能`);
    ok(`${skillsStatus.rulesCount} 个规则文件`);
    info('运行以下命令查看技能清单:');
    console.log(`  dir ${ROOT_DIR}\\.agents\\skills\\`);
    console.log();
    info('如需更新技能，运行:');
    console.log('  npx psmgr install --yes');
  }

  // IDE hints
  console.log();
  console.log('━━━ IDE 使用提示 ━━━');
  console.log();
  console.log('  支持的 IDE 命令:');
  console.log('    「安装技能和规则」  — 首次安装/配置');
  console.log('    「更新技能和规则」  — 升级已有技能');
  console.log('    「卸载技能 xxx」    — 移除指定技能');
  console.log('    「查看技能」        — 查看技能状态');
  console.log('    「更新更新日志为 vx.x.x」 — 生成 CHANGELOG');
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━');
  console.log();
}

// ---- Main ----

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');

  const projectType = detectProjectType();
  const skillsStatus = checkSkillsStatus();

  // --check mode: just exit with code
  if (checkMode) {
    if (typeof skillsStatus === 'string') {
      process.exit(1);
    }
    process.exit(0);
  }

  printGuidance(projectType, skillsStatus);
}

main();
