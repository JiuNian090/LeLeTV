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

    // 移动端键盘适配：覆盖层跟随 visualViewport
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function () {
            const overlay = document.getElementById('mobileSearchOverlay');
            if (overlay && overlay.classList.contains('active')) {
                overlay.style.height = window.visualViewport.height + 'px';
                overlay.style.top = window.visualViewport.offsetTop + 'px';
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

    // 重置URL为主页
    try {
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

        
        // 构建搜索任务：每个API独立执行，结果立即追加
        const searchTasks = selectedAPIs.map(async (apiId) => {
            try {
                if (window.loadBalancer && window.loadBalancer.isApiOverloaded(apiId)) {
                    return;
                }
                const results = await searchByAPIAndKeyWord(apiId, query);
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
        setTimeout(releaseThrottle, 500);
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

function _buildSearchCardsHtml(items) {
    return items.map(item => {
        const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
        const safeName = (item.vod_name || '').toString()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const sourceInfo = item.source_name ?
            `<span class="source-label-tag">${item.source_name}</span>` : '';
        const sourceCode = item.source_code || '';
        const apiUrlAttr = item.api_url ?
            `data-api-url="${item.api_url.replace(/"/g, '&quot;')}"` : '';
        const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

        return `
            <div class="card-hover rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md" 
                 onclick="playDirectly('${safeId}','${safeName}','${sourceCode}')" ${apiUrlAttr}>
                <div class="flex h-full">
                    ${hasCover ? `
                    <div class="relative flex-shrink-0 search-card-img-container image-container">
                        <img src="${item.vod_pic}" alt="${safeName}" loading="lazy"
                             class="h-full w-full object-cover transition-transform hover:scale-110 loading-fade" 
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=无封面'; this.classList.add('object-contain');"
                             onload="this.classList.add('loaded')">
                        <div class="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent"></div>
                    </div>` : ''}
                    
                    <div class="p-3 flex flex-col flex-grow min-w-0">
                        <div class="flex-grow">
                            <h3 class="font-semibold mb-2 break-words line-clamp-2 ${hasCover ? '' : 'text-center'}" title="${safeName}">${safeName}</h3>
                            
                            <div class="flex flex-wrap ${hasCover ? '' : 'justify-center'} gap-1 mb-2">
                                ${(item.type_name || '').toString().replace(/</g, '&lt;') ?
                    `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                                      ${(item.type_name || '').toString().replace(/</g, '&lt;')}
                                  </span>` : ''}
                                ${(item.vod_year || '') ?
                    `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">
                                      ${item.vod_year}
                                  </span>` : ''}
                            </div>
                            <p class="text-gray-400 line-clamp-2 overflow-hidden ${hasCover ? '' : 'text-center'} mb-2">
                                ${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '&lt;')}
                            </p>
                        </div>
                        
                        <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
                            ${sourceInfo ? `<div>${sourceInfo}</div>` : '<div></div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function _chineseToNumber(str) {
    const chineseNums = {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '百': 100, '千': 1000
    };
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    let result = 0;
    let temp = 0;
    for (const char of str) {
        const num = chineseNums[char];
        if (num === undefined) continue;
        if (num >= 10) {
            result += (temp || 1) * num;
            temp = 0;
        } else {
            temp = num;
        }
    }
    return result + temp;
}

function _extractSeasonInfo(title) {
    const pattern = /第([一二三四五六七八九十百千\d]+)(季|部|集)/;
    const match = title.match(pattern);
    if (match) {
        const base = title.replace(pattern, '').replace(/\s+$/, '');
        return { base, season: _chineseToNumber(match[1]) };
    }
    const sPattern = /S(\d+)/i;
    const sMatch = title.match(sPattern);
    if (sMatch) {
        const base = title.replace(sPattern, '').replace(/\s+$/, '');
        return { base, season: parseInt(sMatch[1], 10) };
    }
    return { base: title, season: null };
}

function _getSourceLabel(apiId, results) {
    // 优先从结果中取实际返回的 source_name（来自搜索时实时读取的配置）
    if (results) {
        const match = results.find(r => r.source_code === apiId);
        if (match && match.source_name) return match.source_name;
    }
    if (apiId.startsWith('custom_')) {
        const idx = parseInt(apiId.replace('custom_', ''));
        const api = customAPIs[idx];
        return api ? api.name : `自定义源${idx + 1}`;
    }
    if (API_SITES[apiId]) return API_SITES[apiId].name;
    return apiId;
}

function _initFilterTabs() {
    const container = document.getElementById('sourceFilterTabs');
    if (!container) return;
    if (!selectedAPIs || selectedAPIs.length === 0) {
        container.innerHTML = '';
        return;
    }
    // 只保留当前配置中真实存在的源
    const validApis = selectedAPIs.filter(id => {
        if (id.startsWith('custom_')) {
            const idx = parseInt(id.replace('custom_', ''));
            return idx >= 0 && idx < customAPIs.length;
        }
        return !!API_SITES[id];
    });
    if (validApis.length === 0) {
        container.innerHTML = '';
        return;
    }
    let html = '<button class="source-filter-tab active" data-source="all">全部 (0)</button>';
    validApis.forEach(id => {
        const label = _getSourceLabel(id);
        html += `<button class="source-filter-tab" data-source="${id}">${label}</button>`;
    });
    container.innerHTML = html;
}

function _renderSourceFilterTabs(totalCount) {
    const container = document.getElementById('sourceFilterTabs');
    if (!container) return;
    if (!_lastAllResults || _lastAllResults.length === 0) {
        container.innerHTML = '';
        return;
    }
    const allCount = totalCount || _lastAllResults.length;

    // 从搜索结果中收集唯一的 source_code
    const seen = new Set();
    const uniqueSources = [];
    _lastAllResults.forEach(item => {
        const code = item.source_code;
        if (code && !seen.has(code)) {
            seen.add(code);
            uniqueSources.push(code);
        }
    });

    let html = `<button class="source-filter-tab active" data-source="all">全部 (${allCount})</button>`;
    uniqueSources.forEach(code => {
        const label = _getSourceLabel(code, _lastAllResults);
        const count = _lastAllResults.filter(r => r.source_code === code).length;
        html += `<button class="source-filter-tab" data-source="${code}">${label} (${count})</button>`;
    });
    container.innerHTML = html;
}

function _updateAllTabCount(count) {
    const allTab = document.querySelector('#sourceFilterTabs .source-filter-tab[data-source="all"]');
    if (allTab) {
        allTab.textContent = `全部 (${count})`;
    }
    // 同步更新各源标签计数
    const container = document.getElementById('sourceFilterTabs');
    if (!container || !_lastAllResults) return;
    container.querySelectorAll('.source-filter-tab:not([data-source="all"])').forEach(tab => {
        const code = tab.dataset.source;
        const count = _lastAllResults.filter(r => r.source_code === code).length;
        const label = _getSourceLabel(code, _lastAllResults);
        tab.textContent = `${label} (${count})`;
    });
}

function _applySourceFilter(sourceFilter) {
    _activeSourceFilter = sourceFilter;

    // 更新标签激活状态
    document.querySelectorAll('#sourceFilterTabs .source-filter-tab').forEach(tab => {
        const isActive = tab.dataset.source === sourceFilter;
        tab.classList.toggle('active', isActive);
    });

    // 过滤结果
    let filteredResults = _lastAllResults;
    if (sourceFilter !== 'all') {
        filteredResults = _lastAllResults.filter(item => item.source_code === sourceFilter);
    }

    // 重绘
    document.getElementById('results').innerHTML = _buildSearchCardsHtml(filteredResults);

    // 卡片交错入场
    animateCardEntrance();

    // 重置滚动位置到结果区域顶部
    const resultsArea = document.getElementById('resultsArea');
    if (resultsArea) {
        resultsArea.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
}

function animateCardEntrance() {
    const cards = document.querySelectorAll('#results .card-hover');
    cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, i * 50);
    });
}

function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}

function generateSkeletonCards(count = 8) {
    const cols = window.innerWidth < 640 ? 1 : window.innerWidth < 768 ? 2 : window.innerWidth < 1024 ? 3 : 4;
    const cards = [];
    for (let i = 0; i < Math.max(count, cols * 2); i++) {
        cards.push(`
            <div class="skeleton-card">
                <div class="skeleton-card-img"></div>
                <div class="skeleton-card-body">
                    <div class="skeleton-line" style="width: 85%"></div>
                    <div class="skeleton-line" style="width: 55%"></div>
                    <div class="skeleton-tags">
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                    </div>
                    <div class="skeleton-line-sm" style="margin-top: auto;"></div>
                    <div class="skeleton-line-xs"></div>
                </div>
            </div>
        `);
    }
    return cards.join('');
}