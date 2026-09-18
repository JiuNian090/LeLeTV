#!/usr/bin/env node
/**
 * 建立 / 校验各 AI 工具指向单一内容源的接线
 *
 *   node scripts/setup-agent-links.mjs          建立缺失的接线
 *   node scripts/setup-agent-links.mjs --check  只检查，缺失时退出码 1
 *
 * 背景：技能实体只存放在 .agents/skills/。能通过配置文件指向它的工具（如 Reasonix 的
 * reasonix.toml [skills] paths）走配置；配置改不了的（如 Claude Code 固定读 .claude/skills/）
 * 用目录联接。联接是本地文件系统特性，不进版本控制，换机器后跑一次本脚本即可。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, '.agents', 'skills');
const isCheck = process.argv.includes('--check');
const isWindows = process.platform === 'win32';

/** Junction 在 Windows 上无需管理员权限；其它平台用目录符号链接 */
const LINK_KIND = isWindows ? 'junction' : 'dir';

const LINKS = [{ link: path.join(ROOT, '.claude', 'skills'), note: 'Claude Code 技能目录（路径写死，只能联接）' }];

function linkState(linkPath) {
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink()) return 'linked';
    if (st.isDirectory()) return 'plain-dir';
    return 'blocked';
  } catch {
    return 'missing';
  }
}

/** Reasonix 走配置文件而非联接，这里只做检测与提示，不修改用户配置 */
function checkReasonixConfig() {
  const tomlPath = path.join(ROOT, 'reasonix.toml');
  if (!fs.existsSync(tomlPath)) {
    console.log('[agent-links] ℹ 未发现 reasonix.toml；若使用 Reasonix，请在 [skills] 段加 paths = [".agents/skills"]');
    return true;
  }
  const toml = fs.readFileSync(tomlPath, 'utf8');
  if (/^\s*paths\s*=\s*\[[^\]]*\.agents\/skills/m.test(toml)) {
    console.log('[agent-links] ✔ reasonix.toml 的 [skills] paths 已指向 .agents/skills');
    return true;
  }
  console.warn('[agent-links] ⚠ reasonix.toml 的 [skills] 段缺少 paths = [".agents/skills"]，Reasonix 将发现不到技能。');
  return false;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[agent-links] 找不到技能源目录: ${SOURCE}`);
    process.exit(1);
  }

  const skillCount = fs.readdirSync(SOURCE, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  let problems = 0;

  for (const { link, note } of LINKS) {
    const state = linkState(link);
    const rel = path.relative(ROOT, link).replace(/\\/g, '/');

    if (state === 'linked') {
      console.log(`[agent-links] ✔ ${rel} 已联接`);
      continue;
    }

    if (state === 'plain-dir') {
      const entries = fs.readdirSync(link).length;
      if (entries > 0) {
        console.warn(`[agent-links] ⚠ ${rel} 是真实目录且非空（${entries} 项），未改动。`);
        console.warn(`             请先把内容并入 .agents/skills/ 并删除该目录，再重跑本脚本。`);
        problems++;
        continue;
      }
      fs.rmdirSync(link);
      console.log(`[agent-links] 已移除空目录 ${rel}`);
    } else if (state === 'blocked') {
      console.error(`[agent-links] ✘ ${rel} 存在且不是目录，跳过。`);
      problems++;
      continue;
    }

    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(SOURCE, link, LINK_KIND);
    console.log(`[agent-links] ✔ 已建立 ${rel} → .agents/skills（${note}）`);
  }

  if (isCheck) {
    if (!checkReasonixConfig()) problems++;
    if (problems > 0) {
      console.error('[agent-links] 接线不完整，运行 `node scripts/setup-agent-links.mjs` 修复。');
      process.exit(1);
    }
    console.log(`[agent-links] 接线正常（技能源 ${skillCount} 个）`);
    return;
  }

  if (problems > 0) process.exit(1);
  console.log(`[agent-links] 完成。技能源共 ${skillCount} 个技能。`);
}

main();
