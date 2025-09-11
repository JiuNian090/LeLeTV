/**
 * LeLeTV 图片懒加载模块
 * 优化页面加载性能，减少初始加载时间
 * @version 1.1.0
 */

class LazyLoader {
    constructor(options = {}) {
        this.options = {
            // 根边距，提前多少像素开始加载
            rootMargin: '150px 0px', // 提前150px开始加载（从50px优化为150px）
            // 交叉比例阈值
            threshold: 0.01,
            // 默认占位图片
            placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMTkxOTE5Ii8+CjxjaXJjbGUgY3g9IjE1MCIgY3k9IjE4MCIgcj0iMzAiIGZpbGw9IiMzMzMiLz4KPHBhdGggZD0iTTEzNSAxOTVMMTY1IDE5NU0xMzUgMjEwTDE2NSAyMTBNMTIwIDIyNUwxODAgMjI1IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPuWKoOi9veS4re+8jOivt+eojOWAmS4uLjwvdGV4dD4KPC9zdmc+',
            // 错误时的占位图片
            errorPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMTkxOTE5Ii8+CjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIzNTAiIHJ4PSI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iNSw1Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjE0MCIgcj0iMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik04NSAxMjVMMTE1IDE1NU04NSAxNTVMMTE1IDEyNSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8dGV4dCB4PSIxNTAiIHk9IjI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0Ij7ml6Dms5Xlub/lkI48L3RleHQ+Cjx0ZXh0IHg9IjE1MCIgeT0iMjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=',
            // 加载动画选择器
            loadingClass: 'lazy-loading',
            // 加载完成样式类
            loadedClass: 'lazy-loaded',
            // 失败样式类
            errorClass: 'lazy-error',
            // 观察器配置
            observerConfig: {},
            // 优先级阈值（可见区域50%以上为高优先级）
            priorityThreshold: 0.5,
            // 预加载关键图片的数量
            preloadCount: 3,
            ...options
        };

        this.observer = null;
        this.priorityObserver = null; // 用于高优先级图片的观察器
        this.init();
    }

    /**
     * 初始化懒加载观察器
     */
    init() {
        if (!('IntersectionObserver' in window)) {
            // 不支持 IntersectionObserver 的浏览器降级处理
            this.fallbackLazyLoad();
            return;
        }

        // 普通优先级观察器配置
        const config = {
            root: null,
            rootMargin: this.options.rootMargin,
            threshold: this.options.threshold,
            ...this.options.observerConfig
        };

        // 高优先级观察器配置（更早触发）
        const priorityConfig = {
            root: null,
            rootMargin: '200px 0px', // 比普通观察器更早触发
            threshold: this.options.priorityThreshold,
            ...this.options.observerConfig
        };

        // 普通优先级观察器
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                }
            });
        }, config);

        // 高优先级观察器
        this.priorityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 高优先级图片立即加载
                    this.loadImage(entry.target, true);
                }
            });
        }, priorityConfig);

        // 观察所有懒加载图片
        this.observeImages();
        
        // 预加载关键图片
        this.preloadCriticalImages();
    }

    /**
     * 观察页面中的所有懒加载图片
     */
    observeImages() {
        const images = document.querySelectorAll('img[data-lazy-src], img[data-src]');
        images.forEach(img => {
            this.observer.observe(img);
            // 对于关键区域的图片，同时使用高优先级观察器
            if (img.hasAttribute('data-priority') || img.closest('.critical-section')) {
                this.priorityObserver.observe(img);
            }
            this.setupImagePlaceholder(img);
        });
    }

    /**
     * 设置图片占位符
     */
    setupImagePlaceholder(img) {
        if (!img.src || img.src === '') {
            img.src = this.options.placeholder;
            img.classList.add(this.options.loadingClass);
        }
    }

    /**
     * 加载图片
     */
    loadImage(img, isHighPriority = false) {
        const src = img.dataset.lazySrc || img.dataset.src;
        if (!src) return;

        // 停止观察当前图片
        this.observer.unobserve(img);
        if (this.priorityObserver) {
            this.priorityObserver.unobserve(img);
        }

        // 添加加载中状态
        img.classList.add(this.options.loadingClass);

        // 创建新的图片对象进行预加载
        const imageLoader = new Image();
        
        imageLoader.onload = () => {
            // 图片加载成功
            this.onImageLoaded(img, src);
        };

        imageLoader.onerror = () => {
            // 图片加载失败
            this.onImageError(img);
        };

        // 开始加载图片
        imageLoader.src = src;
    }

    /**
     * 图片加载成功处理
     */
    onImageLoaded(img, src) {
        // 使用淡入效果
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease-in-out';
        
        img.src = src;
        
        // 移除加载中状态，添加加载完成状态
        img.classList.remove(this.options.loadingClass);
        img.classList.add(this.options.loadedClass);
        
        // 清理 dataset
        delete img.dataset.lazySrc;
        delete img.dataset.src;
        delete img.dataset.priority;
        
        // 淡入动画
        requestAnimationFrame(() => {
            img.style.opacity = '1';
        });
    }

    /**
     * 图片加载失败处理
     */
    onImageError(img) {
        img.src = this.options.errorPlaceholder;
        img.classList.remove(this.options.loadingClass);
        img.classList.add(this.options.errorClass);
        
        // 清理 dataset
        delete img.dataset.lazySrc;
        delete img.dataset.src;
        delete img.dataset.priority;
    }

    /**
     * 手动观察新添加的图片
     */
    observe(img) {
        if (this.observer && img) {
            this.observer.observe(img);
            // 对于关键区域的图片，同时使用高优先级观察器
            if (img.hasAttribute('data-priority') || img.closest('.critical-section')) {
                this.priorityObserver.observe(img);
            }
            this.setupImagePlaceholder(img);
        }
    }

    /**
     * 停止观察图片
     */
    unobserve(img) {
        if (this.observer && img) {
            this.observer.unobserve(img);
        }
        if (this.priorityObserver && img) {
            this.priorityObserver.unobserve(img);
        }
    }

    /**
     * 刷新观察器，重新观察所有未加载的图片
     */
    refresh() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.priorityObserver) {
            this.priorityObserver.disconnect();
        }
        this.observeImages();
    }

    /**
     * 销毁观察器
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.priorityObserver) {
            this.priorityObserver.disconnect();
            this.priorityObserver = null;
        }
    }

    /**
     * 降级处理：不支持 IntersectionObserver 的浏览器
     */
    fallbackLazyLoad() {
        const images = document.querySelectorAll('img[data-lazy-src], img[data-src]');
        
        // 直接加载所有图片
        images.forEach(img => {
            const src = img.dataset.lazySrc || img.dataset.src;
            if (src) {
                img.src = src;
                delete img.dataset.lazySrc;
                delete img.dataset.src;
                delete img.dataset.priority;
            }
        });
    }

    /**
     * 预加载关键图片
     */
    preloadCriticalImages() {
        // 获取标记为关键的图片
        const criticalImages = document.querySelectorAll('img[data-priority], .critical-section img');
        const preloadCount = Math.min(this.options.preloadCount, criticalImages.length);
        
        // 预加载前N个关键图片
        for (let i = 0; i < preloadCount; i++) {
            const img = criticalImages[i];
            if (img && (img.dataset.lazySrc || img.dataset.src)) {
                // 添加高优先级标记
                img.dataset.priority = 'true';
                // 立即开始加载
                this.loadImage(img, true);
            }
        }
    }

    /**
     * 批量处理图片元素，为其添加懒加载属性
     */
    static processImages(container = document) {
        const images = container.querySelectorAll('img[src]');
        images.forEach(img => {
            // 跳过已经处理过的图片
            if (img.dataset.lazySrc || img.dataset.src) return;
            
            // 跳过 data: 和空 src
            if (img.src.startsWith('data:') || !img.src.trim()) return;
            
            // 将 src 移动到 data-lazy-src
            img.dataset.lazySrc = img.src;
            img.removeAttribute('src');
        });
    }

    /**
     * 为动态内容创建懒加载图片HTML
     */
    static createLazyImage(src, alt = '', className = '', attrs = {}) {
        const attributes = Object.entries(attrs)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
            
        return `<img data-lazy-src="${src}" alt="${alt}" class="${className}" ${attributes}>`;
    }
}

// 全局懒加载实例
window.LazyLoader = LazyLoader;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.lazyLoader = new LazyLoader({
        rootMargin: '150px 0px', // 提前150px开始加载
        threshold: 0.01,
        priorityThreshold: 0.5, // 优先级阈值
        preloadCount: 3 // 预加载关键图片数量
    });
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LazyLoader;
}