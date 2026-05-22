// 全局变量（在 api-config.js 中初始化）
var selectedAPIs = window.selectedAPIs;
var customAPIs = window.customAPIs;

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = '';
// 全局变量用于倒序状态
let episodesReversed = false;

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    // 设置默认API选择（必须在 initAPICheckboxes 之前，否则复选框不同步）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        selectedAPIs = ["tyyszy", "bfzy", "dyttzy", "wolong"];
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
        localStorage.setItem('hiddenFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');
        localStorage.setItem('hasInitializedDefaults', 'true');
        localStorage.setItem('dataSourceLogicVersion', 'v1');
    }

    // 初始化API复选框
    initAPICheckboxes();

    // 初始化自定义API列表
    renderCustomAPIsList();

    // 初始化显示选中的API数量
    updateSelectedApiCount();

    // 渲染搜索历史
    renderSearchHistory();

    // 设置隐藏内容过滤器开关初始状态
    const hiddenFilterToggle = document.getElementById('hiddenFilterToggle');
    if (hiddenFilterToggle) {
        hiddenFilterToggle.checked = localStorage.getItem('hiddenFilterEnabled') === 'true';
    }

    // 设置广告过滤开关初始状态
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        // 默认打开分片广告过滤功能
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true
    }

    // 设置事件监听器
    setupEventListeners();

    // 初始检查隐藏API选中状态
    setTimeout(checkHiddenAPIsSelected, 100);
});

// 设置事件监听器
function setupEventListeners() {
    // 回车搜索
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            search();
        }
    });
    
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
}

// 重置搜索区域
function resetSearchArea() {
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
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}

// ========== 骨架屏辅助 ==========
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

// 搜索功能节流锁
let _searchThrottled = false;

// 搜索功能 - 修改为支持多选API和多页结果
async function search() {
    // 防重复搜索节流
    if (_searchThrottled) {
        showToast('请等待当前搜索完成', 'info');
        return;
    }
    _searchThrottled = true;
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

        const searchCountEl = document.getElementById('searchResultsCount');

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
                    const banned = ['伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑', '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码', '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频', '福利片'];
                    filtered = results.filter(item => {
                        const typeName = item.type_name || '';
                        return !banned.some(keyword => typeName.includes(keyword));
                    });
                }
                if (filtered.length === 0) return;

                allResults = allResults.concat(filtered);

                resultsDiv.insertAdjacentHTML('beforeend', _buildSearchCardsHtml(filtered));
                if (searchCountEl) searchCountEl.textContent = allResults.length;
            } catch (e) {
                console.warn(`API ${apiId} 搜索失败:`, e);
            }
        });

        if (!window.loadBalancer) {
            const fallbackResults = await performTraditionalSearch(query);
            if (fallbackResults.length > 0) {
                let filtered = fallbackResults;
                if (hiddenFilterEnabled) {
                    const banned = ['伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑', '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码', '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频', '福利片'];
                    filtered = fallbackResults.filter(item => {
                        const typeName = item.type_name || '';
                        return !banned.some(keyword => typeName.includes(keyword));
                    });
                }
                allResults = filtered;
                resultsDiv.innerHTML = _buildSearchCardsHtml(filtered);
                if (searchCountEl) searchCountEl.textContent = filtered.length;
            }
        } else {
            await Promise.allSettled(searchTasks);
        }

        if (allResults.length > 0) {
            allResults.sort((a, b) => {
                const nameCompare = (a.vod_name || '').localeCompare(b.vod_name || '');
                if (nameCompare !== 0) return nameCompare;
                return (a.source_name || '').localeCompare(b.source_name || '');
            });
            resultsDiv.innerHTML = _buildSearchCardsHtml(allResults);
            if (searchCountEl) searchCountEl.textContent = allResults.length;
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

// 生成搜索卡片HTML（带XSS保护）
function _buildSearchCardsHtml(items) {
    return items.map(item => {
        const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
        const safeName = (item.vod_name || '').toString()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const sourceInfo = item.source_name ?
            `<span class="bg-[#222] text-xs px-1.5 py-0.5 rounded-full">${item.source_name}</span>` : '';
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
                    
                    <div class="p-2 flex flex-col flex-grow">
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

// 设置邮箱点击事件处理器
function setupEmailClickHandlers() {
    const contactElements = [
        document.getElementById('contactLeLe'),
        document.getElementById('contactLeLe2'),
        document.getElementById('contactLeLe3'),
        document.getElementById('contactLeLe4'),
        document.getElementById('contactLeLe5'),
        document.getElementById('contactLeLe6'),
        document.getElementById('contactLeLe7')
    ];
    contactElements.forEach(element => {
        if (element) {
            element.addEventListener('click', function() {
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
        }
    });
}

// 切换清空按钮的显示状态
function toggleClearButton() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearchInput');
    if (searchInput.value !== '') {
        clearButton.classList.remove('hidden');
    } else {
        clearButton.classList.add('hidden');
    }
}

// 清空搜索框内容
function clearSearchInput() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    toggleClearButton();
}

// 关闭搜索结果，恢复居中布局
function closeSearchResults() {
    resetSearchArea();
}

// 劫持搜索框的value属性以检测外部修改
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
document.addEventListener('DOMContentLoaded', hookInput);

// 从URL导入配置
async function importConfigFromUrl() {
    // 创建模态框元素
    let modal = document.getElementById('importUrlModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    modal = document.createElement('div');
    modal.id = 'importUrlModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeUrlModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold mb-4">从URL导入配置</h3>
            
            <div class="mb-4">
                <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                       class="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-2">
                <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
            </div>
        </div`;

    document.body.appendChild(modal);

    // 关闭按钮事件
    document.getElementById('closeUrlModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 取消按钮事件
    document.getElementById('cancelUrlImport').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 确认导入按钮事件
    document.getElementById('confirmUrlImport').addEventListener('click', async () => {
        const url = document.getElementById('configUrl').value.trim();
        if (!url) {
            showToast('请输入配置文件URL', 'warning');
            return;
        }

        // 验证URL格式
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                showToast('URL必须以http://或https://开头', 'warning');
                return;
            }
        } catch (e) {
            showToast('URL格式不正确', 'warning');
            return;
        }

        showLoading('正在从URL导入配置...');

        try {
            // 获取配置文件 - 直接请求URL
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) throw '获取配置文件失败';

            // 验证响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw '响应不是有效的JSON格式';
            }

            const config = await response.json();
            if (config.name !== 'LeLeTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '导入配置失败';
            showToast(`从URL导入配置出错 (${message})`, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(modal);
        }
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 配置文件导入功能
async function importConfig() {
    showImportBox(async (file) => {
        try {
            // 检查文件类型
            if (!(file.type === 'application/json' || file.name.endsWith('.json'))) throw '文件类型不正确';

            // 检查文件大小
            if (file.size > 1024 * 1024 * 10) throw new Error('文件大小超过 10MB');

            // 读取文件内容
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('文件读取失败');
                reader.readAsText(file);
            });

            // 解析并验证配置
            const config = JSON.parse(content);
            if (config.name !== 'LeLeTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '配置文件格式错误';
            showToast(`配置文件读取出错 (${message})`, 'error');
        }
    });
}

// 配置文件导出功能
async function exportConfig() {
    // 存储配置数据
    const config = {};
    const items = {};

    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'hiddenFilterEnabled',
        'adFilteringEnabled',
        'hasInitializedDefaults'
    ];

    // 导出设置项
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出历史记录
    const viewingHistory = localStorage.getItem('viewingHistory');
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }

    const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (searchHistory) {
        items[SEARCH_HISTORY_KEY] = searchHistory;
    }

    const times = Date.now().toString();
    config['name'] = 'LeLeTV-Settings';  // 配置文件名，用于校验
    config['time'] = times;               // 配置文件生成时间
    config['cfgVer'] = '1.0.0';           // 配置文件版本
    config['data'] = items;               // 配置文件数据
    config['hash'] = await sha256(JSON.stringify(config['data']));  // 计算数据的哈希值，用于校验

    // 将配置数据保存为 JSON 文件
    saveStringAsFile(JSON.stringify(config), 'LeLeTV-Settings_' + times + '.json');
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
    // 创建Blob对象并指定类型
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // 生成临时URL
    const url = window.URL.createObjectURL(blob);
    // 创建<a>标签并触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // 清理临时对象
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// 传统搜索方式（作为降级选项）
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
