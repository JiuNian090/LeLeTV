/**
 * 页面转换动画管理器
 * 实现页面间导航的平滑过渡动画
 * @version 1.0.0
 */

class PageTransitionManager {
    constructor(options = {}) {
        this.options = {
            // 是否启用页面转换动画
            enabled: true,
            // 动画持续时间（毫秒）
            duration: 300,
            // 动画类型
            animationType: 'fade', // 'fade', 'slide', 'zoom'
            // 页面加载指示器
            showLoadingIndicator: true,
            ...options
        };

        // 当前页面状态
        this.currentPage = null;
        this.isTransitioning = false;

        // 初始化
        this.init();
    }

    /**
     * 初始化页面转换管理器
     */
    init() {
        if (!this.options.enabled) {
            return;
        }

        // 拦截链接点击事件
        document.addEventListener('click', (event) => {
            this.handleLinkClick(event);
        });

        // 监听浏览器前进后退按钮
        window.addEventListener('popstate', (event) => {
            this.handlePopState(event);
        });

        // 添加页面转换样式
        this.addTransitionStyles();
    }

    /**
     * 处理链接点击事件
     */
    handleLinkClick(event) {
        // 检查是否是内部链接
        const link = event.target.closest('a');
        if (!link || !link.href) {
            return;
        }

        // 检查是否是外部链接
        const url = new URL(link.href);
        if (url.origin !== window.location.origin) {
            return;
        }

        // 检查是否有特殊属性阻止默认行为
        if (link.hasAttribute('data-no-transition') || 
            link.target === '_blank' || 
            event.ctrlKey || 
            event.metaKey) {
            return;
        }

        // 阻止默认行为
        event.preventDefault();

        // 执行页面转换
        this.navigate(link.href, link.textContent || '页面加载中...');
    }

    /**
     * 处理浏览器历史状态变化
     */
    handlePopState(event) {
        if (!this.options.enabled) {
            return;
        }

        // 执行页面转换
        this.navigate(window.location.href, document.title);
    }

    /**
     * 导航到指定URL
     */
    async navigate(url, title = '') {
        if (this.isTransitioning) {
            return;
        }

        this.isTransitioning = true;

        try {
            // 显示加载指示器
            if (this.options.showLoadingIndicator) {
                this.showLoadingIndicator();
            }

            // 执行离开当前页面的动画
            await this.animateOut();

            // 获取新页面内容
            const newContent = await this.fetchPageContent(url);

            // 更新浏览器历史
            history.pushState({}, title, url);

            // 更新页面内容
            this.updatePageContent(newContent, url);

            // 执行进入新页面的动画
            await this.animateIn();

            // 隐藏加载指示器
            if (this.options.showLoadingIndicator) {
                this.hideLoadingIndicator();
            }

            // 触发自定义事件
            window.dispatchEvent(new CustomEvent('pageTransitionComplete', {
                detail: { url, title }
            }));

        } catch (error) {
            console.error('页面转换失败:', error);
            
            // 隐藏加载指示器
            if (this.options.showLoadingIndicator) {
                this.hideLoadingIndicator();
            }
            
            // 回退到传统导航
            window.location.href = url;
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * 执行离开动画
     */
    async animateOut() {
        if (!this.options.enabled) {
            return;
        }

        const mainContainer = document.querySelector('main') || document.body;
        
        return new Promise((resolve) => {
            // 添加离开动画类
            mainContainer.classList.add('page-transition-out');
            
            // 动画结束后移除类
            setTimeout(() => {
                mainContainer.classList.remove('page-transition-out');
                resolve();
            }, this.options.duration);
        });
    }

    /**
     * 获取页面内容
     */
    async fetchPageContent(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Page-Transition': 'true'
            }
        });

        if (!response.ok) {
            throw new Error(`获取页面内容失败: ${response.status}`);
        }

        return await response.text();
    }

    /**
     * 更新页面内容
     */
    updatePageContent(html, url) {
        // 创建临时DOM来解析HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // 获取新页面的标题
        const newTitle = tempDiv.querySelector('title')?.textContent || 'LeLeTV';
        document.title = newTitle;

        // 获取新页面的主内容
        const newMain = tempDiv.querySelector('main') || tempDiv;
        const currentMain = document.querySelector('main') || document.body;

        // 更新主内容
        currentMain.innerHTML = newMain.innerHTML;

        // 重新初始化页面脚本
        this.reinitializeScripts();
    }

    /**
     * 重新初始化页面脚本
     */
    reinitializeScripts() {
        // 触发DOMContentLoaded事件
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // 如果有全局初始化函数，重新调用
        if (typeof window.initializePageContent === 'function') {
            window.initializePageContent();
        }

        // 重新初始化懒加载
        if (window.lazyLoader) {
            setTimeout(() => {
                window.lazyLoader.refresh();
            }, 100);
        }
    }

    /**
     * 执行进入动画
     */
    async animateIn() {
        if (!this.options.enabled) {
            return;
        }

        const mainContainer = document.querySelector('main') || document.body;
        
        return new Promise((resolve) => {
            // 添加进入动画类
            mainContainer.classList.add('page-transition-in');
            
            // 动画结束后移除类
            setTimeout(() => {
                mainContainer.classList.remove('page-transition-in');
                resolve();
            }, this.options.duration);
        });
    }

    /**
     * 显示加载指示器
     */
    showLoadingIndicator() {
        // 移除已存在的加载指示器
        this.hideLoadingIndicator();

        // 创建加载指示器
        const loader = document.createElement('div');
        loader.id = 'page-transition-loader';
        loader.className = 'page-transition-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <div class="loader-text">页面加载中...</div>
            </div>
        `;

        document.body.appendChild(loader);

        // 添加淡入效果
        setTimeout(() => {
            loader.classList.add('show');
        }, 10);
    }

    /**
     * 隐藏加载指示器
     */
    hideLoadingIndicator() {
        const loader = document.getElementById('page-transition-loader');
        if (loader) {
            loader.classList.remove('show');
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 300);
        }
    }

    /**
     * 添加页面转换样式
     */
    addTransitionStyles() {
        // 检查是否已添加样式
        if (document.getElementById('page-transition-styles')) {
            return;
        }

        const styles = `
            <style id="page-transition-styles">
                /* 页面转换动画 */
                .page-transition-out {
                    opacity: 1;
                    transform: translateX(0);
                    transition: opacity ${this.options.duration}ms ease, transform ${this.options.duration}ms ease;
                }
                
                .page-transition-out.page-transition-fade {
                    opacity: 0;
                }
                
                .page-transition-out.page-transition-slide {
                    transform: translateX(-100%);
                }
                
                .page-transition-out.page-transition-zoom {
                    opacity: 0;
                    transform: scale(0.8);
                }
                
                .page-transition-in {
                    opacity: 0;
                    transform: translateX(100%);
                    transition: opacity ${this.options.duration}ms ease, transform ${this.options.duration}ms ease;
                }
                
                .page-transition-in.page-transition-fade {
                    opacity: 1;
                }
                
                .page-transition-in.page-transition-slide {
                    transform: translateX(0);
                }
                
                .page-transition-in.page-transition-zoom {
                    opacity: 1;
                    transform: scale(1);
                }
                
                /* 加载指示器 */
                #page-transition-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                }
                
                #page-transition-loader.show {
                    opacity: 1;
                }
                
                .loader-content {
                    text-align: center;
                    color: white;
                }
                
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 16px;
                }
                
                .loader-text {
                    font-size: 16px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * 设置动画类型
     */
    setAnimationType(type) {
        if (['fade', 'slide', 'zoom'].includes(type)) {
            this.options.animationType = type;
        }
    }

    /**
     * 设置启用状态
     */
    setEnabled(enabled) {
        this.options.enabled = enabled;
    }

    /**
     * 获取转换状态
     */
    getStats() {
        return {
            enabled: this.options.enabled,
            isTransitioning: this.isTransitioning,
            animationType: this.options.animationType,
            duration: this.options.duration
        };
    }
}

// 创建全局实例
window.pageTransitionManager = new PageTransitionManager();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageTransitionManager;
}