// SHA-256 实现，可用 Web Crypto API，HTTP 下降级到 js-sha256
async function sha256(message: string): Promise<string> {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // HTTP 下调用原始 js-sha256
    const jsSha256 = (window as Window & { _jsSha256?: (input: string) => string })._jsSha256;
    if (typeof jsSha256 === 'function') {
        return jsSha256(message);
    }
    throw new Error('No SHA-256 implementation available.');
}

(window as Window & { sha256?: (message: string) => Promise<string> }).sha256 = sha256;
