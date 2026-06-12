/**
 * AppInit — 应用初始化协调器
 *
 * 显式定义 LeLeTV 首页的初始化阶段和依赖顺序，不再隐式依赖 <script> 标签顺序。
 * 各模块逐步迁移到此机制，目前 index.html 的内联初始化已接入。
 * 新模块应通过 AppInit.register() 注册初始化函数。
 *
 * 初始化阶段（按顺序执行）：
 *   1. CORE   — 核心基础设施（config, storage, listener tracker）
 *   2. AUTH   — 密码验证
 *   3. CONFIG — API 配置、数据源初始化
 *   4. UI     — DOM 初始化、事件绑定
 *   5. POST   — 后处理（hash 路由、极光背景、版本检测）
 *
 * 使用方式：
 *   AppInit.register('myModule', AppInit.PHASE.UI, function() { ... });
 *   // 或直接调用
 *   AppInit.run();
 */

var AppInit = (function () {
    'use strict';

    /** 初始化阶段枚举 */
    var PHASES = {
        CORE:   { order: 0, name: 'core' },
        AUTH:   { order: 1, name: 'auth' },
        CONFIG: { order: 2, name: 'config' },
        UI:     { order: 3, name: 'ui' },
        POST:   { order: 4, name: 'post' }
    };

    /** 已注册的初始化任务 */
    var _tasks = [];

    /** 是否已执行 */
    var _ran = false;

    /**
     * 注册一个初始化函数
     * @param {string} name     模块名称
     * @param {Object} phase    阶段（AppInit.PHASE.xxx）
     * @param {Function} fn     初始化函数
     * @param {Object} [options]
     * @param {boolean} [options.once=true] 是否只执行一次
     */
    function register(name, phase, fn, options) {
        if (typeof name !== 'string' || !name) {
            console.warn('AppInit.register: 需要有效的模块名');
            return;
        }
        if (typeof fn !== 'function') {
            console.warn('AppInit.register: 需要有效的初始化函数');
            return;
        }

        var order = (phase && typeof phase.order === 'number') ? phase.order : 99;

        _tasks.push({
            name: name,
            order: order,
            fn: fn,
            once: !options || options.once !== false,
            executed: false
        });

        // 按阶段排序
        _tasks.sort(function (a, b) { return a.order - b.order; });
    }

    /**
     * 执行所有已注册的初始化任务
     * @param {Object} [context] 可选的上下文参数
     */
    function run(context) {
        if (_ran) {
            console.warn('AppInit.run: 初始化已执行过');
            return;
        }
        _ran = true;

        var i, task;
        for (i = 0; i < _tasks.length; i++) {
            task = _tasks[i];
            if (task.executed) continue;
            try {
                task.fn(context || {});
                task.executed = true;
            } catch (e) {
                console.error('AppInit: [' + task.name + '] 初始化失败:', e);
            }
        }
    }

    /**
     * 重置（主要用于测试）
     */
    function reset() {
        _tasks = [];
        _ran = false;
    }

    // 公开 API
    return {
        PHASES: PHASES,
        register: register,
        run: run,
        reset: reset
    };
})();

// 注册到 LeLeTV
if (typeof window.LeLeTV !== 'undefined') {
    window.LeLeTV.AppInit = AppInit;
}
