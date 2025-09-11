// 清理apikey.txt文件中的重复项目，保留第一行
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义文件路径
const inputFilePath = path.join(__dirname, 'apikey.txt');
const outputFilePath = path.join(__dirname, 'apikey_cleaned.txt');
const backupFilePath = path.join(__dirname, 'apikey_backup.txt');

// 读取apikey.txt文件
const content = fs.readFileSync(inputFilePath, 'utf8');

// 按行分割文件内容
const lines = content.split('\n');

// 存储唯一的项目和规范化映射
const uniqueItems = [];
const normalizedMap = new Map();

// 规范化函数，用于识别相似的项目
function normalizeItem(line) {
  if (!line || !line.trim()) return null;
  
  // 尝试提取URL部分
  try {
    // 处理JSON格式的行
    if (line.startsWith('{')) {
      // 简单提取api值，不完整JSON也能处理
      const apiMatch = line.match(/"api":"([^"]+)"/);
      if (apiMatch && apiMatch[1]) {
        return apiMatch[1].toLowerCase().replace(/\/\s*$/, '');
      }
    }
    
    // 处理普通格式行（名称|类型, URL）
    const parts = line.split(',');
    if (parts.length >= 2) {
      const url = parts[1].trim().toLowerCase().replace(/\/\s*$/, '');
      return url;
    }
  } catch (e) {
    // 忽略解析错误
  }
  
  // 默认返回整行的规范化版本
  return line.trim().toLowerCase().replace(/\/\s*$/, '');
}

// 保留第一行
if (lines.length > 0) {
  const firstLine = lines[0];
  uniqueItems.push(firstLine);
  
  const normalized = normalizeItem(firstLine);
  if (normalized) {
    normalizedMap.set(normalized, true);
  }
}

// 处理其余行，跳过不完整的行（包含省略号）
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  
  // 跳过不完整的行
  if (line.includes('…')) continue;
  
  const trimmedLine = line.trim();
  
  // 处理空行
  if (!trimmedLine) {
    // 避免连续空行
    if (uniqueItems.length === 0 || uniqueItems[uniqueItems.length - 1].trim() !== '') {
      uniqueItems.push('');
    }
    continue;
  }
  
  // 检查是否重复
  const normalized = normalizeItem(trimmedLine);
  if (normalized && !normalizedMap.has(normalized)) {
    normalizedMap.set(normalized, true);
    uniqueItems.push(trimmedLine);
  }
}

// 将唯一的项目写回临时文件
fs.writeFileSync(outputFilePath, uniqueItems.join('\n'), 'utf8');

console.log('清理完成！已生成临时文件 apikey_cleaned.txt');
console.log(`原始行数: ${lines.length}`);
console.log(`清理后行数: ${uniqueItems.filter(line => line.trim()).length}`);