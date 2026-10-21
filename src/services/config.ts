// ===== 主题色存储键 =====
// 主题色两个数据域各存一套，键名本身已带模式，因此不能套 scopedKey 的 hidden:: 前缀。
// 键名的唯一来源是 js/ui/theme-system.js 暴露的 LeLeThemeStore，这里只是兜底

// 阶段 5B-3：显式 import core 的键名解析与哈希。
import { scopedKey, SEARCH_HISTORY_KEY, HIDDEN_MODE_KEY } from '../core/config';
import { sha256 } from '../core/crypto';

interface JSZipInstance {
    file(name: string): { async(type: 'string'): Promise<string> } | null;
    file(name: string, content: string): void;
    generateAsync(options: {
        type: string;
        compression: string;
        compressionOptions: { level: number };
    }): Promise<Blob>;
}

interface JSZipStatic {
    new (): JSZipInstance;
    loadAsync(file: Blob): Promise<JSZipInstance>;
}

type AppConfigWindow = Window & {
    LeLeThemeStore?: { KEYS?: string[]; isKey?: (key: string) => boolean };
    JSZip?: JSZipStatic;
    __LELETV_VERSION__?: string;
};

function themeStoreKeys() {
    const store = (window as AppConfigWindow).LeLeThemeStore;
    return (store && store.KEYS) || ['leletv_theme_normal', 'leletv_theme_hidden'];
}

function isThemeStoreKey(key) {
    const store = (window as AppConfigWindow).LeLeThemeStore;
    if (store && store.isKey) return store.isKey(key);
    return themeStoreKeys().indexOf(key) !== -1;
}

// 配置项名 → localStorage 键：主题色用原键名，其余按当前数据域加 scoped 前缀
function itemStorageKey(item) {
    return isThemeStoreKey(item) ? item : scopedKey(item);
}

// ===== JSZip 按需加载（阶段 3：移出首屏关键路径，仅导入/导出配置时加载） =====
let _jszipPromise: Promise<JSZipStatic> | null = null;

function loadJSZip(): Promise<JSZipStatic> {
    const existing = (window as AppConfigWindow).JSZip;
    if (existing) return Promise.resolve(existing);
    if (_jszipPromise) return _jszipPromise;

    _jszipPromise = new Promise<JSZipStatic>(function (resolve, reject) {
        var script = document.createElement('script');
        var version = (window as AppConfigWindow).__LELETV_VERSION__ || '';
        script.src = 'libs/jszip.min.js' + (version ? '?v=' + encodeURIComponent(version) : '');
        script.onload = function () { resolve((window as AppConfigWindow).JSZip as JSZipStatic); };
        script.onerror = function () {
            _jszipPromise = null;
            reject(new Error('JSZip 加载失败'));
        };
        document.head.appendChild(script);
    });

    return _jszipPromise;
}

export async function importConfigFromUrl() {
    showModal({
        title: '从链接导入配置',
        content: (body, overlay) => {
            body.innerHTML = `
                <div class="v2-field">
                    <label class="v2-label" for="configUrl">配置文件地址</label>
                    <input type="url" id="configUrl" class="v2-input" placeholder="https://example.com/leletv-backup.zip" autocomplete="off" spellcheck="false">
                </div>
                <div class="v2-dialog-foot is-end">
                    <button type="button" id="cancelUrlImport" class="v2-btn v2-btn--secondary">取消</button>
                    <button type="button" id="confirmUrlImport" class="v2-btn v2-btn--primary">导入</button>
                </div>
            `;
            overlay.querySelector('#confirmUrlImport').addEventListener('click', async () => {
                const url = (document.getElementById('configUrl') as HTMLInputElement).value.trim();
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
                    const response = await fetch(url, { mode: 'cors' });
                    if (!response.ok) throw '获取配置文件失败';
                    const blob = await response.blob();
                    await processBackupFile(blob);
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

export async function importConfig() {
    // services 不能 import ui：导入框由 ui/index.ts 挂在 window 上（跨层契约）
    const showImportBox = (window as Window & {
        showImportBox?: (onSelect: (file: File) => void) => void;
    }).showImportBox;
    if (typeof showImportBox !== 'function') return;
    showImportBox(async (file) => {
        try {
            if (file.size > 1024 * 1024 * 20) throw new Error('文件大小超过 20MB');
            showLoading('正在解析配置文件...');
            await processBackupFile(file);
            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => window.location.reload(), 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '配置文件格式错误';
            showToast(`配置文件读取出错 (${message})`, 'error');
        } finally {
            hideLoading();
        }
    });
}

/**
 * 解析备份文件（ZIP 或旧版 JSON），校验后写入 localStorage
 */
async function processBackupFile(file) {
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';

    let settingsData = null;
    let userData = null;

    if (isZip) {
        // 新版：ZIP 包内含 settings.json + data.json
        const JSZipLib = await loadJSZip();
        const zip = await JSZipLib.loadAsync(file);
        const settingsFile = zip.file('settings.json');
        const dataFile = zip.file('data.json');
        if (!settingsFile) throw 'ZIP 包内缺少 settings.json';
        settingsData = JSON.parse(await settingsFile.async('string'));
        if (dataFile) {
            userData = JSON.parse(await dataFile.async('string'));
        }
    } else {
        // 兼容旧版：单个 JSON 文件
        const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject('文件读取失败');
            reader.readAsText(file);
        });
        const oldConfig = JSON.parse(content) as { name: string; data: unknown; hash?: string };
        if (oldConfig.name !== 'LeLeTV-Settings') throw '配置文件格式不正确';
        const dataHash = await sha256(JSON.stringify(oldConfig.data));
        if (dataHash !== oldConfig.hash) throw '配置文件哈希值不匹配';
        // 旧版全部当作 settings 恢复
        settingsData = { data: oldConfig.data };
    }

    // 校验 settings
    if (!settingsData || !settingsData.data) throw '设置文件格式不正确';

    // 写入设置（hiddenContentMode 不参与恢复）
    for (let item in settingsData.data) {
        if (item === HIDDEN_MODE_KEY) continue;
        localStorage.setItem(itemStorageKey(item), settingsData.data[item]);
    }

    // 写入用户数据（历史记录、搜索记录）
    if (userData && userData.data) {
        for (let item in userData.data) {
            localStorage.setItem(scopedKey(item), userData.data[item]);
        }
    }
}

export async function exportConfig() {
    const times = Date.now().toString();

    // ===== 设置数据：主题、数据源、开关等 =====
    const settingsItems = {};
    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'hiddenContentMode',
        'adFilteringEnabled',
        'hasInitializedDefaults',
        'tmdbFilters'
    ];
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(scopedKey(key));
        if (value !== null) settingsItems[key] = value;
    });
    // 主题色（键名自带模式，不套 scoped 前缀）
    themeStoreKeys().forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) settingsItems[key] = value;
    });

    const settingsJson: {
        name: string;
        version: string;
        time: string;
        data: unknown;
        hash?: string;
    } = {
        name: 'LeLeTV-Settings',
        version: '2.0',
        time: times,
        data: settingsItems
    };
    settingsJson.hash = await sha256(JSON.stringify(settingsItems));

    // ===== 用户数据：历史记录、搜索记录等 =====
    const dataItems = {};
    const viewingHistory = localStorage.getItem(scopedKey('viewingHistory'));
    if (viewingHistory) dataItems['viewingHistory'] = viewingHistory;

    const searchHistory = localStorage.getItem(scopedKey(SEARCH_HISTORY_KEY));
    if (searchHistory) dataItems[SEARCH_HISTORY_KEY] = searchHistory;

    const dataJson = {
        name: 'LeLeTV-UserData',
        version: '2.0',
        time: times,
        data: dataItems
    };

    // ===== 打包 ZIP =====
    const JSZipLib = await loadJSZip();
    const zip = new JSZipLib();
    zip.file('settings.json', JSON.stringify(settingsJson, null, 2));
    zip.file('data.json', JSON.stringify(dataJson, null, 2));
    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    saveBlobAsFile(blob, 'LeLeTV-Backup_' + times + '.zip');
}

export function saveBlobAsFile(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

export function openMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    const input = document.getElementById('mobileSearchInput') as HTMLInputElement | null;
    if (!overlay || !input) return;
    // 先 blur 桌面搜索框，防止键盘干扰
    (document.getElementById('searchInput') as HTMLInputElement | null)?.blur();
    // 同步已有输入文本
    input.value = (document.getElementById('searchInput') as HTMLInputElement).value;
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

export function closeMobileSearch() {
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

// 阶段 5A-4 过渡期兼容桥：app bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  importConfigFromUrl,
  importConfig,
  exportConfig,
  saveBlobAsFile,
  openMobileSearch,
  closeMobileSearch
});

// 阶段 5B-3 过渡期类型桥：services/config.ts 已成为 ESM 模块，尚未改为 import 的
// 调用方仍以裸名访问。
declare global {
  function importConfigFromUrl(): Promise<void>;
  function importConfig(): Promise<void>;
  function exportConfig(): Promise<void>;
  function saveBlobAsFile(blob: Blob, fileName: string): void;
  function openMobileSearch(): void;
  function closeMobileSearch(): void;
}
