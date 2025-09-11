/**
 * 为历史版本创建 GitHub Releases
 * 从 CHANGELOG.md 中提取所有版本号和更新信息
 */

import fs from 'fs';
import { execSync } from 'child_process';

// 检查是否在GitHub Actions环境中运行
const isGitHubActions = !!process.env.GITHUB_ACTIONS;
const githubToken = process.env.GITHUB_TOKEN;
const githubRepository = process.env.GITHUB_REPOSITORY;

// 如果在GitHub Actions中运行，检查必要的环境变量
if (isGitHubActions && !githubToken) {
  console.error('在GitHub Actions中运行时，请设置 GITHUB_TOKEN 环境变量');
  process.exit(1);
}

if (isGitHubActions && !githubRepository) {
  console.error('在GitHub Actions中运行时，请设置 GITHUB_REPOSITORY 环境变量');
  process.exit(1);
}

// 读取 CHANGELOG.md 文件
try {
  const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  const lines = changelog.split('\n');
  
  // 解析所有版本
  const versions = [];
  let currentVersion = null;
  
  for (const line of lines) {
    // 查找版本号行
    if (line.startsWith('### ')) {
      const match = line.match(/### (v[\d\.]+) \(([\d\-:\s]+)\)/);
      if (match) {
        currentVersion = {
          version: match[1],
          date: match[2],
          messageLines: []
        };
        versions.push(currentVersion);
        continue;
      }
    }
    
    // 收集提交信息
    if (currentVersion && line.trim() !== '' && !line.startsWith('### ')) {
      currentVersion.messageLines.push(line);
    }
  }
  
  console.log(`找到 ${versions.length} 个历史版本`);
  
  // 为每个版本创建release（标签应该已经存在）
  for (const versionInfo of versions) {
    const { version, date, messageLines } = versionInfo;
    
    // 检查标签是否已存在
    try {
      const existingTag = execSync(`git tag -l "${version}"`, { encoding: 'utf-8' }).toString().trim();
      if (existingTag !== version) {
        console.log(`标签 ${version} 不存在，跳过创建Release`);
        continue;
      }
    } catch (error) {
      console.warn(`检查标签 ${version} 时出错: ${error.message}`);
      continue;
    }
    
    // 构造Release信息
    const message = messageLines.join('\n').trim() || `Release ${version}`;
    const releaseBody = `# Release ${version}\n\n## 更新内容\n\n${message}\n\n---\n\n发布于 ${new Date().toISOString()}`;
    
    // 显示要创建的Release信息
    console.log(`\n准备为标签 ${version} 创建Release，使用以下内容:\n`);
    console.log(`标题: ${version}`);
    console.log(`内容:\n${releaseBody}\n`);
    
    console.log(`请在GitHub上手动为标签 ${version} 创建Release，或使用GitHub CLI执行以下命令:`);
    console.log(`gh release create "${version}" --title "${version}" --notes "${releaseBody.replace(/"/g, '\\"')}"\n`);
    
    // 添加延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('历史Release创建完成');
} catch (error) {
  console.error('处理 CHANGELOG.md 时出错:', error);
  process.exit(1);
}