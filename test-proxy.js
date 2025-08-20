// 测试代理请求认证功能的脚本
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 获取密码并计算哈希
const password = process.env.PASSWORD || '123456';
const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
const timestamp = Date.now();

console.log('测试代理请求认证:');
console.log('- 密码:', password);
console.log('- 密码哈希:', passwordHash);
console.log('- 时间戳:', timestamp);
console.log('- 服务器URL:', 'http://localhost:8080');

// 测试代理请求
async function testProxyRequest() {
  try {
    const testUrl = 'https://www.example.com';
    const encodedUrl = encodeURIComponent(testUrl);
    const proxyUrl = `http://localhost:8080/proxy/${encodedUrl}?auth=${passwordHash}&t=${timestamp}`;
    
    console.log('\n发送代理请求...');
    console.log('代理URL:', proxyUrl);
    
    const response = await axios.get(proxyUrl, { timeout: 5000 });
    
    console.log('\n请求成功!');
    console.log('状态码:', response.status);
    console.log('响应内容长度:', response.data.length, 'bytes');
    console.log('\n结论: 密码环境变量设置正确，代理请求认证成功!');
  } catch (error) {
    console.error('\n请求失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    }
    console.error('\n结论: 密码环境变量可能设置不正确，或代理请求配置有问题。');
  }
}

testProxyRequest();