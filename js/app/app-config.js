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
                    for (let item in config.data) localStorage.setItem(item, config.data[item]);
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
    input.value = document.getElementById('searchInput').value;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderMobileSearchHistory(input.value);
    setTimeout(function () { input.focus(); }, 100);
}

function closeMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}