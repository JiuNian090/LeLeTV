/**
 * LeLeTV — 页面按需加载器
 *
 * index.html 只保留首页与共享外壳；其余页面拆成 pages/*.html 片段，
 * 页面专属脚本打成独立 bundle（构建脚本把文件名写进
 * <meta name="leletv-page-bundles">，页面专属样式在首次进入时再下载）。
 *
 * 路由（app-routing.js）在显示非首页前调用 LeLePages.ensure(name)，
 * hash 地址、前进/后退、导航按钮的 data-action 全部保持原样。
 *
 * 约定：
 *   - 片段根节点必须是 <div id="page-<name>" class="page-content">…</div>
 *   - ensure() 失败时插入占位页并 resolve，保证导航仍可继续
 *   - 脚本与样式失败都不阻断页面显示，只记录警告
 */

interface PageLoaderWindow extends Window {
    __LELETV_VERSION__?: string;
}

const pageLoaderWindow = window as PageLoaderWindow;

export const LeLePages = (function () {
    'use strict';

    var FRAGMENTS: Record<string, string> = {
        movies: 'src/pages/movies/template.html',
        category: 'src/pages/category/template.html',
        history: 'src/pages/history/template.html',
        settings: 'src/pages/settings/template.html',
        about: 'src/pages/about/template.html',
        readme: 'src/pages/readme/template.html'
    };

    // 页面专属样式：首页不需要，首次进入内页时才下载
    var STYLES: Record<string, string> = {
        views: 'src/styles/views.css',
        admin: 'src/pages/settings/style.css'
    };

    var PAGE_STYLES: Record<string, string[]> = {
        movies: ['views'],
        category: ['views'],
        history: ['views'],
        settings: ['views', 'admin'],
        about: ['views'],
        readme: ['views']
    };

    // 页面专属脚本 bundle：路径由构建脚本写入 meta
    var PAGE_SCRIPTS = readBundles();

    var _pagePromises: Record<string, Promise<void> | undefined> = {};
    var _scriptPromises: Record<string, Promise<void> | undefined> = {};
    var _stylePromises: Record<string, Promise<void> | undefined> = {};

    function readBundles() {
        try {
            var meta = document.querySelector('meta[name="leletv-page-bundles"]');
            var raw = meta && meta.getAttribute('content');
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('页面 bundle 映射解析失败:', e);
            return {};
        }
    }

    function versionQuery() {
        var v = pageLoaderWindow.__LELETV_VERSION__ || '';
        return v ? '?v=' + encodeURIComponent(v) : '';
    }

    function has(name: string): boolean {
        return !!FRAGMENTS[name];
    }

    function isLoaded(name: string): boolean {
        return !!(name && document.getElementById('page-' + name));
    }

    function loadStyle(key: string): Promise<void> {
        const existing = _stylePromises[key];
        if (existing) return existing;
        var href = STYLES[key];
        if (!href) return Promise.resolve();

        const task = new Promise<void>(function (resolve) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href + versionQuery();
            link.setAttribute('data-leletv-style', key);
            link.onload = function () { resolve(); };
            // 样式失败不阻断页面：内容仍可操作，只是外观退化为无样式
            link.onerror = function () {
                console.warn('页面样式加载失败:', href);
                resolve();
            };
            document.head.appendChild(link);
        });
        _stylePromises[key] = task;
        return task;
    }

    function loadScript(name: string): Promise<void> {
        var src = PAGE_SCRIPTS[name];
        if (!src) return Promise.resolve();
        const existing = _scriptPromises[name];
        if (existing) return existing;

        const task = new Promise<void>(function (resolve) {
            var s = document.createElement('script');
            s.src = src + versionQuery();
            s.type = 'module';
            s.async = true;
            s.setAttribute('data-leletv-page-script', name);
            s.onload = function () { resolve(); };
            s.onerror = function () {
                console.warn('页面脚本加载失败:', src);
                resolve();
            };
            document.head.appendChild(s);
        });
        _scriptPromises[name] = task;
        return task;
    }

    function fetchFragment(name: string): Promise<void> {
        return fetch(FRAGMENTS[name] + versionQuery(), { credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            })
            .then(function (html) {
                // 并发/重复进入：片段已经插入就不再重复
                if (document.getElementById('page-' + name)) return;
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var node = doc.querySelector('#page-' + name);
                if (!node) throw new Error('片段缺少 #page-' + name);
                var main = document.querySelector('.main-container');
                if (!main) throw new Error('缺少 .main-container');
                main.appendChild(document.importNode(node, true));
            });
    }

    function showFallback(name: string): void {
        if (document.getElementById('page-' + name)) return;
        var main = document.querySelector('.main-container');
        if (!main) return;
        var div = document.createElement('div');
        div.id = 'page-' + name;
        div.className = 'page-content';
        div.innerHTML = '<div class="v2-wrap v2-page"><div class="v2-state">'
            + '<h3>页面加载失败</h3>'
            + '<p>请检查网络后刷新重试。</p>'
            + '</div></div>';
        main.appendChild(div);
    }

    /**
     * 确保页面片段、样式与页面脚本都就绪。
     * 返回的 Promise 永远 resolve（失败时显示占位页），因此路由不需要额外兜底。
     */
    function ensure(name: string): Promise<void> {
        if (!has(name)) return Promise.resolve();
        if (isLoaded(name)) return Promise.resolve();
        const existing = _pagePromises[name];
        if (existing) return existing;

        var styles = (PAGE_STYLES[name] || []).map(loadStyle);

        const task = Promise.all([
            fetchFragment(name),
            Promise.all(styles),
            loadScript(name)
        ]).then(function () {
            return;
        }, function (err) {
            console.warn('页面加载失败:', name, err);
            // 允许下次进入时重试
            delete _pagePromises[name];
            showFallback(name);
            return;
        });
        _pagePromises[name] = task;
        return task;
    }

    /** 空闲时预取（如搜索框聚焦时提前拉结果页），不参与首屏关键路径 */
    function prefetch(name: string): void {
        if (!has(name) || isLoaded(name) || _pagePromises[name]) return;
        function run() { ensure(name); }
        if (window.requestIdleCallback) {
            window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            setTimeout(run, 120);
        }
    }

    var api = {
        has: has,
        isLoaded: isLoaded,
        ensure: ensure,
        prefetch: prefetch
    };

    return api;
})();

// HTML 内联脚本 / 页面模块仍按全局名访问
(pageLoaderWindow as PageLoaderWindow & { LeLePages?: typeof LeLePages }).LeLePages = LeLePages;


// 过渡期类型桥：search / router / boot 仍通过 window.LeLePages 访问（跨层契约）
declare global {
    interface Window {
        LeLePages?: typeof LeLePages;
    }
}
