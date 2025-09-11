/**
 * 多级缓存管理器
 * 实现内存 → localStorage → IndexedDB 的多级缓存策略
 * @version 1.0.0
 */

class MultiLevelCache {
    constructor(options = {}) {
        this.options = {
            // 内存缓存最大条目数
            memoryCacheMaxSize: 100,
            // localStorage缓存最大大小 (MB)
            localStorageMaxSize: 5,
            // IndexedDB数据库名称
            dbName: 'LeLeTVCache',
            // IndexedDB版本
            dbVersion: 1,
            // 默认TTL (毫秒)
            defaultTTL: 30 * 60 * 1000, // 30分钟
            // 不同类型数据的TTL配置
            ttlConfig: {
                'search': 10 * 60 * 1000, // 搜索结果10分钟
                'detail': 20 * 60 * 1000, // 详情数据20分钟
                'api_health': 5 * 60 * 1000, // API健康状态5分钟
                'douban': 60 * 60 * 1000, // 豆瓣数据1小时
                'static': 24 * 60 * 60 * 1000 // 静态资源24小时
            },
            ...options
        };

        // 内存缓存
        this.memoryCache = new Map();
        this.memoryCacheOrder = []; // 用于LRU淘汰算法

        // IndexedDB实例
        this.db = null;

        // 初始化
        this.init();
    }

    /**
     * 初始化多级缓存
     */
    async init() {
        try {
            // 初始化IndexedDB
            await this.initIndexedDB();
            
            // 启动定期清理任务
            this.startCleanupTask();
        } catch (error) {
            console.error('多级缓存初始化失败:', error);
        }
    }

    /**
     * 初始化IndexedDB
     */
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.options.dbName, this.options.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB初始化失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建缓存存储对象
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('expiry', 'expiry', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * 获取数据 - 按内存 → localStorage → IndexedDB的顺序
     */
    async get(key, type = 'default') {
        const now = Date.now();

        // 1. 内存缓存查找
        if (this.memoryCache.has(key)) {
            const item = this.memoryCache.get(key);
            if (item.expiry > now) {
                // 更新LRU顺序
                this.updateMemoryCacheOrder(key);
                return item.value;
            } else {
                // 过期则删除
                this.memoryCache.delete(key);
                const index = this.memoryCacheOrder.indexOf(key);
                if (index > -1) {
                    this.memoryCacheOrder.splice(index, 1);
                }
            }
        }

        // 2. localStorage查找
        try {
            const localStorageKey = `cache_${key}`;
            const itemStr = localStorage.getItem(localStorageKey);
            if (itemStr) {
                const item = JSON.parse(itemStr);
                if (item.expiry > now) {
                    // 放入内存缓存
                    this.setMemoryCache(key, item.value, item.expiry, type);
                    return item.value;
                } else {
                    // 过期则删除
                    localStorage.removeItem(localStorageKey);
                }
            }
        } catch (e) {
            console.warn('localStorage缓存读取失败:', e);
        }

        // 3. IndexedDB查找
        if (this.db) {
            try {
                const result = await this.getFromIndexedDB(key);
                if (result && result.expiry > now) {
                    // 放入内存和localStorage缓存
                    this.setMemoryCache(key, result.value, result.expiry, type);
                    this.setLocalStorage(key, result.value, result.expiry, type);
                    return result.value;
                }
            } catch (e) {
                console.warn('IndexedDB缓存读取失败:', e);
            }
        }

        return null;
    }

    /**
     * 设置数据 - 同时更新多级缓存
     */
    async set(key, value, type = 'default', ttl = null) {
        const now = Date.now();
        const expiry = now + (ttl || this.getTTLForType(type));

        // 1. 设置内存缓存
        this.setMemoryCache(key, value, expiry, type);

        // 2. 设置localStorage缓存
        this.setLocalStorage(key, value, expiry, type);

        // 3. 设置IndexedDB缓存
        if (this.db) {
            try {
                await this.setIndexedDB(key, value, expiry, type);
            } catch (e) {
                console.warn('IndexedDB缓存设置失败:', e);
            }
        }
    }

    /**
     * 设置内存缓存
     */
    setMemoryCache(key, value, expiry, type) {
        // 检查是否需要淘汰旧数据
        if (this.memoryCache.size >= this.options.memoryCacheMaxSize) {
            // 使用LRU算法淘汰最久未使用的数据
            const oldestKey = this.memoryCacheOrder.shift();
            if (oldestKey) {
                this.memoryCache.delete(oldestKey);
            }
        }

        // 设置新数据
        this.memoryCache.set(key, { value, expiry, type });
        this.memoryCacheOrder.push(key);
    }

    /**
     * 更新内存缓存顺序（LRU）
     */
    updateMemoryCacheOrder(key) {
        const index = this.memoryCacheOrder.indexOf(key);
        if (index > -1) {
            // 移除原来的位置
            this.memoryCacheOrder.splice(index, 1);
            // 放到末尾（最近使用）
            this.memoryCacheOrder.push(key);
        }
    }

    /**
     * 设置localStorage缓存
     */
    setLocalStorage(key, value, expiry, type) {
        try {
            const item = { value, expiry, type };
            const itemStr = JSON.stringify(item);
            
            // 检查localStorage使用情况
            const currentSize = this.getLocalStorageSize();
            const itemSize = new Blob([itemStr]).size;
            const maxSize = this.options.localStorageMaxSize * 1024 * 1024; // 转换为字节
            
            if (currentSize + itemSize > maxSize) {
                // 清理过期数据
                this.cleanupLocalStorage();
            }
            
            localStorage.setItem(`cache_${key}`, itemStr);
        } catch (e) {
            console.warn('localStorage缓存设置失败:', e);
        }
    }

    /**
     * 获取localStorage使用大小
     */
    getLocalStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (key.startsWith('cache_')) {
                total += localStorage[key].length;
            }
        }
        return total;
    }

    /**
     * 清理localStorage过期数据
     */
    cleanupLocalStorage() {
        const now = Date.now();
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                try {
                    const itemStr = localStorage.getItem(key);
                    if (itemStr) {
                        const item = JSON.parse(itemStr);
                        if (item.expiry <= now) {
                            keysToRemove.push(key);
                        }
                    }
                } catch (e) {
                    // 解析失败的条目也删除
                    keysToRemove.push(key);
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
    }

    /**
     * 从IndexedDB获取数据
     */
    getFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB未初始化'));
                return;
            }

            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 设置IndexedDB缓存
     */
    setIndexedDB(key, value, expiry, type) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB未初始化'));
                return;
            }

            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put({ key, value, expiry, type });

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 删除缓存项
     */
    async delete(key) {
        // 删除内存缓存
        this.memoryCache.delete(key);
        const index = this.memoryCacheOrder.indexOf(key);
        if (index > -1) {
            this.memoryCacheOrder.splice(index, 1);
        }

        // 删除localStorage缓存
        localStorage.removeItem(`cache_${key}`);

        // 删除IndexedDB缓存
        if (this.db) {
            try {
                await this.deleteFromIndexedDB(key);
            } catch (e) {
                console.warn('IndexedDB缓存删除失败:', e);
            }
        }
    }

    /**
     * 从IndexedDB删除数据
     */
    deleteFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB未初始化'));
                return;
            }

            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 清空所有缓存
     */
    async clear() {
        // 清空内存缓存
        this.memoryCache.clear();
        this.memoryCacheOrder = [];

        // 清空localStorage缓存
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        // 清空IndexedDB缓存
        if (this.db) {
            try {
                await this.clearIndexedDB();
            } catch (e) {
                console.warn('IndexedDB缓存清空失败:', e);
            }
        }
    }

    /**
     * 清空IndexedDB缓存
     */
    clearIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB未初始化'));
                return;
            }

            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 获取特定类型的TTL
     */
    getTTLForType(type) {
        return this.options.ttlConfig[type] || this.options.defaultTTL;
    }

    /**
     * 启动定期清理任务
     */
    startCleanupTask() {
        // 每30分钟清理一次过期缓存
        setInterval(() => {
            this.cleanupExpired();
        }, 30 * 60 * 1000);
    }

    /**
     * 清理过期缓存
     */
    async cleanupExpired() {
        const now = Date.now();

        // 清理内存缓存
        for (const [key, item] of this.memoryCache.entries()) {
            if (item.expiry <= now) {
                this.memoryCache.delete(key);
                const index = this.memoryCacheOrder.indexOf(key);
                if (index > -1) {
                    this.memoryCacheOrder.splice(index, 1);
                }
            }
        }

        // 清理localStorage
        this.cleanupLocalStorage();

        // 清理IndexedDB
        if (this.db) {
            try {
                await this.cleanupIndexedDB(now);
            } catch (e) {
                console.warn('IndexedDB过期数据清理失败:', e);
            }
        }
    }

    /**
     * 清理IndexedDB过期数据
     */
    cleanupIndexedDB(now) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB未初始化'));
                return;
            }

            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('expiry');
            const range = IDBKeyRange.upperBound(now);

            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        return {
            memory: {
                size: this.memoryCache.size,
                maxSize: this.options.memoryCacheMaxSize
            },
            localStorage: {
                size: this.getLocalStorageSize(),
                maxSize: this.options.localStorageMaxSize * 1024 * 1024
            },
            indexedDB: {
                status: this.db ? 'connected' : 'disconnected'
            }
        };
    }
}

// 创建全局实例
window.multiLevelCache = new MultiLevelCache();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiLevelCache;
}