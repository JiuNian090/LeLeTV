import { API_SITES, isHiddenContentMode } from '../../core/config';
import { customAPIs } from '../../core/state';
import type { CustomApiEntry } from '../../core/state';
import { initAPICheckboxes, updateSelectedApiCount } from './config';
import { saveImportedSources, applyImportedSourcesToAPISites } from './imported';
import { saveBlobAsFile } from '../config';

/**
 * 视频源导入 / 导出（LibreTV 互操作层）
 *
 * 内部存储：云端 / 导入源在 API_SITES（Worker 下发与本地导入合并），
 * 只有用户手动添加的源在 customAPIs。
 * 仅在跨平台迁移时转换为 LibreTV-SourceList v2：
 *   {
 *     "name": "LeLeTV-SourceList",
 *     "version": 2,
 *     "exportedAt": 1750000000000,
 *     "sources": [{ "name": "...", "url": "...", "detail": "...", "isAdult": false }],
 *     "liveSources": []
 *   }
 *
 * 导入兼容：
 *   1. LibreTV-SourceList（对象 sources 数组 / 裸数组）
 *   2. TVBOX 配置 { sites: [...] }（只取 type=1 的 Apple CMS 直连源）
 *   3. 旧版键值映射 { api_site: { key: { api, name } } } / { apiSites } / { API_SITES } / 直接映射
 *
 * 导入只写入当前数据域（正常 / 私密），与内置源或已有自定义源 URL 相同时仅启用，不重复创建。
 */

interface SourceEntry {
    key?: string;
    name: string;
    url: string;
    detail?: string;
    isAdult?: boolean;
    hidden?: boolean;
}

interface RawSourceLike {
    key?: unknown;
    name?: unknown;
    url?: unknown;
    api?: unknown;
    detail?: unknown;
    detailUrl?: unknown;
    isAdult?: unknown;
    hidden?: unknown;
    enabled?: unknown;
    type?: unknown;
}

interface SourceListStats {
    total: number;
    invalid: number;
    duplicates: number;
    truncated: number;
}

interface ParsedSourceList {
    sources: SourceEntry[];
    stats: SourceListStats;
}

interface SourceImportModalOptions {
    title?: string;
    content?: (body: HTMLElement, modal: HTMLElement) => void;
}

interface SourceImportWindow extends Window {
    __ENV__?: { HIDDENKEY?: string; TMDB_WORKER_URL?: string };
}

declare function showModal(options: SourceImportModalOptions): HTMLElement;
declare function showSourceImportBox(onSelect: (file: File) => void, onUrl?: (url: string) => void): void;

const SOURCE_LIST_NAME = 'LeLeTV-SourceList';
const SOURCE_LIST_VERSION = 2;
const SOURCE_IMPORT_LIMIT = 100;
const SOURCE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

/** 去掉首尾空白与尾部斜杠，用于 URL 去重 */
function sourceUrlKey(value: unknown): string {
    return String(value || '').trim().replace(/\/+$/, '');
}

/** 只接受合法的 http(s) 地址；无效时返回空串 */
function normalizeSourceUrl(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return '';
    try {
        new URL(trimmed);
    } catch (e) {
        return '';
    }
    return trimmed.replace(/\/+$/, '');
}

function sourceHostname(url: string): string {
    try {
        return new URL(url).hostname || url;
    } catch (e) {
        return url;
    }
}

/** 当前数据域的自定义源；导入时直接修改该数组，保持全局引用有效 */
function currentDomainCustomAPIs(): CustomApiEntry[] {
    if (typeof customAPIs !== 'undefined' && Array.isArray(customAPIs)) return customAPIs;
    return [];
}

/** 当前数据域是否可见该源：私密模式只看 hidden，正常模式只看非 hidden */
function sourceVisibleInDomain(site: { hidden?: boolean; isHidden?: boolean }, hiddenMode: boolean): boolean {
    return hiddenMode ? !!site.hidden : !site.hidden;
}

/**
 * 收集当前数据域的全部源（内置 + 自定义），按 URL 去重，内置优先。
 * @returns {Array<{name: string, url: string, detail?: string, isAdult?: boolean}>}
 */
function collectCurrentDomainSources(): SourceEntry[] {
    const hiddenMode = typeof isHiddenContentMode === 'function' && isHiddenContentMode();
    const sources: SourceEntry[] = [];
    const seen = new Set<string>();

    if (typeof API_SITES === 'object' && API_SITES) {
        Object.keys(API_SITES).forEach((key) => {
            const site = API_SITES[key];
            if (!site || typeof site.api !== 'string') return;
            if (!sourceVisibleInDomain(site, hiddenMode)) return;

            const url = normalizeSourceUrl(site.api);
            if (!url || seen.has(url)) return;
            seen.add(url);

            const entry: SourceEntry = {
                key,
                name: site.name || key,
                url,
                hidden: !!site.hidden,
            };
            const detail = normalizeSourceUrl(site.detail);
            if (detail) entry.detail = detail;
            if (site.hidden) entry.isAdult = true;
            sources.push(entry);
        });
    }

    currentDomainCustomAPIs().forEach((api) => {
        if (!api || !sourceVisibleInDomain(api, hiddenMode)) return;
        const url = normalizeSourceUrl(api.url);
        if (!url || seen.has(url)) return;
        seen.add(url);

        const entry: SourceEntry = {
            name: api.name || sourceHostname(url),
            url,
            hidden: !!(api.isHidden || api.isAdult),
        };
        const detail = normalizeSourceUrl(api.detail);
        if (detail) entry.detail = detail;
        if (api.isHidden || api.isAdult) entry.isAdult = true;
        sources.push(entry);
    });

    return sources;
}

/**
 * 导出当前数据域的全部源为 LibreTV 兼容的 SourceList JSON 文件。
 * 文件托管到任意可访问 URL 后，即可在 LibreTV 的「数据源订阅」中导入。
 */
export function exportVideoSources(): void {
    const sources = collectCurrentDomainSources();
    if (!sources.length) {
        showToast('当前数据域没有可导出的源', 'warning');
        return;
    }

    const payload = {
        name: SOURCE_LIST_NAME,
        version: SOURCE_LIST_VERSION,
        exportedAt: Date.now(),
        sources,
        liveSources: [] as string[]
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    saveBlobAsFile(blob, 'LeLeTV-SourceList_' + Date.now() + '.json');
    showToast(`已导出 ${sources.length} 个源；托管为 URL 后可导入 LibreTV`, 'success', 5000);
}

/** 把旧版键值映射转成条目数组 */
function sourceMapToEntries(map: Record<string, unknown>): RawSourceLike[] {
    return Object.keys(map).map((key): RawSourceLike | null => {
        const item = map[key];
        if (!item || typeof item !== 'object') return null;
        const raw = item as RawSourceLike;
        return Object.assign({}, raw, {
            name: raw.name || key,
            url: raw.url || raw.api
        }) as RawSourceLike;
    }).filter((entry): entry is RawSourceLike => entry !== null);
}

function looksLikeSourceMap(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const map = value as Record<string, unknown>;
    return Object.keys(map).some((key) => {
        const item = map[key];
        return item && typeof item === 'object' && typeof ((item as RawSourceLike).url || (item as RawSourceLike).api) === 'string';
    });
}

/** 从任意受支持的 JSON 结构中取出待解析的源条目数组 */
function extractRawSourceList(json: unknown): RawSourceLike[] | null {
    if (Array.isArray(json)) return json as RawSourceLike[];
    if (!json || typeof json !== 'object') return null;
    const obj = json as Record<string, unknown>;

    // LibreTV-SourceList（含老格式：只有 sources）
    if (Array.isArray(obj.sources)) return obj.sources as RawSourceLike[];

    // TVBOX：只取 type=1（Apple CMS 直连接口），Spider / XML 无法在 LeLeTV 运行
    if (Array.isArray(obj.sites)) {
        return (obj.sites as RawSourceLike[]).filter((site) =>
            site && (site.type === 1 || site.type === '1') && typeof site.api === 'string'
        );
    }

    // 旧版键值映射：{ api_site: {...} } / { apiSites: {...} } / { API_SITES: {...} }
    const maps = [obj.api_site, obj.apiSites, obj.API_SITES];
    for (const map of maps) {
        if (map && typeof map === 'object' && !Array.isArray(map)) {
            return sourceMapToEntries(map as Record<string, unknown>);
        }
    }
    if (looksLikeSourceMap(json)) return sourceMapToEntries(json as Record<string, unknown>);

    return null;
}

/** 单条原始条目 → 标准源；无效地址返回 null */
function normalizeSourceEntry(raw: RawSourceLike): SourceEntry | null {
    if (!raw || typeof raw !== 'object') return null;

    const url = normalizeSourceUrl(raw.url || raw.api);
    if (!url) return null;

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const entry: SourceEntry = { name: name || sourceHostname(url), url };
    if (typeof raw.key === 'string' && raw.key.trim()) entry.key = raw.key.trim();

    const detail = normalizeSourceUrl(raw.detail || raw.detailUrl);
    if (detail) entry.detail = detail;
    if (raw.isAdult === true || raw.hidden === true) {
        entry.isAdult = true;
        entry.hidden = true;
    }

    return entry;
}

/**
 * 宽容解析源文件文本。
 * @param {string} text
 * @returns {{sources: Array, stats: {total: number, invalid: number, duplicates: number, truncated: number}}}
 * @throws {Error} 不是 JSON 或识别不到源列表
 */
function parseSourceListJson(text: string): ParsedSourceList {
    let json: unknown;
    try {
        json = JSON.parse(String(text || ''));
    } catch (e) {
        throw new Error('文件不是合法的 JSON');
    }

    const rawList = extractRawSourceList(json);
    if (!rawList) {
        throw new Error('未识别到源列表（支持 LibreTV 源列表或旧版源配置）');
    }

    const sources: SourceEntry[] = [];
    const seen = new Set<string>();
    let invalid = 0;
    let duplicates = 0;
    let truncated = 0;

    for (const raw of rawList) {
        const entry = normalizeSourceEntry(raw);
        if (!entry) {
            invalid++;
            continue;
        }
        if (seen.has(entry.url)) {
            duplicates++;
            continue;
        }
        seen.add(entry.url);

        if (sources.length >= SOURCE_IMPORT_LIMIT) {
            truncated++;
            continue;
        }
        sources.push(entry);
    }

    return { sources, stats: { total: rawList.length, invalid, duplicates, truncated } };
}

/**
 * 把解析后的源写入「导入源」存储，并按 hidden 自动分流到正常 / 私密数据域。
 * - 与 Worker 源或已有导入源同 URL：跳过，不重复
 * - 普通源进正常域，hidden / isAdult 源进私密域，并自动启用
 * - 不再写入 customAPIs（自定义资源站只保留用户手动添加的源）
 */
function applyImportedSources(imported: SourceEntry[]): { added: number; enabled: number; hiddenAdded: number; skipped: number } {
    const entries = (Array.isArray(imported) ? imported : [])
        .map((source) => ({
            key: source.key || '',
            name: source.name || sourceHostname(source.url),
            url: normalizeSourceUrl(source.url),
            detail: source.detail,
            hidden: source.hidden === true || source.isAdult === true,
            isAdult: source.isAdult === true,
        }))
        .filter((entry) => !!entry.url);

    const result = saveImportedSources(entries);
    applyImportedSourcesToAPISites(entries);
    localStorage.setItem('hasUserSelectedAPIs', 'true');

    // 立即刷新设置页，避免用户以为没生效
    if (typeof initAPICheckboxes === 'function') initAPICheckboxes();
    if (typeof updateSelectedApiCount === 'function') updateSelectedApiCount();

    return {
        added: result.added,
        enabled: result.added,
        hiddenAdded: result.hiddenAdded,
        skipped: result.skipped,
    };
}

/** 打开源导入弹窗（文件选择 / 拖拽 / URL） */
export function importVideoSources(): void {
    if (typeof showSourceImportBox !== 'function') {
        showToast('当前页面不支持导入视频源', 'error');
        return;
    }
    showSourceImportBox(handleSourceImportFile, handleSourceImportUrl);
}

/** 读取并解析用户选择的源文件，成功后再弹确认 */
function handleSourceImportFile(file: File): void {
    if (!file) return;
    if (file.size > SOURCE_IMPORT_MAX_BYTES) {
        showToast('源文件超过 2MB，请检查文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        let parsed: ParsedSourceList;
        try {
            parsed = parseSourceListJson(String(reader.result || ''));
        } catch (error) {
            const message = (error as { message?: unknown } | null)?.message;
            showToast(message ? String(message) : '源文件格式错误', 'error');
            return;
        }

        if (!parsed.sources.length) {
            showToast('没有可导入的有效源', 'warning');
            return;
        }
        showSourceImportConfirm(parsed);
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsText(file);
}

/**
 * 把本站 Worker 的常见地址统一成 /sources.json：
 *   - /sources.json（含分享的 scope / key）原样使用
 *   - Worker 根地址自动补 /sources.json
 *   - /api-sites → scope=public；/api-sites/hidden → scope=hidden
 * 只有 origin 与 __ENV__.TMDB_WORKER_URL 一致时才改写，避免误伤第三方地址。
 */
function normalizeWorkerSourceUrl(parsedUrl: URL): boolean {
    const path = parsedUrl.pathname.replace(/\/+$/, '') || '/';
    if (/\/sources\.json$/i.test(path)) return true;

    const env = (window as SourceImportWindow).__ENV__;
    const workerBase = env && env.TMDB_WORKER_URL;
    if (!workerBase) return false;

    let sameWorker = false;
    try {
        sameWorker = new URL(workerBase).origin === parsedUrl.origin;
    } catch (e) {
        sameWorker = false;
    }
    if (!sameWorker) return false;
    if (path !== '/' && path !== '/api-sites' && path !== '/api-sites/hidden') return false;

    parsedUrl.pathname = '/sources.json';
    if (!parsedUrl.searchParams.get('scope')) {
        const legacyHidden = parsedUrl.searchParams.get('hidden') === '1';
        if (path === '/api-sites/hidden') {
            parsedUrl.searchParams.set('scope', 'hidden');
        } else if (legacyHidden) {
            parsedUrl.searchParams.set('scope', 'all');
        } else if (path === '/api-sites') {
            parsedUrl.searchParams.set('scope', 'public');
        } else {
            parsedUrl.searchParams.set(
                'scope',
                isHiddenContentMode() && env && env.HIDDENKEY ? 'all' : 'public'
            );
        }
    }
    return true;
}

/**
 * 从 URL 拉取并解析源列表。
 * Worker 分享链接用 scope=public|hidden|all 表示范围：
 *   - public：普通源，直接拉取；
 *   - hidden / all：需要隐私凭证。链接自带 key 时直接使用；
 *     否则要求接收方处于私密模式，自动附带 HIDDENKEY。
 */
function handleSourceImportUrl(rawUrl: string): void {
    const url = String(rawUrl || '').trim();
    if (!url) {
        showToast('请输入源列表 URL', 'warning');
        return;
    }
    if (!/^https?:\/\//i.test(url)) {
        showToast('URL 需以 http:// 或 https:// 开头', 'warning');
        return;
    }

    let target = url;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    try {
        const env = (window as SourceImportWindow).__ENV__;
        const hiddenKey = env && env.HIDDENKEY;
        const parsedUrl = new URL(url);
        const isWorkerSource = normalizeWorkerSourceUrl(parsedUrl);
        if (isWorkerSource) {
            const hasShareKey = parsedUrl.searchParams.has('key');
            const hasLegacyHidden = parsedUrl.searchParams.get('hidden') === '1';
            let scope = (parsedUrl.searchParams.get('scope') || '').toLowerCase();
            if (scope !== 'public' && scope !== 'hidden' && scope !== 'all') {
                // 旧链接没有 scope：私密模式导入全部，普通模式只导入普通源
                scope = (hasLegacyHidden || (isHiddenContentMode() && hiddenKey)) ? 'all' : 'public';
                parsedUrl.searchParams.set('scope', scope);
            }
            if ((scope === 'hidden' || scope === 'all') && !hasShareKey) {
                if (!isHiddenContentMode()) {
                    showToast('该分享链接包含私密源，请先开启私密模式再导入', 'warning');
                    return;
                }
                if (hiddenKey) headers['Authorization'] = 'Bearer ' + hiddenKey;
            }
            target = parsedUrl.toString();
        }
    } catch (e) {
        // URL 解析失败交给下面的 fetch 报错
    }

    showToast('正在获取源列表…', 'info');
    fetch(target, { headers, cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
    }).then((text) => {
        if (text.length > SOURCE_IMPORT_MAX_BYTES) {
            throw new Error('源列表超过 2MB');
        }
        const parsed = parseSourceListJson(text);
        if (!parsed.sources.length) {
            showToast('没有可导入的有效源', 'warning');
            return;
        }
        showSourceImportConfirm(parsed);
    }).catch((error) => {
        const message = error && error.message ? error.message : '网络错误';
        showToast('获取源列表失败：' + message, 'error');
    });
}

/** 导入前确认：说明目标数据域、可用数量与跳过项 */
function showSourceImportConfirm(parsed: ParsedSourceList): void {
    const stats = parsed.stats;
    const extras: string[] = [];
    if (stats.invalid) extras.push(`跳过 ${stats.invalid} 条无效地址`);
    if (stats.duplicates) extras.push(`跳过 ${stats.duplicates} 条重复源`);
    if (stats.truncated) extras.push(`超出上限丢弃 ${stats.truncated} 条`);

    const summary = `识别到 ${parsed.sources.length} 个可用源，将按私密标记分别导入正常域 / 私密域并自动启用`
        + (extras.length ? `；${extras.join('，')}。` : '。');

    showModal({
        title: '导入视频源',
        content: (body, modal) => {
            body.innerHTML = `
                <p class="v2-confirm-text"></p>
                <div class="v2-dialog-foot">
                    <button type="button" class="v2-btn v2-btn--secondary" data-role="cancel">取消</button>
                    <button type="button" class="v2-btn v2-btn--primary" data-role="confirm">导入并启用</button>
                </div>
            `;
            // 摘要只含数字与固定文案，用 textContent 避免任何注入面
            const summaryEl = body.querySelector('.v2-confirm-text');
            if (summaryEl) summaryEl.textContent = summary;

            body.querySelector('[data-role="cancel"]')?.addEventListener('click', () => modal.remove());
            body.querySelector('[data-role="confirm"]')?.addEventListener('click', () => {
                modal.remove();
                const result = applyImportedSources(parsed.sources);
                const parts: string[] = [];
                if (result.added) parts.push(`新增 ${result.added} 个`);
                if (result.hiddenAdded) parts.push(`其中私密 ${result.hiddenAdded} 个`);
                if (result.skipped) parts.push(`跳过 ${result.skipped} 个`);
                let message = parts.length ? `源导入完成：${parts.join('，')}` : '这些源已存在，未做改动';
                if (result.hiddenAdded && !isHiddenContentMode()) {
                    message += '；私密源需开启私密模式查看';
                }
                showToast(message, 'success');
            });
        }
    });
}

// 阶段 5A-4 过渡期兼容桥：app bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  exportVideoSources,
  importVideoSources
});

// 阶段 5B-3 过渡期类型桥：port.ts 已成为 ESM 模块，尚未改为 import 的调用方
// 仍以裸名访问。
declare global {
  function exportVideoSources(): void;
  function importVideoSources(): void;
}
