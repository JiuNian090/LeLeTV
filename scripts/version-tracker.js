#!/usr/bin/env node

/**
 * 版本跟踪器
 * 
 * 此脚本演示如何实现基于当天提交次数的版本号生成
 */

const fs = require('fs');
const path = require('path');

class VersionTracker {
  constructor() {
    this.versionFile = path.join(__dirname, '..', 'VERSION.txt');
    this.commitLogDir = path.join(__dirname, '..', '.version-tracker');
    this.commitLogFile = path.join(this.commitLogDir, 'daily-commits.json');
    
    // 确保跟踪目录存在
    if (!fs.existsSync(this.commitLogDir)) {
      fs.mkdirSync(this.commitLogDir, { recursive: true });
    }
    
    // 初始化提交日志文件
    if (!fs.existsSync(this.commitLogFile)) {
      fs.writeFileSync(this.commitLogFile, JSON.stringify({}), 'utf8');
    }
  }
  
  /**
   * 获取今天的日期字符串 (YYYY-MM-DD)
   */
  getTodayString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
  
  /**
   * 获取当天的提交次数
   */
  getTodayCommitCount() {
    const today = this.getTodayString();
    const commitLog = this.loadCommitLog();
    
    if (!commitLog[today]) {
      commitLog[today] = 0;
    }
    
    return commitLog[today];
  }
  
  /**
   * 增加当天提交次数
   */
  incrementTodayCommitCount() {
    const today = this.getTodayString();
    const commitLog = this.loadCommitLog();
    
    if (!commitLog[today]) {
      commitLog[today] = 0;
    }
    
    commitLog[today] += 1;
    this.saveCommitLog(commitLog);
    
    return commitLog[today];
  }
  
  /**
   * 加载提交日志
   */
  loadCommitLog() {
    try {
      const data = fs.readFileSync(this.commitLogFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }
  
  /**
   * 保存提交日志
   */
  saveCommitLog(commitLog) {
    fs.writeFileSync(this.commitLogFile, JSON.stringify(commitLog, null, 2), 'utf8');
  }
  
  /**
   * 生成版本号
   */
  generateVersionNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // 获取当天提交次数
    const commitCount = this.incrementTodayCommitCount();
    
    // 计算版本年（2025年为1，之后每年递增）
    const versionYear = Math.max(1, (year - 2025) + 1);
    
    // 生成版本号：v{年}.{月}.{日}.{当天提交序号}
    return `v${versionYear}.${parseInt(month)}.${parseInt(day)}.${commitCount}`;
  }
  
  /**
   * 生成时间戳版本号（用于内部跟踪）
   */
  generateTimestampVersion() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}`;
  }
  
  /**
   * 更新VERSION.txt文件
   */
  updateVersionFile() {
    const timestampVersion = this.generateTimestampVersion();
    fs.writeFileSync(this.versionFile, timestampVersion, 'utf8');
    console.log(`已更新 VERSION.txt: ${timestampVersion}`);
    return timestampVersion;
  }
  
  /**
   * 获取语义化版本号
   */
  getSemanticVersion(timestampVersion = null) {
    if (!timestampVersion) {
      // 从文件读取
      if (fs.existsSync(this.versionFile)) {
        timestampVersion = fs.readFileSync(this.versionFile, 'utf8').trim();
      } else {
        // 默认值
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timestampVersion = `${year}${month}${day}${hours}${minutes}`;
      }
    }
    
    // 解析时间戳版本号
    if (timestampVersion.length >= 12) {
      const fullYear = timestampVersion.substring(0, 4);
      const versionYear = Math.max(1, (parseInt(fullYear) - 2025) + 1);
      const month = parseInt(timestampVersion.substring(4, 6));
      const day = parseInt(timestampVersion.substring(6, 8));
      
      // 获取当天提交次数
      const today = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const commitLog = this.loadCommitLog();
      const commitCount = commitLog[today] || 1;
      
      return `v${versionYear}.${month}.${day}.${commitCount}`;
    }
    
    return `v${timestampVersion}`;
  }
}

// 导出类
module.exports = VersionTracker;

// 如果直接运行此脚本
if (require.main === module) {
  const tracker = new VersionTracker();
  
  // 显示当前版本号
  console.log('当前时间戳版本:', tracker.generateTimestampVersion());
  console.log('当前语义化版本:', tracker.getSemanticVersion());
  
  // 模拟一次提交
  const commitCount = tracker.incrementTodayCommitCount();
  console.log(`今天第 ${commitCount} 次提交`);
  console.log('新的语义化版本:', tracker.getSemanticVersion());
  
  // 更新VERSION.txt
  tracker.updateVersionFile();
}