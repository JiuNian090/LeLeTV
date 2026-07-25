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

    // 搜索历史下拉：输入时过滤
    searchInput.addEventListener('input', function () {
        if (!_searchReady) return;
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
                    deleteSingleSearchHistory(query);
                    showSearchHistory(document.getElementById('searchInput').value);
                }
                return;
            }

            if (clearBtn) {
                e.stopPropagation();
                clearSearchHistory();
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
                    deleteSingleSearchHistory(query);
                    renderMobileSearchHistory(mobileSearchInput ? mobileSearchInput.value : '');
                }
                return;
            }

            if (clearBtn) {
                e.stopPropagation();
                clearSearchHistory();
                renderMobileSearchHistory('');
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

    // 隐藏内容过滤开关事件绑定
    const hiddenFilterToggle = document.getElementById('hiddenFilterToggle');
    if (hiddenFilterToggle) {
        hiddenFilterToggle.addEventListener('change', async function (e) {
            // 如果是尝试关闭过滤器（即显示隐藏内容），需要验证管理员密码
            if (!e.target.checked) {
                const isAdminVerified = await verifyAdminPassword();
                if (!isAdminVerified) {
                    // 如果验证失败，恢复开关状态并显示提示
                    e.target.checked = true;
                    showToast('需要管理员密码才能关闭隐藏内容过滤，密码提示:⟲', 'warning');
                    return;
                }
            }

            // 验证通过或开启过滤器，执行原有逻辑
            localStorage.setItem('hiddenFilterEnabled', e.target.checked);

            // 控制隐藏内容接口的显示状态
            const hiddendiv = document.getElementById('hiddendiv');
            if (e.target.checked === true) {
                // 如果启用过滤，则隐藏隐藏内容API
                if (hiddendiv) {
                    hiddendiv.style.display = 'none';
                }
            } else if (e.target.checked === false) {
                // 如果禁用过滤，刷新并显示隐藏内容API列表
                // 先移除已有的隐藏API区域
                if (hiddendiv) {
                    hiddendiv.remove();
                }
                // 重新创建隐藏API列表，确保所有隐藏API都显示出来
                addHiddenAPI();
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
            case 'search': search(); break;
            case 'close-modal': closeModal(); break;
            case 'open-disclaimer': openDisclaimerModal(); break;
            case 'hide-password-modal': hidePasswordModal(); break;
            case 'accept-disclaimer': closeDisclaimerModal(); break;
            case 'select-all-apis': selectAllAPIs(true, true); break;
            case 'deselect-all-apis': selectAllAPIs(false); break;
            case 'reset-apis': resetDataSourceLogic(); break;
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
                if (id && name && source) playDirectly(id, name, source);
                break;
            }
            case 'edit-custom-api': editCustomApi(parseInt(el.dataset.index)); break;
            case 'remove-custom-api': removeCustomApi(parseInt(el.dataset.index)); break;
            case 'update-custom-api': updateCustomApi(parseInt(el.dataset.index)); break;
            case 'cancel-edit-custom-api': cancelEditCustomApi(); break;
            case 'load-tmdb-results': loadTmdbResults(); break;
            case 'tmdb-search-video': tmdbSearchVideo(el.dataset.title); break;
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
                    deleteHistoryItem(itemUrl, itemTitle);
                }
                break;
            }
            case 'import-config-from-url': importConfigFromUrl(); break;
            case 'switch-to-category': switchPage('category'); break;
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

function resetSearchArea() {
    // 关闭移动端覆盖层和搜索历史下拉
    closeMobileSearch();
    hideSearchHistory();

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
            `LeLeTV - 乐乐影视`,
            `/`
        );
        // 更新页面标题
        document.title = `LeLeTV - 乐乐影视`;
    } catch (e) {
        console.error('更新浏览器历史失败:', e);
    }

    // 清空源过滤标签和状态
    const filterTabs = document.getElementById('sourceFilterTabs');
    if (filterTabs) filterTabs.innerHTML = '';
    _activeSourceFilter = 'all';
    _lastAllResults = [];
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
        try {
            if (window.ensurePasswordProtection) {
                window.ensurePasswordProtection();
            } else {
                // 兼容性检查
                if (window.isPasswordProtected && window.isPasswordVerified) {
                    if (window.isPasswordProtected() && !window.isPasswordVerified()) {
                        showPasswordModal && showPasswordModal();
                        releaseThrottle();
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('Password protection check failed:', error.message);
            releaseThrottle();
            return;
        }
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

    // 在搜索前加入骨架屏
    const resultsDiv = document.getElementById('results');
    const resultsArea = document.getElementById('resultsArea');
    if (resultsDiv) {
        resultsDiv.innerHTML = generateSkeletonCards();
    }
    if (resultsArea) {
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
        const hiddenFilterEnabled = localStorage.getItem('hiddenFilterEnabled') === 'true';

        // 显示结果区域，调整搜索区域
        document.getElementById('searchArea').classList.remove('flex-1');
        document.getElementById('searchArea').classList.add('mb-8');
        document.getElementById('resultsArea').classList.remove('hidden');

        // 抬升布局 + 显示关闭按钮
        document.querySelector('.home-layout')?.classList.add('has-results');
        document.getElementById('closeSearchResults')?.classList.remove('hidden');
        document.getElementById('closeSearchResults')?.classList.add('flex');

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

                resultsDiv.insertAdjacentHTML('beforeend', _buildSearchCardsHtml(filtered));
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
                resultsDiv.innerHTML = _buildSearchCardsHtml(filtered);
                _updateAllTabCount(filtered.length);
            }
        } else {
            await Promise.allSettled(searchTasks);
        }

        if (allResults.length > 0) {
            allResults.sort((a, b) => {
                const nameA = a.vod_name || '';
                const nameB = b.vod_name || '';
                const { base: baseA, season: seasonA } = _extractSeasonInfo(nameA);
                const { base: baseB, season: seasonB } = _extractSeasonInfo(nameB);
                const baseCompare = baseA.localeCompare(baseB, 'zh-CN');
                if (baseCompare !== 0) return baseCompare;
                if (seasonA !== null && seasonB !== null) return seasonA - seasonB;
                if (seasonA !== null) return -1;
                if (seasonB !== null) return 1;
                return (a.source_name || '').localeCompare(b.source_name || '', 'zh-CN');
            });
            _lastAllResults = allResults;
            _renderSourceFilterTabs(allResults.length);
            _applySourceFilter(_activeSourceFilter);
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
            hideLoading();
            return;
        }

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

async function performTraditionalSearch(query) {
    const searchPromises = selectedAPIs.map(apiId => 
        searchByAPIAndKeyWord(apiId, query)
    );
    
    // 等待所有搜索请求完成
    const resultsArray = await Promise.all(searchPromises);
    
    let allResults = [];
    resultsArray.forEach(results => {
        if (Array.isArray(results) && results.length > 0) {
            allResults = allResults.concat(results);
        }
    });
    
    return allResults;
}
