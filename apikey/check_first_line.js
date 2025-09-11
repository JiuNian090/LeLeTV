import fs from 'fs';
import path from 'path';

// 读取文件的第一行
const filePath = path.join(process.cwd(), 'apikey_cleaned.txt');
const content = fs.readFileSync(filePath, 'utf8');
const firstLine = content.split('\n')[0];

console.log('文件的第一行内容:');
console.log(firstLine);