/**
 * 自动创建 Git 标并推送到远程仓库
 * 从 CHANGELOG.md 中提取最新版本号和更新信息
 */

import fs from 'fs';
import { execSync } from 'child_process';

// 检查提交信息是否包含 @CHANGELOG.md，如果包含则跳过打标签
try {
  const commitMessage = execSync('git log --format=%B -n 1 HEAD', { encoding: 'utf-8' });
  if (commitMessage.includes('@CHANGELOG.md')) {
    console.log("Commit message contains '@CHANGELOG.md', skipping tag creation.");
    process.exit(0);
  }
} catch (error) {
  console.error('Error checking commit message:', error);
  process.exit(1);
}

// 读取 CHANGELOG.md 文件
try {
  const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  const lines = changelog.split('\n');
  
  // 查找最新的版本号
  let version = '';
  let messageLines = [];
  let capture = false;
  
  for (const line of lines) {
    // 查找版本号行
    if (line.startsWith('### ')) {
      if (version === '') {
        // 第一个版本号行是最新版本
        const match = line.match(/### (v[\d\.]+)/);
        if (match) {
          version = match[1];
          capture = true;
          continue;
        }
      } else {
        // 遇到下一个版本号时停止
        break;
      }
    }
    
    // 收集提交信息
    if (capture && line.trim() !== '' && !line.startsWith('### ')) {
      messageLines.push(line);
    }
  }
  
  if (!version) {
    console.error('No version found in CHANGELOG.md');
    process.exit(1);
  }
  
  // 检查标签是否已存在
  try {
    const existingTag = execSync(`git tag -l "${version}"`, { encoding: 'utf-8' }).toString().trim();
    if (existingTag === version) {
      console.log(`Tag ${version} already exists. Skipping creation.`);
      process.exit(0); // Exit without error
    }
  } catch (error) {
    // 如果检查标签存在性时出错，继续创建标签
    console.warn(`Warning checking existing tag: ${error.message}`);
  }
  
  // 构造标签信息
  const message = messageLines.join('\n').trim() || `Release ${version}`;
  
  // 创建标签
  try {
    execSync(`git tag -a "${version}" -m "${message}"`, { stdio: 'inherit' });
    console.log(`Created tag ${version}`);
  } catch (error) {
    console.error(`Error creating tag ${version}:`, error);
    process.exit(1);
  }
  
  // 推送标签到远程仓库
  try {
    execSync(`git push origin "${version}"`, { stdio: 'inherit' });
    console.log(`Pushed tag ${version} to origin`);
  } catch (error) {
    console.error(`Error pushing tag ${version}:`, error);
    process.exit(1);
  }
  
  // 输出版本号供GitHub Actions使用
  console.log(`::set-output name=version::${version}`);
  
  // 输出更新日志内容
  if (messageLines.length > 0) {
    const releaseNotes = messageLines.join('\n').trim();
    // 转义特殊字符以避免GitHub Actions解析错误
    const escapedNotes = releaseNotes
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.log(`::set-output name=release_notes::${escapedNotes}`);
  } else {
    console.log(`::set-output name=release_notes::Release ${version}`);
  }
} catch (error) {
  console.error('Error reading CHANGELOG.md:', error);
  process.exit(1);
}