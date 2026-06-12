/**
 * SHA-256 哈希工具
 * 使用 Web Crypto API 实现，HTTP 环境下回退到全局 _jsSha256
 */

/**
 * 计算字符串的 SHA-256 哈希
 * @param message 要哈希的字符串
 * @returns 十六进制哈希字符串
 */
export async function sha256(message: string): Promise<string> {
  if (window.crypto && crypto.subtle?.digest) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // HTTP 下调用原始 js‑sha256
  if (typeof window._jsSha256 === 'function') {
    return window._jsSha256(message);
  }
  throw new Error('No SHA-256 implementation available.');
}
