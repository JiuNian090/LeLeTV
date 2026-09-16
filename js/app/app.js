// 全局变量（在 api-config.js 中初始化，直接引用 window 上的值）
// var selectedAPIs / customAPIs 已在 api-config.js 中声明

// 添加当前视频的所有集数（实际在 player.js 中声明，此处仅为类型参考）
// let currentEpisodeIndex, currentEpisodes, currentVideoTitle, episodesReversed

// 搜索源过滤状态
let _activeSourceFilter = 'all';
let _lastAllResults = [];

// 搜索框就绪标志，初始化期间不响应任何事件
let _searchReady = false;

// ====== 默认数据源（随机） ======
// 首次初始化与「重置」都从当前数据域的池子里随机选 5 个源（正常域取普通源，隐藏域取隐藏源）。
// 实现见 api-config.js 的 getRandomDataSources()。

// 过滤配置缓存
let _filterConfig = null;

// 加载过滤配置（从外部 JSON，避免敏感词出现在代码中）

// 对搜索结果应用内容过滤

// 页面初始化（仅在主页面执行，播放页通过 player.js 独立初始化）
document.addEventListener('DOMContentLoaded', function () {
    // 检测是否在主页面（搜索输入框是否存在），播放页忽略此初始化
    if (!document.getElementById('searchInput')) return;

    // 设置默认API选择（必须在 initAPICheckboxes 之前，否则复选框不同步）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        // 首次初始化：从当前数据域随机选 5 个源
        selectedAPIs = (typeof getRandomDataSources === 'function') ? getRandomDataSources(5) : [];
        localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');
        localStorage.setItem('hasInitializedDefaults', 'true');
        localStorage.setItem('dataSourceLogicVersion', 'v1');
        // 首次访问（含清除缓存后重开）：首页播放"粒子凝聚成 LeLeTV → 爆开"的入场过渡
        setTimeout(function () {
            if (typeof playHomeIntro === 'function') playHomeIntro();
        }, 150);
    }

    // 初始化API复选框
    initAPICheckboxes();

    // 初始化自定义API列表
    renderCustomAPIsList();

    // 初始化显示选中的API数量
    updateSelectedApiCount();

    // 同步隐藏内容模式开关状态（统一由 checkHiddenAPIsSelected 处理）
    checkHiddenAPIsSelected();

    // 设置广告过滤开关初始状态
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        // 默认打开分片广告过滤功能
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true
    }

    // 设置事件监听器
    setupEventListeners();

    // 交互已就绪 → 通知启动占位可以收尾（index.html 的粒子引擎等的就是这个信号）。
    // 位置刻意放在 setupEventListeners() 之后：页面"点得动"的必要条件此时已满足；
    // 后面几步（历史下拉复位、延迟标记）即使出错，也不该把用户永远挡在启动占位后面
    if (typeof window.__LELETV_BOOT_READY__ === 'function') {
        window.__LELETV_BOOT_READY__();
    }

    // 确保搜索历史下拉默认隐藏，并强制移除焦点
    hideSearchHistory();
    document.getElementById('searchInput').blur();

    // 延迟标记搜索就绪，防止浏览器自动填充/自动聚焦触发下拉
    setTimeout(() => { _searchReady = true; }, TIMING.SEARCH_READY_DELAY);

    // 初始检查隐藏API选中状态
    setTimeout(checkHiddenAPIsSelected, TIMING.FOCUS_DELAY);
});

// bfcache 恢复（从播放页返回）：按 hash 恢复来源页并重新加载其数据
window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
        // 清除首页搜索结果残留（结果页/历史页不含这些元素，清理无副作用）
        const searchInput = document.getElementById('searchInput');
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
    if (adminContainer && window.INVITE_ADMIN_PANEL) {
        adminContainer.classList.remove('hidden');
        window.INVITE_ADMIN_PANEL.render(adminContainer);
    }
});

document.addEventListener('inviteVerified', function() {
    // 显示设备管理
    const userContainer = document.getElementById('userDeviceContainer');
    if (userContainer && window.USER_DEVICES_PANEL) {
        userContainer.classList.remove('hidden');
        window.USER_DEVICES_PANEL.render(userContainer);
    }
});

// 页面加载完成后根据身份显示对应面板（管理员 → 邀请码管理，普通用户 → 设备管理）。
// 抽成具名函数并挂到 window：user-devices.js / admin-panel.js 已从首屏关键路径移出，
// 首次执行时它们还不存在，需要在延后加载完成后再跑一次。
// 两个模块的 render() 都是整体重建 container.innerHTML，重复调用是安全的
function initSettingsPanels() {
    const isAdmin = localStorage.getItem('leletv_is_admin') === 'true';
    const hasInviteAuth = window.INVITE_AUTH && window.INVITE_AUTH.isVerified();

    if (isAdmin && window.INVITE_ADMIN_PANEL) {
        const adminContainer = document.getElementById('inviteAdminContainer');
        if (adminContainer) {
            adminContainer.classList.remove('hidden');
            window.INVITE_ADMIN_PANEL.render(adminContainer);
        }
    } else if (hasInviteAuth && window.USER_DEVICES_PANEL) {
        const userContainer = document.getElementById('userDeviceContainer');
        if (userContainer) {
            userContainer.classList.remove('hidden');
            window.USER_DEVICES_PANEL.render(userContainer);
        }
    }

    // 确保已验证用户的心跳在页面加载后立即运行
    if (hasInviteAuth && window.INVITE_AUTH) {
        window.INVITE_AUTH.ensureHeartbeat();
    }
}

window.__LELETV_INIT_SETTINGS_PANELS__ = initSettingsPanels;
document.addEventListener('DOMContentLoaded', initSettingsPanels);
