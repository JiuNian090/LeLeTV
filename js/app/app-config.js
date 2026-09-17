// ===== 主题色存储键 =====
// 主题色两个数据域各存一套，键名本身已带模式，因此不能套 scopedKey 的 hidden:: 前缀。
// 键名的唯一来源是 js/ui/theme-system.js 暴露的 LeLeThemeStore，这里只是兜底
function themeStoreKeys() {
    const store = window.LeLeThemeStore;
    return (store && store.KEYS) || ['leletv_theme_normal', 'leletv_theme_hidden'];
}

function isThemeStoreKey(key) {
    const store = window.LeLeThemeStore;
    if (store && store.isKey) return store.isKey(key);
    return themeStoreKeys().indexOf(key) !== -1;
}

// 配置项名 → localStorage 键：主题色用原键名，其余按当前数据域加 scoped 前缀
function itemStorageKey(item) {
    return isThemeStoreKey(item) ? item : scopedKey(item);
}

async function importConfigFromUrl() {
    showModal({
        title: '从URL导入配置',
        content: (body, overlay) => {
            body.innerHTML = `
                <div class="mb-4">
                    <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                           class="w-full px-3 py-2 bg-[#222] border border-[var(--color-border-default)] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                </div>
                <div class="flex justify-end space-x-2">
                    <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                    <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
                </div>
            `;
            overlay.querySelector('#confirmUrlImport').addEventListener('click', async () => {
                const url = document.getElementById('configUrl').value.trim();
                if (!url) { showToast('请输入配置文件URL', 'warning'); return; }
                try {
                    const urlObj = new URL(url);
                    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                        showToast('URL必须以http://或https://开头', 'warning');
                        return;
                    }
                } catch (e) { showToast('URL格式不正确', 'warning'); return; }

                showLoading('正在从URL导入配置...');
                try {
                    const response = await fetch(url, { mode: 'cors', headers: { 'Accept': 'application/json' } });
                    if (!response.ok) throw '获取配置文件失败';
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) throw '响应不是有效的JSON格式';
                    const config = await response.json();
                    if (config.name !== 'LeLeTV-Settings') throw '配置文件格式不正确';
                    const dataHash = await sha256(JSON.stringify(config.data));
                    if (dataHash !== config.hash) throw '配置文件哈希值不匹配';
                    // hiddenContentMode 不参与恢复：隐藏模式只能由开关 + 密码进入
                    for (let item in config.data) {
                        if (item === HIDDEN_MODE_KEY) continue;
                        localStorage.setItem(itemStorageKey(item), config.data[item]);
                    }
                    showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
                    setTimeout(() => window.location.reload(), 3000);
                } catch (error) {
                    const message = typeof error === 'string' ? error : '导入配置失败';
                    showToast(`从URL导入配置出错 (${message})`, 'error');
                } finally {
                    hideLoading();
                    overlay.remove();
                }
            });
            overlay.querySelector('#cancelUrlImport').addEventListener('click', () => overlay.remove());
        }
    });
}

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

            // 导入配置（hiddenContentMode 不参与恢复：隐藏模式只能由开关 + 密码进入）
            for (let item in config.data) {
                if (item === HIDDEN_MODE_KEY) continue;
                localStorage.setItem(itemStorageKey(item), config.data[item]);
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

async function exportConfig() {
    // 存储配置数据
    const config = {};
    const items = {};

    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'hiddenContentMode',
        'adFilteringEnabled',
        'hasInitializedDefaults',
        'tmdbFilters'   // 分类页标签选择（下次进入分类页沿用）
    ];

    // 导出设置项（scoped 键按当前数据域读取，隐藏域导出的是 hidden:: 版本）
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(scopedKey(key));
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出主题色：两个数据域各存一套，键名自带模式，直接按原键名读取
    themeStoreKeys().forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出历史记录
    const viewingHistory = localStorage.getItem(scopedKey('viewingHistory'));
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }

    const searchHistory = localStorage.getItem(scopedKey(SEARCH_HISTORY_KEY));
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

function openMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    const input = document.getElementById('mobileSearchInput');
    if (!overlay || !input) return;
    // 先 blur 桌面搜索框，防止键盘干扰
    document.getElementById('searchInput')?.blur();
    // 同步已有输入文本
    input.value = document.getElementById('searchInput').value;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    // 移除之前可能残留的 visualViewport 内联样式，让 CSS dvh 接管
    overlay.style.height = '';
    overlay.style.top = '';
    renderMobileSearchHistory(input.value);
    // 打开时同步一次清空按钮的显隐（可能带着桌面搜索框里的文字进来的）
    document.getElementById('clearMobileSearchInput')?.classList.toggle('is-visible', !!input.value);
    // 聚焦移动端输入框（聚焦前确保覆盖层已激活）
    input.focus();
}

function closeMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (!overlay) return;
    // blur 输入框以收起键盘
    document.getElementById('mobileSearchInput')?.blur();
    overlay.classList.remove('active');
    // 清除 visualViewport 内联样式，防止残留
    overlay.style.height = '';
    overlay.style.top = '';
    document.body.style.overflow = '';
}