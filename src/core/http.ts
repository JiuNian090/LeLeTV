/**
 * 代理请求鉴权模块
 * 为代理请求添加基于 PASSWORD 的鉴权机制
 */

type ProxyAuthWindow = Window & {
    __ENV__?: { HIDDENKEY?: string };
    ProxyAuth?: {
        addAuthToProxyUrl: (url: string) => Promise<string>;
        validateProxyAuth: (
            authHash: string | null,
            serverPasswordHash: string | null,
            timestamp: string | number | null
        ) => boolean;
        clearAuthCache: () => void;
        getPasswordHash: () => Promise<string | null>;
    };
};

// 从全局配置获取密码哈希（如果存在）
let cachedPasswordHash: string | null = null;

/**
 * 获取当前会话的密码哈希
 */
async function getPasswordHash(): Promise<string | null> {
    if (cachedPasswordHash) {
        return cachedPasswordHash;
    }

    // 1. 优先从已存储的代理鉴权哈希获取
    const storedHash = localStorage.getItem('proxyAuthHash');
    if (storedHash) {
        cachedPasswordHash = storedHash;
        return storedHash;
    }

    // 2. 尝试从密码验证状态获取（password.js 验证后存储的哈希）
    const passwordVerified = localStorage.getItem('passwordVerified');
    const storedPasswordHash = localStorage.getItem('passwordHash');
    if (passwordVerified === 'true' && storedPasswordHash) {
        localStorage.setItem('proxyAuthHash', storedPasswordHash);
        cachedPasswordHash = storedPasswordHash;
        return storedPasswordHash;
    }

    // 3. 尝试从用户输入的密码生成哈希
    const userPassword = localStorage.getItem('userPassword');
    if (userPassword) {
        try {
            // 动态导入 sha256 函数（绝对路径：本文件已从 js/auth/ 迁到 src/core/）
            const sha256ModuleUrl = '/js/auth/sha256.js';
            const mod = await import(sha256ModuleUrl) as { sha256: (message: string) => Promise<string> };
            const hash = await mod.sha256(userPassword);
            localStorage.setItem('proxyAuthHash', hash);
            cachedPasswordHash = hash;
            return hash;
        } catch (error) {
            console.error('生成密码哈希失败:', error);
        }
    }

    // 4. 如果用户没有设置密码，尝试使用环境变量中的密码哈希
    const env = (window as ProxyAuthWindow).__ENV__;
    if (env && env.HIDDENKEY) {
        cachedPasswordHash = env.HIDDENKEY;
        return env.HIDDENKEY;
    }

    return null;
}

/**
 * 为代理请求URL添加鉴权参数
 */
async function addAuthToProxyUrl(url: string): Promise<string> {
    try {
        const hash = await getPasswordHash();
        if (!hash) {
            console.warn('无法获取密码哈希，代理请求可能失败');
            return url;
        }

        // 添加时间戳防止重放攻击
        const timestamp = Date.now();

        // 检查URL是否已包含查询参数
        const separator = url.includes('?') ? '&' : '?';

        return `${url}${separator}auth=${encodeURIComponent(hash)}&t=${timestamp}`;
    } catch (error) {
        console.error('添加代理鉴权失败:', error);
        return url;
    }
}

/**
 * 验证代理请求的鉴权
 */
function validateProxyAuth(
    authHash: string | null,
    serverPasswordHash: string | null,
    timestamp: string | number | null
): boolean {
    if (!authHash || !serverPasswordHash) {
        return false;
    }

    // 验证哈希是否匹配
    if (authHash !== serverPasswordHash) {
        return false;
    }

    // 验证时间戳（10分钟有效期）
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟

    if (timestamp && (now - parseInt(String(timestamp), 10)) > maxAge) {
        console.warn('代理请求时间戳过期');
        return false;
    }

    return true;
}

/**
 * 清除缓存的鉴权信息
 */
function clearAuthCache(): void {
    cachedPasswordHash = null;
    localStorage.removeItem('proxyAuthHash');
}

// 监听密码变化，清除缓存
window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'userPassword') {
        clearAuthCache();
    }
});

// 导出函数
(window as ProxyAuthWindow).ProxyAuth = {
    addAuthToProxyUrl,
    validateProxyAuth,
    clearAuthCache,
    getPasswordHash
};
