#!/usr/bin/env node

/**
 * 更新所有版本号相关内容的脚本
 * 
 * 此脚本会：
 * 1. 生成基于当天提交次数的版本号
 * 2. 更新VERSION.txt文件
 * 3. 更新HTML文件中的版本引用
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取当前日期
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');

// 生成基础版本号 (YYYYMMDD)
const baseVersion = `${year}${month}${day}`;

// 计算当天提交次数的函数
function getCommitCountForToday() {
  try {
    // 获取今天的日期范围
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 格式化日期用于git log命令
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // 获取今天范围内的提交数量
    // 注意：这需要在Git仓库中有历史记录才能正确工作
    const gitCommand = `git log --since="${todayStr}T00:00:00" --until="${tomorrowStr}T00:00:00" --oneline --no-merges`;
    const commits = execSync(gitCommand, { encoding: 'utf-8' });
    
    // 计算提交行数（每次提交占一行）
    const commitLines = commits.split('\n').filter(line => line.trim() !== '');
    
    // 提交次数（今天的第几次提交，从1开始）
    return commitLines.length + 1; // +1因为我们正在添加一个新的提交
  } catch (error) {
    console.warn('无法获取Git提交历史，使用默认提交次数1:', error.message);
    return 1;
  }
}

// 生成完整的版本号
function generateVersionNumber() {
  const commitCount = getCommitCountForToday();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  // 格式：YYYYMMDDHHMM，其中HHMM用于确保版本号唯一性
  return `${baseVersion}${hours}${minutes}`;
}

// 更新VERSION.txt文件
function updateVersionFile() {
  const version = generateVersionNumber();
  const versionFilePath = path.join(__dirname, '..', 'VERSION.txt');
  
  fs.writeFileSync(versionFilePath, version, 'utf8');
  console.log(`已更新 VERSION.txt: ${version}`);
  
  return version;
}

// 更新HTML文件中的版本引用
function updateHtmlFiles(version) {
  // 转换版本号为语义化格式
  const fullYear = version.substring(0, 4);
  const versionYear = Math.max(1, (parseInt(fullYear) - 2025) + 1);
  const month = parseInt(version.substring(4, 6));
  const day = parseInt(version.substring(6, 8));
  const hours = parseInt(version.substring(8, 10));
  const minutes = parseInt(version.substring(10, 12));
  
  // 计算提交次序（基于时间）
  const totalMinutes = hours * 60 + minutes;
  const commitOrder = Math.floor(totalMinutes / 5) + 1;
  const maxCommitOrder = 288; // 一天最多288个5分钟间隔 (24*60/5)
  const normalizedCommitOrder = Math.min(commitOrder, maxCommitOrder);
  
  const semanticVersion = `v${versionYear}.${month}.${day}.${normalizedCommitOrder}`;
  
  const htmlFiles = [
    'index.html',
    'player.html',
    'about.html',
    'watch.html'
  ];
  
  htmlFiles.forEach(fileName => {
    const filePath = path.join(__dirname, '..', fileName);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 更新CSS引用
      content = content.replace(
        /(<link[^>]*href="[^"]*\.css)(\?v=[^"]*)?"([^>]*>)/g,
        `$1?v=${semanticVersion}"$3`
      );
      
      // 更新JS引用
      content = content.replace(
        /(<script[^>]*src="[^"]*\.js)(\?v=[^"]*)?"([^>]*>)/g,
        `$1?v=${semanticVersion}"$3`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`已更新 ${fileName} 中的版本引用: ${semanticVersion}`);
    }
  });
}

// 更新package.json中的版本号
function updatePackageJson(version) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 转换版本号为语义化格式
    const fullYear = version.substring(0, 4);
    const versionYear = Math.max(1, (parseInt(fullYear) - 2025) + 1);
    const month = parseInt(version.substring(4, 6));
    const day = parseInt(version.substring(6, 8));
    const commitOrder = 1; // 简化处理，实际应根据提交次数计算
    
    packageJson.version = `${versionYear}.${month}.${day}`;
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`已更新 package.json 版本号: ${packageJson.version}`);
  }
}

// 主函数
function main() {
  try {
    console.log('开始更新版本号...');
    
    // 生成并更新版本号
    const version = updateVersionFile();
    
    // 更新HTML文件中的版本引用
    updateHtmlFiles(version);
    
    // 更新package.json
    updatePackageJson(version);
    
    console.log('所有版本号相关内容已更新完成。');
  } catch (error) {
    console.error('更新版本号时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = {
  generateVersionNumber,
  updateVersionFile,
  updateHtmlFiles,
  updatePackageJson
};