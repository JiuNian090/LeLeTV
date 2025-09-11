import fs from 'fs';
import path from 'path';

// 读取文件内容
const filePath = path.join(path.dirname(import.meta.url.replace('file:///', '')), 'apikey.txt');
const content = fs.readFileSync(filePath, 'utf8');

// 计算行数
const lines = content.split('\n');
console.log(`清理后的文件行数: ${lines.length}`);