// 清理apikey.txt文件中的重复项目
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取apikey.txt文件
const apikeyPath = path.join(__dirname, 'apikey.txt');
const content = fs.readFileSync(apikeyPath, 'utf8');

// 按行分割文件内容
const lines = content.split('\n');

// 存储唯一的项目
const uniqueItems = new Set();
// 用于检测重复的规范化映射
const normalizedMap = new Map();

// 规范化函数，用于识别相似的项目
function normalizeItem(line) {
    // 跳过空行和注释
    if (!line.trim() || line.startsWith('//')) {
        return null;
    }
    
    // 处理JSON格式的行
    if (line.startsWith('{') && line.includes('"api":')) {
        try {
            // 处理可能不完整的JSON行
            let jsonLine = line;
            if (!line.endsWith('}')) {
                // 尝试找到JSON对象的结束
                if (line.includes('},')) {
                    jsonLine = line.substring(0, line.lastIndexOf('},') + 1);
                }
            }
            
            // 尝试解析JSON
            const obj = JSON.parse(jsonLine.replace(/,$/, ''));
            if (obj.api) {
                return obj.api.toLowerCase().replace(/\/\s*$/, '');
            }
        } catch (e) {
            // 如果解析失败，回退到基本处理
        }
    }
    
    // 提取URL部分（假设URL在逗号后面）
    const parts = line.split(',');
    if (parts.length >= 2) {
        const url = parts[1].trim().toLowerCase().replace(/\/\s*$/, '');
        return url;
    }
    
    // 如果没有逗号，使用整行作为标识符
    return line.trim().toLowerCase().replace(/\/\s*$/, '');
}

// 处理每一行
lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
        // 保留空行
        uniqueItems.add('');
        return;
    }
    
    const normalized = normalizeItem(trimmedLine);
    if (normalized && !normalizedMap.has(normalized)) {
        normalizedMap.set(normalized, true);
        uniqueItems.add(trimmedLine);
    }
});

// 将唯一的项目写回临时文件
const tempPath = path.join(__dirname, 'apikey_cleaned.txt');
fs.writeFileSync(tempPath, Array.from(uniqueItems).join('\n'), 'utf8');

console.log('清理完成！已生成临时文件 apikey_cleaned.txt');
console.log(`原始行数: ${lines.length}`);
console.log(`清理后行数: ${Array.from(uniqueItems).filter(line => line.trim()).length}`);
console.log('请检查临时文件，确认无误后再替换原始文件。');