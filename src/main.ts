// 全局变量（在 api-config.js 中初始化，直接引用 window 上的值）
// var selectedAPIs / customAPIs 已在 src/services/sources/config.ts 中声明

interface MainWindow extends Window {
  __LELETV_BOOT_READY__?: () => void;
  __LELETV_REFRESH_API_CHECKBOXES__?: () => void;
  __LELETV_INIT_SETTINGS_PANELS__?: () => void;
  __LELETV_INIT_SETTINGS_PAGE__?: () => void;
  __LELETV_BIND_SETTINGS_PAGE__?: () => void;
  INVITE_ADMIN_PANEL?: { render: (el: HTMLElement) => void };
  USER_DEVICES_PANEL?: { render: (el: HTMLElement) => void };
  INVITE_AUTH?: { isLocalMode: () => boolean; isVerified: () => boolean; ensureHeartbeat: () => void };
  LeLeLayout?: { refresh: () => void };
  LeLeThemeSystem?: { render: () => void };
  syncRemoteApiSites?: () => Promise<string[] | null | undefined>;
  LeLeTV?: LeLeTVAdapter;
}

const mainWindow = window as MainWindow;

// 添加当前视频的所有集数（实际在 player.js 中声明，此处仅为类型参考）
// let currentEpisodeIndex, currentEpisodes, currentVideoTitle, episodesReversed

// 搜索源过滤状态
let _activeSourceFilter = 'all';
let _lastAllResults = [];

// 搜索框就绪标志，初始化期间不响应任何事件
let _searchReady = false;

// ====== 默认数据源 ======
// 首次初始化的默认源见 src/services/sources/config.ts 的 getDefaultDataSources()：正常域固定 6 个源
// （光速 / 暴风 / 最大 / 量子 / 红牛 / 极速），隐藏域仍从私密源里随机抽 5 个。
// 「重置」走的也是同一份默认逻辑。

// 过滤配置缓存
let _filterConfig = null;

// 加载过滤配置（从外部 JSON，避免敏感词出现在代码中）

// 对搜索结果应用内容过滤

// 页面初始化（仅在主页面执行，播放页通过 player.js 独立初始化）
document.addEventListener('DOMContentLoaded', function () {
    // 检测是否在主页面（搜索输入框是否存在），播放页忽略此初始化
    if (!document.getElementById('searchInput')) return;

    // 远端数据源：先同步套用上次拉取的缓存（不发请求、不阻塞首屏）。
    // 必须排在 getRandomDataSources / initAPICheckboxes 之前，否则域内随机选源看不到远端源
    if (typeof window.applyRemoteApiSitesFromCache === 'function') {
        window.applyRemoteApiSitesFromCache();
    }

    // 设置默认API选择（必须在 initAPICheckboxes 之前，否则复选框不同步）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        // 首次初始化：正常域固定 6 个默认源，隐藏域随机 5 个私密源
        selectedAPIs = (typeof getDefaultDataSources === 'function') ? getDefaultDataSources() : [];
        localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');
        localStorage.setItem('hasInitializedDefaults', 'true');
        localStorage.setItem('dataSourceLogicVersion', DATA_SOURCE_LOGIC_VERSION);
        // 首次访问（含清除缓存后重开）：首页播放"粒子凝聚成 LeLeTV → 爆开"的入场过渡
        setTimeout(function () {
            if (typeof playHomeIntro === 'function') playHomeIntro();
        }, 150);
    }

    // 数据源选择逻辑（含每日刷新/版本迁移）不依赖 DOM，仍需在首屏执行；
    // 设置页的复选框渲染延后到片段加载后（见 initSettingsPage）
    if (typeof applyNewDataSourceLogic === 'function') applyNewDataSourceLogic();

    // 首帧直达设置页时片段可能已就绪，这里先跑一次；否则由路由在片段插入后调用
    initSettingsPage();

    // 设置事件监听器
    setupEventListeners();

    // 交互已就绪 → 通知启动占位可以收尾（index.html 的粒子引擎等的就是这个信号）。
    // 位置刻意放在 setupEventListeners() 之后：页面"点得动"的必要条件此时已满足；
    // 后面几步（历史下拉复位、延迟标记）即使出错，也不该把用户永远挡在启动占位后面
    if (typeof mainWindow.__LELETV_BOOT_READY__ === 'function') {
        mainWindow.__LELETV_BOOT_READY__();
    }

    // 确保搜索历史下拉默认隐藏，并强制移除焦点
    hideSearchHistory();
    document.getElementById('searchInput').blur();

    // 延迟标记搜索就绪，防止浏览器自动填充/自动聚焦触发下拉
    setTimeout(() => { _searchReady = true; }, TIMING.SEARCH_READY_DELAY);

    // 初始检查隐藏API选中状态
    setTimeout(checkHiddenAPIsSelected, TIMING.FOCUS_DELAY);

    // 后台拉取最新远端数据源。此时已过 __LELETV_BOOT_READY__（首屏就绪点），
    // 网络再慢也不拖慢启动；只有列表真的变化时才重建设置页的复选框
    if (typeof mainWindow.syncRemoteApiSites === 'function') {
        mainWindow.syncRemoteApiSites().then(function (changed) {
            if (changed && changed.length && typeof mainWindow.__LELETV_REFRESH_API_CHECKBOXES__ === 'function') {
                mainWindow.__LELETV_REFRESH_API_CHECKBOXES__();
            }
        });
    }
});

// 远端数据源有变化时刷新设置页的源列表。
// initAPICheckboxes 是整体重建（内部含域内随机选源逻辑，重复调用安全），
// 抽成具名函数是为了让「后台拉取完成」这一时机能主动刷新一次。
mainWindow.__LELETV_REFRESH_API_CHECKBOXES__ = function () {
    if (!document.getElementById('apiCheckboxes')) return;
    try {
        initAPICheckboxes();
        updateSelectedApiCount();
        checkHiddenAPIsSelected();
    } catch (e) {
        console.warn('刷新数据源列表失败:', e);
    }
};

// bfcache 恢复（从播放页返回）：按 hash 恢复来源页并重新加载其数据
window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
        // 清除首页搜索结果残留（结果页/历史页不含这些元素，清理无副作用）
        const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
        if (searchInput) searchInput.value = '';
        const resultsEl = document.getElementById('results');
        if (resultsEl) resultsEl.innerHTML = '';
        document.getElementById('resultsArea')?.classList.add('hidden');
        document.getElementById('searchArea')?.classList.remove('flex-1', 'mb-8');
        document.querySelector('.home-layout')?.classList.remove('has-results');
        document.getElementById('closeSearchResults')?.classList.add('hidden');
        _lastAllResults = [];
        _activeSourceFilter = 'all';
        const filterTabs = document.getElementById('sourceFilterTabs');
        if (filterTabs) filterTabs.innerHTML = '';

        // 关键：不强制回首页、不清除 hash。
        // 进入播放页前的页面已在 URL hash 里（#category / #movies / #history ...），
        // 按它恢复才能回到用户的原始位置；bfcache 恢复不会触发 hashchange，必须显式重放。
        const page = location.hash.slice(1) || 'home';
        if (typeof showPage === 'function') {
            showPage(page);
        }
        // 重新拉取该页数据：历史页借此刷新播放进度与视频源变更，结果页恢复其结果内容
        if (typeof handlePageLoad === 'function') {
            handlePageLoad(page);
        }
    }
});

// 设置事件监听器

// 重置搜索区域

// 获取自定义API信息

// ========== 骨架屏辅助 ==========

// 搜索功能节流锁
let _searchThrottled = false;

// 移动端全屏搜索覆盖层


// 搜索功能 - 修改为支持多选API和多页结果

// 生成搜索卡片HTML（带XSS保护）

// 中文数字转阿拉伯数字

// 从视频标题中提取基础片名和季/部/集序号

// 获取API源的人类可读名称

// 基于当前配置初始化过滤标签（初始渲染用，搜索完成后会被实际结果覆盖）

// 渲染搜索源过滤标签（从实际搜索结果中提取源列表）

// 更新「全部」标签的计数

// 按源过滤搜索结果并重绘

// 设置邮箱点击事件处理器（使用 .contact-link 类统一绑定）
function setupEmailClickHandlers() {
    const contactElements = document.querySelectorAll('.contact-link');
    contactElements.forEach(element => {
        element.addEventListener('click', function(event) {
                // 阻止冒泡（避免外层 <label> 的开关被连带切换）与默认跳转
                // （mailto 由下方 JS 统一唤起，防止 <a href="mailto:"> 造成重复触发）
                event.preventDefault();
                event.stopPropagation();
                const email = 'jiunian929@gmail.com';
                const originalText = this.textContent; // 保存原始文本
                let clientOpened = false; // 标记客户端是否打开
                
                // 添加高亮效果到点击的元素
                this.classList.add('email-highlight');
                
                // 复制邮箱到剪贴板
                const textArea = document.createElement('textarea');
                textArea.value = email;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('复制失败:', err);
                }
                
                document.body.removeChild(textArea);
                
                // 创建a标签并设置mailto属性以打开邮件客户端
                const mailtoLink = document.createElement('a');
                mailtoLink.href = `mailto:${email}`;
                mailtoLink.style.display = 'none';
                document.body.appendChild(mailtoLink);
                mailtoLink.click();
                document.body.removeChild(mailtoLink);
                
                // 检查邮件客户端是否成功打开
                setTimeout(() => {
                    // 如果页面仍然可见，假设邮件客户端没有成功打开
                    if (document.visibilityState === 'visible' && !clientOpened) {
                        // 显示邮箱覆盖"联系乐乐"
                        this.textContent = email;
                        
                        // 显示指定的提示消息
                        showToast(`'${email}'已复制`, 'success');
                        
                        // 3秒后恢复原始文本和移除高亮效果
                        setTimeout(() => {
                            this.textContent = originalText;
                            this.classList.remove('email-highlight');
                        }, 3000);
                    } else {
                        // 客户端打开成功，显示原有提示
                        showToast(`邮箱 ${email} 已复制并正在打开邮件客户端`, 'success');
                        
                        // 3秒后移除高亮效果
                        setTimeout(() => {
                            this.classList.remove('email-highlight');
                        }, 3000);
                    }
                }, 1000); // 1秒后检查状态
            });
    });
}

// 关闭搜索结果，恢复居中布局

// 劫持搜索框的value属性以检测外部修改
document.addEventListener('DOMContentLoaded', hookInput);

// 从URL导入配置

// 配置文件导入功能

// 配置文件导出功能

// 将字符串保存为文件

// 传统搜索方式（作为降级选项）

// 卡片交错入场动画

// 设置页面板：根据角色显示不同管理面板
// 管理员 → 邀请码管理，普通用户 → 设备管理

document.addEventListener('passwordVerified', function() {
    // 隐藏设备管理（管理员不需要）
    const userContainer = document.getElementById('userDeviceContainer');
    if (userContainer) userContainer.classList.add('hidden');

    // 显示邀请码管理
    const adminContainer = document.getElementById('inviteAdminContainer');
    if (adminContainer && mainWindow.INVITE_ADMIN_PANEL) {
        adminContainer.classList.remove('hidden');
        mainWindow.INVITE_ADMIN_PANEL.render(adminContainer);
    }
});

document.addEventListener('inviteVerified', function() {
    // 本地版没有邀请码后端，设备管理无数据可取
    if (mainWindow.INVITE_AUTH && mainWindow.INVITE_AUTH.isLocalMode()) return;
    // 显示设备管理
    const userContainer = document.getElementById('userDeviceContainer');
    if (userContainer && mainWindow.USER_DEVICES_PANEL) {
        userContainer.classList.remove('hidden');
        mainWindow.USER_DEVICES_PANEL.render(userContainer);
    }
});

// 页面加载完成后根据身份显示对应面板（管理员 → 邀请码管理，普通用户 → 设备管理）。
// 抽成具名函数并挂到 window：user-devices.js / admin-panel.js 已从首屏关键路径移出，
// 首次执行时它们还不存在，需要在延后加载完成后再跑一次。
// 两个模块的 render() 都是整体重建 container.innerHTML，重复调用是安全的
function initSettingsPanels() {
    // 本地版没有邀请码后端：设备管理、邀请码管理都不渲染
    if (mainWindow.INVITE_AUTH && mainWindow.INVITE_AUTH.isLocalMode()) return;
    const isAdmin = localStorage.getItem('leletv_is_admin') === 'true';
    const hasInviteAuth = mainWindow.INVITE_AUTH && mainWindow.INVITE_AUTH.isVerified();

    if (isAdmin && mainWindow.INVITE_ADMIN_PANEL) {
        const adminContainer = document.getElementById('inviteAdminContainer');
        if (adminContainer) {
            adminContainer.classList.remove('hidden');
            mainWindow.INVITE_ADMIN_PANEL.render(adminContainer);
        }
    } else if (hasInviteAuth && mainWindow.USER_DEVICES_PANEL) {
        const userContainer = document.getElementById('userDeviceContainer');
        if (userContainer) {
            userContainer.classList.remove('hidden');
            mainWindow.USER_DEVICES_PANEL.render(userContainer);
        }
    }

    // 确保已验证用户的心跳在页面加载后立即运行
    if (hasInviteAuth && mainWindow.INVITE_AUTH) {
        mainWindow.INVITE_AUTH.ensureHeartbeat();
    }
}

mainWindow.__LELETV_INIT_SETTINGS_PANELS__ = initSettingsPanels;

// 设置页整体初始化：片段按需插入后由路由调用。
// 首屏 DOM 里没有设置页标记，所以所有设置页渲染/绑定都必须集中在这里处理。
function initSettingsPage() {
    // 片段还没插入：什么都不做（路由会在插入后重新调用）
    if (!document.getElementById('apiCheckboxes')) return;

    initAPICheckboxes();
    renderCustomAPIsList();
    updateSelectedApiCount();
    checkHiddenAPIsSelected();

    const adFilterToggle = document.getElementById('adFilterToggle') as HTMLInputElement | null;
    if (adFilterToggle) {
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false';
    }

    // 私密模式 / 广告过滤开关的绑定在 app-search.js，首屏时片段不存在，这里补绑（函数内幂等）
    if (typeof mainWindow.__LELETV_BIND_SETTINGS_PAGE__ === 'function') {
        mainWindow.__LELETV_BIND_SETTINGS_PAGE__();
    }

    // 首页与导航布局开关：片段插入后同步勾选状态
    if (mainWindow.LeLeLayout && typeof mainWindow.LeLeLayout.refresh === 'function') {
        mainWindow.LeLeLayout.refresh();
    }

    // 主题配色盘由 theme-system.js 渲染；脚本与片段都就绪后补一次
    if (mainWindow.LeLeThemeSystem && typeof mainWindow.LeLeThemeSystem.render === 'function') {
        mainWindow.LeLeThemeSystem.render();
    }

    initSettingsPanels();
}
mainWindow.__LELETV_INIT_SETTINGS_PAGE__ = initSettingsPage;

// ====== AppInit — 应用初始化协调器（迁移自 js/app/app-init.js，AP-002） ======
// 显式定义 LeLeTV 首页的初始化阶段和依赖顺序，不再隐式依赖 <script> 标签顺序。
// 初始化阶段（按顺序执行）：CORE → AUTH → CONFIG → UI → POST。
// 新模块通过 AppInit.register() 注册初始化函数，或直接调用 AppInit.run()。

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
    var _tasks: Array<{ name: string; order: number; fn: (context: unknown) => void; once: boolean; executed: boolean }> = [];

    /** 是否已执行 */
    var _ran = false;

    /**
     * 注册一个初始化函数
     * @param name     模块名称
     * @param phase    阶段（AppInit.PHASES.xxx）
     * @param fn       初始化函数
     * @param options  once 默认 true
     */
    function register(
        name: string,
        phase: { order: number; name: string } | undefined,
        fn: (context: unknown) => void,
        options?: { once?: boolean }
    ): void {
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
     * @param context 可选的上下文参数
     */
    function run(context?: unknown): void {
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
    function reset(): void {
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
if (typeof mainWindow.LeLeTV !== 'undefined') {
    mainWindow.LeLeTV.AppInit = AppInit;
}

// 阶段 5A-4 过渡期兼容桥：app bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  setupEmailClickHandlers,
  initSettingsPage
});

Object.defineProperty(window, '_activeSourceFilter', {
  get: () => _activeSourceFilter,
  set: (v) => { _activeSourceFilter = v; },
  configurable: true,
});

Object.defineProperty(window, '_lastAllResults', {
  get: () => _lastAllResults,
  set: (v) => { _lastAllResults = v; },
  configurable: true,
});

Object.defineProperty(window, '_searchReady', {
  get: () => _searchReady,
  set: (v) => { _searchReady = v; },
  configurable: true,
});

Object.defineProperty(window, '_filterConfig', {
  get: () => _filterConfig,
  set: (v) => { _filterConfig = v; },
  configurable: true,
});

Object.defineProperty(window, '_searchThrottled', {
  get: () => _searchThrottled,
  set: (v) => { _searchThrottled = v; },
  configurable: true,
});

Object.defineProperty(window, 'AppInit', {
  get: () => AppInit,
  set: (v) => { AppInit = v; },
  configurable: true,
});
