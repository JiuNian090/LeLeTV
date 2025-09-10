#!/usr/bin/env node

/**
 * CHANGELOG.md 更新器
 * 
 * 此脚本用于在Git提交时更新CHANGELOG.md文件，生成符合新版本号规则的条目
 */

const fs = require('fs');
const path = require('path');

/**
 * 从CHANGELOG.md中解析已存在的版本条目
 * @param {string} changelogContent - CHANGELOG.md的内容
 * @returns {Array} 版本条目数组
 */
function parseExistingVersions(changelogContent) {
  const versions = [];
  const lines = changelogContent.split('\n');
  
  for (const line of lines) {
    // 匹配版本标题行，例如: ### v202508282213 (2025-08-28 22:13)
    const versionMatch = line.match(/^### v(\d{12})\s*\((\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\)/);
    if (versionMatch) {
      const versionNumber = versionMatch[1];
      const fullYear = versionNumber.substring(0, 4);
      const month = parseInt(versionNumber.substring(4, 6));
      const day = parseInt(versionNumber.substring(6, 8));
      
      versions.push({
        year: fullYear,
        month: month,
        day: day,
        version: versionNumber,
        date: versionMatch[2]
      });
    }
  }
  
  return versions;
}

/**
 * 计算指定日期的提交次序
 * @param {Array} existingVersions - 已存在的版本数组
 * @param {string} year - 年份
 * @param {number} month - 月份
 * @param {number} day - 日期
 * @returns {number} 提交次序
 */
function calculateCommitOrder(existingVersions, year, month, day) {
  // 统计相同日期的版本号数量
  let count = 0;
  const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // 遍历已存在的版本，查找相同日期的版本
  for (const version of existingVersions) {
    const versionDate = `${version.year}-${String(version.month).padStart(2, '0')}-${String(version.day).padStart(2, '0')}`;
    if (versionDate === targetDate) {
      count++;
    }
  }
  
  // 返回计数+1（因为当前版本还未添加到existingVersions中）
  return count + 1;
}

/**
 * 生成语义化版本号
 * @param {string} timestamp - 时间戳版本号，如"202508282213"
 * @param {Array} existingVersions - 已存在的版本数组
 * @returns {string} 语义化版本号，如"v1.8.28.1"
 */
function generateSemanticVersion(timestamp, existingVersions) {
  if (timestamp.length >= 12) {
    // 年份完整值
    const fullYear = timestamp.substring(0, 4);
    // 计算版本年（25年为1，以后递增）
    const versionYear = Math.max(1, (parseInt(fullYear) - 2025) + 1);
    // 月份
    const month = parseInt(timestamp.substring(4, 6));
    // 日期
    const day = parseInt(timestamp.substring(6, 8));
    
    // 提交次序（基于CHANGELOG.md中相同日期的版本号统计）
    const commitOrder = calculateCommitOrder(existingVersions, fullYear, month, day);
    
    // 组合成新的版本号格式：vN.Y.X.Z
    return `v${versionYear}.${month}.${day}.${commitOrder}`;
  }
  
  return `v${timestamp}`;
}

/**
 * 更新CHANGELOG.md文件
 * @param {string} changelogPath - CHANGELOG.md文件路径
 * @param {string} timestamp - 时间戳版本号
 * @param {string} formattedDate - 格式化日期
 * @param {string} changeType - 变更类型
 * @param {string} description - 变更描述
 */
function updateChangelog(changelogPath, timestamp, formattedDate, changeType, description) {
  // 读取现有的CHANGELOG.md内容
  let changelogContent = '';
  if (fs.existsSync(changelogPath)) {
    changelogContent = fs.readFileSync(changelogPath, 'utf8');
  }
  
  // 解析已存在的版本
  const existingVersions = parseExistingVersions(changelogContent);
  
  // 生成语义化版本号
  const semanticVersion = generateSemanticVersion(timestamp, existingVersions);
  
  // 创建新的版本条目
  const newEntry = `### ${semanticVersion} (${formattedDate})\n- ${changeType} ${description}\n`;
  
  // 确保CHANGELOG.md文件存在并具有标准结构
  if (!changelogContent) {
    // 如果文件不存在，创建一个全新的带标准结构的文件
    changelogContent = `# 更新日志

所有项目的显著更改都将记录在此文件中。
## 格式规范 (仅供维护者参考)
- 按时间倒序排列（最新的更新在顶部）
- 每个版本包含：版本号、日期、更改描述
- 更改类型使用标签：
  - \`[新增]\`: 添加新功能
  - \`[改进]\`: 对现有功能的改进
  - \`[修复]\`: 修复bug
  - \`[性能]\`: 性能优化
  - \`[样式]\`: 样式或UI更改
  - \`[重构]\`: 代码重构，不影响功能
  - \`[文档]\`: 文档更新
  - \`[测试]\`: 添加或修改测试
  - \`[构建]\`: 构建系统或依赖更新
  - \`[其他]\`: 其他更改

## 版本历史

`;
  }
  
  // 查找版本历史部分
  const versionHistoryIndex = changelogContent.indexOf('## 版本历史');
  if (versionHistoryIndex === -1) {
    // 如果没有版本历史部分，添加它
    changelogContent += '\n## 版本历史\n\n';
  }
  
  // 在版本历史部分插入新条目
  const lines = changelogContent.split('\n');
  const versionHistoryLineIndex = lines.findIndex(line => line.trim() === '## 版本历史');
  
  if (versionHistoryLineIndex !== -1) {
    // 在版本历史标题后插入新条目
    lines.splice(versionHistoryLineIndex + 2, 0, newEntry, '');
  } else {
    // 如果找不到版本历史部分，添加到文件末尾
    lines.push('\n## 版本历史\n\n' + newEntry + '\n');
  }
  
  // 写入更新后的内容
  fs.writeFileSync(changelogPath, lines.join('\n'), 'utf8');
  
  console.log(`CHANGELOG.md已更新，新版本条目: ${semanticVersion}`);
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.error('用法: node changelog-updater.js <changelogPath> <timestamp> <formattedDate> <changeType> <description>');
    process.exit(1);
  }
  
  const [changelogPath, timestamp, formattedDate, changeType, ...descriptionParts] = args;
  const description = descriptionParts.join(' ');
  
  try {
    updateChangelog(changelogPath, timestamp, formattedDate, changeType, description);
  } catch (error) {
    console.error('更新CHANGELOG.md时出错:', error);
    process.exit(1);
  }
}

module.exports = {
  parseExistingVersions,
  calculateCommitOrder,
  generateSemanticVersion,
  updateChangelog
};