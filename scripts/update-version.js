#!/usr/bin/env node

/**
 * 更新版本号脚本
 * 生成符合新规则的版本号并更新VERSION.txt文件
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取当前日期时间
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');

// 生成时间戳版本号 (YYYYMMDDHHMM)
const timestampVersion = `${year}${month}${day}${hours}${minutes}`;

// 更新VERSION.txt文件
const versionFilePath = join(__dirname, '..', 'VERSION.txt');
writeFileSync(versionFilePath, timestampVersion, 'utf8');

console.log(`已更新 VERSION.txt: ${timestampVersion}`);