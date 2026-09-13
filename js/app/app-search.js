// 搜索结果缓存：跳转播放页前保存，返回首页时秒开（不重新发起搜索）
const SEARCH_CACHE_KEY = 'leletv_search_cache';
const SEARCH_CACHE_MAX = 800; // 缓存结果条数上限（控制 sessionStorage 体积）

// 点击卡片跳转播放页的延迟定时器：保证流星动画循环可见后再跳转
let _pendingPlayDirectTimer = null;

// 获取当前搜索关键词（从 URL /s= 或 ?s= 提取）
function getCurrentSearchKeyword() {
    try {
        const path = window.location.pathname;
        if (path.startsWith('/s=')) return decodeURIComponent(path.substring(3));
        const sp = new URLSearchParams(window.location.search);
        return sp.get('s') || '';
    } catch (e) { return ''; }
}

// 跳转播放页前缓存搜索结果，返回结果页/首页时直接渲染
function cacheSearchContext() {
    try {
        // 优先缓存结果页状态（搜索/类别统一入口）
        if (typeof _moviesState !== 'undefined' && _moviesState && _moviesState.keyword && _moviesState.results && _moviesState.results.length) {
            const payload = {
                keyword: _moviesState.keyword,
                results: _moviesState.results.slice(0, SEARCH_CACHE_MAX),
                activeFilter: _moviesState.activeSource || 'all',
                from: _moviesState.from || 'home',
                sourcePage: 'movies',
                timestamp: Date.now()
            };
            sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(payload));
            return;
        }
        if (!_lastAllResults || _lastAllResults.length === 0) return;
        const keyword = getCurrentSearchKeyword() || document.getElementById('searchInput').value.trim();
        if (!keyword) return;
        const payload = {
            keyword: keyword,
            results: _lastAllResults.slice(0, SEARCH_CACHE_MAX),
            activeFilter: _activeSourceFilter || 'all',
            timestamp: Date.now()
        };
        sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('[LeLeTV] 缓存搜索结果失败:', e);
    }
}

// 从缓存恢复搜索结果（直接渲染，不发起搜索请求）；返回是否恢复成功
function restoreSearchFromCache() {
    let cached = null;
    try {
        const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
        if (!raw) return false;
        cached = JSON.parse(raw);
        sessionStorage.removeItem(SEARCH_CACHE_KEY);
    } catch (e) {
        try { sessionStorage.removeItem(SEARCH_CACHE_KEY); } catch (e2) { /* 忽略 */ }
        return false;
    }
    if (!cached || !cached.keyword || !Array.isArray(cached.results) || cached.results.length === 0) return false;

    // 结果页缓存：委托结果页模块恢复（搜索/类别统一入口）
    if (cached.sourcePage === 'movies' && typeof restoreMoviesFromCache === 'function') {
        if (restoreMoviesFromCache(cached)) return true;
    }

    // 还原内存状态
    _lastAllResults = cached.results;
    _activeSourceFilter = cached.activeFilter || 'all';

    // 搜索框保持为空：避免残留关键词在下次打开搜索页/切换页面时被重复搜索
    clearSearchInput();

    // 还原布局（与搜索完成后的状态一致）
    document.getElementById('searchArea').classList.remove('flex-1');
    document.getElementById('searchArea').classList.add('mb-8');
    document.getElementById('resultsArea').classList.remove('hidden');
    document.querySelector('.home-layout')?.classList.add('has-results');
    document.getElementById('closeSearchResults')?.classList.remove('hidden');
    document.getElementById('closeSearchResults')?.classList.add('flex');

    // 渲染来源过滤标签 + 应用过滤（渲染卡片）
    _renderSourceFilterTabs(_lastAllResults.length);
    _applySourceFilter(_activeSourceFilter);

    // 更新标题和 URL（不触发重新搜索）
    document.title = `搜索: ${cached.keyword} - LeLeTV`;
    try {
        window.history.replaceState(
            { search: cached.keyword },
            `搜索: ${cached.keyword} - LeLeTV`,
            `/s=${encodeURIComponent(cached.keyword)}`
        );
    } catch (e) { /* 忽略 */ }

    hideSearchHistory();
    return true;
}

async function loadFilterConfig() {
    if (_filterConfig) return _filterConfig;
    try {
        const res = await fetch('/js/filter-config.json');
        _filterConfig = await res.json();
    } catch (e) {
        console.warn('过滤配置加载失败，使用默认空配置:', e);
        _filterConfig = { mode: 'blacklist', blacklist: [], whitelist: [] };
    }
    return _filterConfig;
}

async function applyFilter(results) {
    if (!results || results.length === 0) return results;
    const config = await loadFilterConfig();
    if (config.mode === 'whitelist') {
        // 白名单模式：只保留分类在白名单中的结果
        return results.filter(item => {
            const typeName = (item.type_name || '').toLowerCase();
            return config.whitelist.some(w => typeName.includes(w.toLowerCase()));
        });
    }
    // 黑名单模式（默认）：过滤掉匹配黑名单的结果
    return results.filter(item => {
        const typeName = (item.type_name || '').toLowerCase();
        return !config.blacklist.some(k => typeName.includes(k.toLowerCase()));
    });
}

// 循环水波纹加载反馈：从点击位置注入 3 个错峰波纹环（配合卡片按压缩放）
function addCardRipple(el, e) {
    const rect = el.getBoundingClientRect();
    const rx = e.clientX - rect.left;
    const ry = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;
    for (let i = 0; i < 3; i++) {
        const ripple = document.createElement('span');
        ripple.className = 'card-ripple';
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (rx - size / 2) + 'px';
        ripple.style.top = (ry - size / 2) + 'px';
        ripple.style.animationDelay = (i * 0.4) + 's'; // 3 环错峰覆盖 1.2s 周期
        el.appendChild(ripple);
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');

    // 回车搜索
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            hideSearchHistory();
            search();
        }
    });

    // 搜索历史下拉：点击/触摸时显示
    // 窄窗口触发全屏覆盖层，宽窗口显示下拉
    searchInput.addEventListener('pointerdown', function (e) {
        if (!_searchReady) return;
        if (window.innerWidth <= 639) {
            e.preventDefault();
            openMobileSearch();
            return;
        }
        showSearchHistory(this.value);
    });

    // focus 确保宽窗口下键盘正常弹出
    searchInput.addEventListener('focus', function () {
        if (!_searchReady) return;
        if (window.innerWidth > 639) {
            showSearchHistory(this.value);
        }
    });

    // 搜索历史下拉：输入时过滤（移动端用覆盖层，不显示桌面下拉）
    searchInput.addEventListener('input', function () {
        if (!_searchReady) return;
        if (_resettingSearchArea) return;
        if (window.innerWidth <= 639) return;
        showSearchHistory(this.value);
    });

    // 搜索历史下拉：Escape 关闭
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hideSearchHistory();
        }
    });

    // 搜索历史下拉：事件委托（点击条目、删除、清除全部）
    const historyDropdown = document.getElementById('searchHistoryDropdown');
    if (historyDropdown) {
        historyDropdown.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.history-delete');
            const clearBtn = e.target.closest('.search-history-clear');
            const item = e.target.closest('.search-history-item');

            if (deleteBtn) {
                e.stopPropagation();
                const query = deleteBtn.dataset.query;
                if (query) {
                    // 先让该条历史化作粒子消散，播完再删除并重渲染
                    dissolveThenRemove(deleteBtn.closest('.search-history-item'), function () {
                        deleteSingleSearchHistory(query);
                        showSearchHistory(document.getElementById('searchInput').value);
                    });
                }
                return;
            }

            if (clearBtn) {
                e.stopPropagation();
                // 整块历史列表一起化作粒子消散，播完再清空
                dissolveThenRemove(clearBtn.closest('#searchHistoryDropdown'), function () {
                    clearSearchHistory();
                });
                return;
            }

            if (item) {
                e.stopPropagation();
                const query = item.dataset.query;
                if (query) {
                    document.getElementById('searchInput').value = query;
                    hideSearchHistory();
                    search();
                }
            }
        });
    }

    // 点击页面其他位置关闭下拉
    document.addEventListener('click', function (e) {
        const dropdown = document.getElementById('searchHistoryDropdown');
        const searchInput = document.getElementById('searchInput');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (!dropdown.contains(e.target) && e.target !== searchInput) {
                hideSearchHistory();
            }
        }
    });

    // 滚动或窗口大小变化时重新定位下拉（fixed定位需要同步位置）
    window.addEventListener('scroll', repositionSearchHistory, { passive: true });
    window.addEventListener('resize', repositionSearchHistory, { passive: true });

    // 移动端键盘弹出/收起时重新定位下拉
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', repositionSearchHistory);
        window.visualViewport.addEventListener('scroll', repositionSearchHistory);
    }
    
    // 移动端全屏搜索覆盖层
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const mobileSearchCancel = document.getElementById('mobileSearchCancel');
    const mobileHistoryList = document.getElementById('mobileSearchHistoryList');

    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', function () {
            renderMobileSearchHistory(this.value);
        });

        mobileSearchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const val = this.value.trim();
                if (val) {
                    document.getElementById('searchInput').value = val;
                    closeMobileSearch();
                    search();
                }
            }
            if (e.key === 'Escape') {
                closeMobileSearch();
            }
        });
    }

    if (mobileSearchCancel) {
        mobileSearchCancel.addEventListener('click', closeMobileSearch);
    }

    if (mobileHistoryList) {
        mobileHistoryList.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.history-delete');
            const clearBtn = e.target.closest('.search-history-clear');
            const item = e.target.closest('.search-history-item');

            if (deleteBtn) {
                e.stopPropagation();
                const query = deleteBtn.dataset.query;
                if (query) {
                    // 先让该条历史化作粒子消散，播完再删除并重渲染
                    dissolveThenRemove(deleteBtn.closest('.search-history-item'), function () {
                        deleteSingleSearchHistory(query);
                        renderMobileSearchHistory(mobileSearchInput ? mobileSearchInput.value : '');
                    });
                }
                return;
            }

            if (clearBtn) {
                e.stopPropagation();
                // 整块历史列表一起化作粒子消散，播完再清空
                dissolveThenRemove(clearBtn.closest('.mobile-search-history-list'), function () {
                    clearSearchHistory();
                    renderMobileSearchHistory('');
                });
                return;
            }

            if (item) {
                e.stopPropagation();
                const query = item.dataset.query;
                if (query && mobileSearchInput) {
                    mobileSearchInput.value = query;
                    document.getElementById('searchInput').value = query;
                    closeMobileSearch();
                    search();
                }
            }
        });
    }

    // 移动端键盘适配：覆盖层跟随 visualViewport（键盘弹出/收起时）
    // 利用 CSS dvh 自动处理大部分情况，JS 仅作为兜底修正
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function () {
            const overlay = document.getElementById('mobileSearchOverlay');
            if (!overlay || !overlay.classList.contains('active')) return;
            const vv = window.visualViewport;
            const isKeyboardVisible = vv.height < vv.width * 0.6; // 典型宽高比判断键盘是否弹出
            if (isKeyboardVisible) {
                // 键盘弹出时用 visualViewport 精确尺寸覆盖
                overlay.style.height = vv.height + 'px';
                overlay.style.top = '0px';
                // 调整搜索历史列表高度：visualViewport 高度减去 header 高度
                const header = overlay.querySelector('.mobile-search-header');
                const list = overlay.querySelector('.mobile-search-history-list');
                if (header && list) {
                    list.style.height = (vv.height - header.offsetHeight) + 'px';
                }
            } else {
                // 键盘收起时移除内联样式，让 CSS dvh 接管
                overlay.style.height = '';
                overlay.style.top = '';
                const list = overlay.querySelector('.mobile-search-history-list');
                if (list) list.style.height = '';
            }
        });
    }

    // 初始化邮箱点击事件处理器
    setupEmailClickHandlers();

    // 隐藏内容模式开关：切换数据域（正常 ⇄ 隐藏），进入隐藏域需私密密码
    const hiddenModeToggle = document.getElementById('hiddenContentModeToggle');
    if (hiddenModeToggle) {
        hiddenModeToggle.checked = isHiddenContentMode();
        hiddenModeToggle.addEventListener('change', async function (e) {
            const wantHidden = e.target.checked;

            // 进入隐藏域需要私密密码；退出回正常域不需要
            if (wantHidden) {
                const isAdminVerified = await verifyAdminPassword();
                if (!isAdminVerified) {
                    e.target.checked = false;
                    showToast('需要私密密码才能进入私密模式', 'warning');
                    return;
                }
            }

            try {
                localStorage.setItem(HIDDEN_MODE_KEY, wantHidden ? 'true' : 'false');
            } catch (err) {
                console.error('切换私密模式失败:', err);
                e.target.checked = !wantHidden;
                return;
            }

            // 数据域已切换：源/历史/自定义API都要按新域重新读取，重载最可靠
            // 重载后停留在设置页（开关所在页），避免回落到默认首页
            rememberPageForReload('settings');
            // 不沿用上次搜索：清掉搜索结果缓存（否则重载或返回时会恢复旧域的结果页）
            try { sessionStorage.removeItem(SEARCH_CACHE_KEY); } catch (err) { /* 忽略 */ }
            // 动效期间锁住开关，避免重复触发切换
            e.target.disabled = true;
            // 过渡动效：卡片粒子消散 → 重载后粒子汇聚生成新页面（期间不出现加载弹窗/闪屏）
            if (typeof playParticleDissolve === 'function') {
                playParticleDissolve(function () { window.location.reload(); });
            } else {
                window.location.reload();
            }
        });
    }

    // 广告过滤开关事件绑定
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', function (e) {
            localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
        });
    }

    // 搜索源过滤标签切换（事件委托）
    const sourceFilterTabs = document.getElementById('sourceFilterTabs');
    if (sourceFilterTabs) {
        sourceFilterTabs.addEventListener('click', function (e) {
            const tab = e.target.closest('.source-filter-tab');
            if (!tab) return;
            const sourceFilter = tab.dataset.source;
            if (!sourceFilter || sourceFilter === _activeSourceFilter) return;
            _applySourceFilter(sourceFilter);
        });
    }

    // 全局 data-action 事件委托（替代 HTML onclick）
    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.dataset.action;
        if (!action) return;

        switch (action) {
            case 'switch-page': switchPage(el.dataset.page); break;
            case 'reset-home': resetSearchArea(); closeMobileSearch(); hideSearchHistory(); break;
            case 'close-results': closeSearchResults(); break;
            case 'movies-back': moviesPageBack(); break;
            case 'search': search(); break;
            case 'close-modal': closeModal(); break;
            case 'open-disclaimer': openDisclaimerModal(); break;
            case 'open-invite-guide': openInviteGuideModal(); break;
            case 'close-invite-guide': closeInviteGuideModal(); break;
            case 'accept-disclaimer': closeDisclaimerModal(); break;
            case 'select-all-apis': selectAllAPIs(true); break;
            case 'deselect-all-apis': selectAllAPIs(false); break;
            case 'reset-apis': {
                // 重置后从当前数据域随机选 5 个源（正常域取普通源，隐藏域取隐藏源）
                resetDataSourceLogic();
                break;
            }
            case 'show-add-custom-api': showAddCustomApiForm(); break;
            case 'add-custom-api': addCustomApi(); break;
            case 'cancel-add-custom-api': cancelAddCustomApi(); break;
            case 'import-config': importConfig(); break;
            case 'export-config': exportConfig(); break;
            case 'clear-cache': clearLocalStorage(); break;
            // ---- onclick→data-action 迁移新增 ----
            case 'play-directly': {
                const id = el.dataset.id;
                const name = el.dataset.name;
                const source = el.dataset.source;
                if (id && name && source) {
                    // 清除其他卡片的加载状态与未触发的跳转定时器（防止快速连点跳错片）
                    document.querySelectorAll('.search-result-card.card-loading').forEach(function (c) {
                        c.classList.remove('card-loading');
                        c.querySelectorAll('.card-ripple').forEach(function (r) { r.remove(); });
                    });
                    if (_pendingPlayDirectTimer) clearTimeout(_pendingPlayDirectTimer);
                    // 给当前点击卡片添加加载状态（按压缩放），并注入水波纹反馈
                    el.classList.add('card-loading');
                    addCardRipple(el, e);
                    // 动画期间先展示反馈再跳转播放页。
                    // iOS Safari 若立即跳转会跳过中间渲染帧，动画完全不可见。
                    _pendingPlayDirectTimer = setTimeout(function () {
                        _pendingPlayDirectTimer = null;
                        playDirectly(id, name, source);
                    }, 800);
                }
                break;
            }
            case 'edit-custom-api': editCustomApi(parseInt(el.dataset.index)); break;
            case 'remove-custom-api': {
                // 先让该条自定义 API 化作粒子消散，播完再真正移除
                // （条目是 #customApisList 的直接子 div，无需在渲染处加类名）
                const removeApiIndex = parseInt(el.dataset.index);
                dissolveThenRemove(el.closest('#customApisList > div'), function () {
                    removeCustomApi(removeApiIndex);
                });
                break;
            }
            case 'update-custom-api': updateCustomApi(parseInt(el.dataset.index)); break;
            case 'cancel-edit-custom-api': cancelEditCustomApi(); break;
            case 'load-tmdb-results': loadTmdbResults(); break;
            case 'tmdb-search-video': tmdbSearchVideo(el.dataset.title, el.dataset.genres || ''); break;
            case 'play-from-history': {
                const url = el.dataset.url;
                const title = el.dataset.title;
                const index = parseInt(el.dataset.index || '0');
                const position = parseInt(el.dataset.position || '0');
                if (url && title) playFromHistory(url, title, index, position);
                break;
            }
            case 'delete-history-item': {
                const itemUrl = el.dataset.url;
                const itemTitle = el.dataset.title;
                if (itemUrl) {
                    event.stopPropagation();
                    // 传入所在卡片：先播粒子消散，播完再删除并重渲染
                    deleteHistoryItem(itemUrl, itemTitle, el.closest('.history-item'));
                }
                break;
            }
            case 'import-config-from-url': importConfigFromUrl(); break;
            case 'switch-to-category': switchPage('category'); break;
            case 'share-invite': shareInviteInfo(); break;
        }
    });

    // 搜索框回车事件（独立绑定，不再用 onkeypress）
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            hideSearchHistory();
            search();
        }
    });
}

// 在重置搜索区域时抑制 hookInput 触发的 input→showSearchHistory
var _resettingSearchArea = false;

function resetSearchArea() {
    _resettingSearchArea = true;

    closeMobileSearch();

    // 清理搜索结果
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchInput').value = '';

    // 恢复搜索区域的样式（恢复到初始状态：无flex-1、无mb-8）
    document.getElementById('searchArea').classList.remove('flex-1', 'mb-8');
    document.getElementById('resultsArea').classList.add('hidden');

    // 恢复居中布局 + 隐藏关闭按钮
    const homeLayout = document.querySelector('.home-layout');
    if (homeLayout) {
        homeLayout.classList.remove('has-results');
        void homeLayout.offsetHeight;
    }
    document.getElementById('closeSearchResults')?.classList.add('hidden');

    // 确保页脚正确显示，移除相对定位
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.style.position = '';
    }

    // 重置URL为主页（同时清除 hash）
    try {
        if (location.hash) {
            history.pushState(null, '', location.pathname + location.search);
        }
        window.history.pushState(
            {},
            `LeLeTV`,
            `/`
        );
        // 更新页面标题
        document.title = `LeLeTV`;
    } catch (e) {
        console.error('更新浏览器历史失败:', e);
    }

    // 清空源过滤标签和状态
    const filterTabs = document.getElementById('sourceFilterTabs');
    if (filterTabs) filterTabs.innerHTML = '';
    _activeSourceFilter = 'all';
    _lastAllResults = [];

    // 恢复后再统一隐藏搜索历史下拉
    _resettingSearchArea = false;
    hideSearchHistory();
}

function closeSearchResults() {
    resetSearchArea();
}

function hookInput() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // 重写 value 属性的 getter 和 setter
    Object.defineProperty(input, 'value', {
        get: function () {
            // 确保读取时返回字符串（即使原始值为 undefined/null）
            const originalValue = descriptor.get.call(this);
            return originalValue != null ? String(originalValue) : '';
        },
        set: function (value) {
            // 显式将值转换为字符串后写入
            const strValue = String(value);
            descriptor.set.call(this, strValue);
            this.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // 初始化输入框值为空字符串（避免初始值为 undefined）
    input.value = '';
}

// 清空搜索框（桌面 + 移动端）：搜索完成后调用，避免残留关键词
// 在下次打开搜索页或切换页面时被当作新搜索重复触发
function clearSearchInput() {
    const wasResetting = _resettingSearchArea;
    _resettingSearchArea = true; // 抑制 hookInput 派发的 input 事件唤起搜索历史下拉
    try {
        const input = document.getElementById('searchInput');
        if (input && input.value !== '') input.value = '';
        const mobileInput = document.getElementById('mobileSearchInput');
        if (mobileInput && mobileInput.value !== '') mobileInput.value = '';
    } finally {
        _resettingSearchArea = wasResetting;
    }
    if (!wasResetting) hideSearchHistory();
}

async function search() {
    // 关闭移动端覆盖层（如果有）
    closeMobileSearch();

    // 防重复搜索节流
    if (_searchThrottled) {
        showToast('请等待当前搜索完成', 'info');
        return;
    }
    _searchThrottled = true;
    hideSearchHistory();
    const releaseThrottle = () => { _searchThrottled = false; };
    // 强化的密码保护校验 - 防止绕过
    // 已通过邀请码验证的用户跳过密码检查
    const _isInviteVerified = window.INVITE_AUTH && window.INVITE_AUTH.isVerified();
    if (!_isInviteVerified) {
        // 未验证邀请码 - 搜索需要弹登录框，由角色逻辑控制
    }
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        showToast('请输入搜索内容', 'info');
        releaseThrottle();
        return;
    }

    if (selectedAPIs.length === 0) {
        showToast('请至少选择一个API源', 'warning');
        releaseThrottle();
        return;
    }

    // 用户主动发起的搜索：结果页返回去向固定为首页（清除类别入口残留上下文）
    if (typeof _moviesState !== 'undefined' && _moviesState) {
        _moviesState.from = 'home';
        _moviesState.fallbackGenres = [];
    }
    // 结果页可用时，搜索完成后统一路由到结果页（桌面/移动全设备统一入口）
    const routeToMovies = !!document.getElementById('page-movies');
    // 新搜索发起：递增结果页纪元，作废仍在途的旧类别入口加载（后发起者优先）
    let searchEpoch = 0;
    if (typeof _moviesEpoch !== 'undefined') {
        _moviesEpoch++;
        searchEpoch = _moviesEpoch;
    }

    // 清空结果区域，等待首个源返回后直接渲染真实结果
    const resultsDiv = document.getElementById('results');
    const resultsArea = document.getElementById('resultsArea');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }
    if (resultsArea && !routeToMovies) {
        resultsArea.classList.remove('hidden');
    }

    // 重置过滤状态
    _activeSourceFilter = 'all';
    _lastAllResults = [];

    // 初始渲染标签：基于 selectedAPIs，但过滤掉配置中已不存在的源
    _initFilterTabs();

    showLoading();

    try {
        // 保存搜索历史
        saveSearchHistory(query);

        // 从所有选中的API源搜索（渐进式渲染）
        let allResults = [];
        // 正常域过滤黑名单内容（"伦理片"等）；隐藏域不过滤——隐藏内容正是要看的内容
        const hiddenFilterEnabled = !isHiddenContentMode();

        // 显示结果区域，调整搜索区域（仅非结果页路由时生效，结果页由 #page-movies 承载）
        if (!routeToMovies) {
            document.getElementById('searchArea').classList.remove('flex-1');
            document.getElementById('searchArea').classList.add('mb-8');
            document.getElementById('resultsArea').classList.remove('hidden');
        }

        // 抬升布局 + 显示关闭按钮
        if (!routeToMovies) {
            document.querySelector('.home-layout')?.classList.add('has-results');
            document.getElementById('closeSearchResults')?.classList.remove('hidden');
            document.getElementById('closeSearchResults')?.classList.add('flex');
        }

        // 更新URL
        try {
            const encodedQuery = encodeURIComponent(query);
            window.history.pushState(
                { search: query },
                `搜索: ${query} - LeLeTV`,
                `/s=${encodedQuery}`
            );
            document.title = `搜索: ${query} - LeLeTV`;
        } catch (e) {}

        
        // 智能排序API源：快源优先，慢源后排
        let orderedApis = [...selectedAPIs];
        if (window.loadBalancer && typeof window.loadBalancer.getBestApi === 'function') {
            orderedApis.sort((a, b) => {
                const statA = window.loadBalancer.apiStats?.get(a);
                const statB = window.loadBalancer.apiStats?.get(b);
                const avgA = statA?.averageResponseTime || 9999;
                const avgB = statB?.averageResponseTime || 9999;
                return avgA - avgB; // 响应时间短的优先
            });
        }

        // 全局搜索截止时间（避免最慢的源拖累整体体验）
        const SEARCH_DEADLINE_MS = 12000;
        const searchStartTime = Date.now();

        // 构建搜索任务：排序后的API依次执行，结果立即追加
        var _gotFirstResult = false;
        const searchTasks = orderedApis.map(async (apiId) => {
            try {
                // 检查全局截止时间
                if (Date.now() - searchStartTime > SEARCH_DEADLINE_MS) return;

                if (window.loadBalancer && window.loadBalancer.isApiOverloaded(apiId)) {
                    return;
                }
                const results = await searchByAPIAndKeyWord(apiId, query);
                if (Date.now() - searchStartTime > SEARCH_DEADLINE_MS) return; // 超时后丢弃慢源结果
                if (!results || results.length === 0) return;

                let filtered = results;
                if (hiddenFilterEnabled) {
                    filtered = await applyFilter(results);
                }
                if (filtered.length === 0) return;

                allResults = allResults.concat(filtered);

                if (!routeToMovies) {
                    if (!_gotFirstResult) {
                        _gotFirstResult = true;
                        resultsDiv.innerHTML = _buildSearchCardsHtml(filtered);
                    } else {
                        resultsDiv.insertAdjacentHTML('beforeend', _buildSearchCardsHtml(filtered));
                    }
                }
                _updateAllTabCount(allResults.length);
            } catch (e) {
                console.warn(`API ${apiId} 搜索失败:`, e);
            }
        });

        if (!window.loadBalancer) {
            const fallbackResults = await performTraditionalSearch(query);
            if (fallbackResults.length > 0) {
                let filtered = fallbackResults;
                if (hiddenFilterEnabled) {
                    filtered = await applyFilter(fallbackResults);
                }
                allResults = filtered;
                if (!routeToMovies) {
                    resultsDiv.innerHTML = _buildSearchCardsHtml(filtered);
                }
                _updateAllTabCount(filtered.length);
            }
        } else {
            await Promise.allSettled(searchTasks);
        }

        // 期间有更新的搜索/类别入口发起，放弃本次迟到结果，避免覆盖新页面
        if (searchEpoch && typeof _moviesEpoch !== 'undefined' && searchEpoch !== _moviesEpoch) {
            hideLoading();
            return;
        }

        if (allResults.length > 0) {
            // 结果排序：本次搜索延迟快的源在前（与结果页共用同一套规则）
            allResults = _sortResultsByLatencyThenName(allResults);
            _lastAllResults = allResults;
            if (routeToMovies && typeof showMoviesResults === 'function') {
                // 统一进入结果页（左侧源列表 + 右侧结果）
                showMoviesResults(query, allResults, { from: 'home', fallbackGenres: [] });
            } else {
                _renderSourceFilterTabs(allResults.length);
                _applySourceFilter(_activeSourceFilter);
            }
        } else {
            if (routeToMovies && typeof showMoviesResults === 'function') {
                showMoviesResults(query, [], { from: 'home', fallbackGenres: [] });
            } else {
                resultsDiv.innerHTML = `
                    <div class="col-span-full text-center py-16">
                        <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
                        <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
                    </div>
                `;
                document.getElementById('sourceFilterTabs').innerHTML = '';
            }
            hideLoading();
        }

        // 搜索流程结束：清空搜索框，避免残留关键词在下次打开搜索页/切换页面时被重复搜索
        clearSearchInput();

    } catch (error) {
        console.error('搜索错误:', error);
        if (error.name === 'AbortError') {
            showToast('搜索请求超时，请检查网络连接', 'error');
        } else {
            showToast('搜索请求失败，请稍后重试', 'error');
        }
    } finally {
        hideLoading();
        // 释放节流锁（延迟释放，防止短暂连点）
        setTimeout(releaseThrottle, TIMING.SEARCH_THROTTLE_RELEASE);
    }
}

// 搜索结果提前退出策略（阈值定义在 config.js，与播放页换源共用）：
// 到达 CUTOFF_MS 时，若已有 >= MIN_SOURCES 个源返回了结果，就不再等待剩余源。
// 被放弃的源其 HTTP 请求仍会跑完并写入搜索缓存，下次搜索即可秒回，不会白费。
async function performTraditionalSearch(query) {
    let doneCount = 0;

    const searchPromises = selectedAPIs.map(apiId => new Promise(resolve => {
        let settled = false;
        let cutoffTimer = null;

        const finish = (value) => {
            if (settled) return;
            settled = true;
            if (cutoffTimer) clearTimeout(cutoffTimer);
            resolve(value);
        };

        // 到点检查：已有足够多的源返回结果时，放弃继续等待本源
        cutoffTimer = setTimeout(() => {
            if (doneCount >= SEARCH_EARLY_EXIT_MIN_SOURCES) finish([]);
        }, SEARCH_EARLY_EXIT_CUTOFF_MS);

        searchByAPIAndKeyWord(apiId, query)
            .then(results => { doneCount++; finish(results); })
            .catch(() => finish([]));
    }));

    // 等待所有搜索请求完成（或按上面的策略提前结束）
    const resultsArray = await Promise.all(searchPromises);
    
    let allResults = [];
    resultsArray.forEach(results => {
        if (Array.isArray(results) && results.length > 0) {
            allResults = allResults.concat(results);
        }
    });
    
    return allResults;
}
