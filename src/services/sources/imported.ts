import {
    API_SITES,
    HIDDEN_KEY_PREFIX,
    isHiddenContentMode,
    setSelectedAPIs,
} from '../../core/state';

/**
 * 本地导入源（LibreTV 源列表 / TVBOX / 裸数组）
 *
 * 与「自定义资源站」区分：
 *   - 导入源存 importedAPIs（按数据域），启动时合并进 API_SITES，设置页显示为「数据源」；
 *   - 自定义源存 customAPIs，只由用户手动添加；
 *   - Worker 源由 remote.ts 合并进 API_SITES，origin = 'worker'。
 *
 * 合并顺序固定为「Worker 缓存 → 导入源 → Worker 最新」；同 URL 先到先得，
 * 因此导入源与 Worker 源重复时不会生成两条，先加载的那条保留。
 */

export interface ImportedApiEntry {
    key: string;
    name: string;
    url: string;
    detail?: string;
    hidden?: boolean;
    isAdult?: boolean;
}

export interface SaveImportedResult {
    added: number;
    skipped: number;
    hiddenAdded: number;
}

const NORMAL_IMPORTED_KEY = 'importedAPIs';
const HIDDEN_IMPORTED_KEY = HIDDEN_KEY_PREFIX + 'importedAPIs';
const NORMAL_SELECTED_KEY = 'selectedAPIs';
const HIDDEN_SELECTED_KEY = HIDDEN_KEY_PREFIX + 'selectedAPIs';

function normalizeUrl(value: unknown): string {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) return '';
    try {
        new URL(url);
    } catch (e) {
        return '';
    }
    return url.replace(/\/+$/, '');
}

function readImported(hidden: boolean): ImportedApiEntry[] {
    try {
        const raw = localStorage.getItem(hidden ? HIDDEN_IMPORTED_KEY : NORMAL_IMPORTED_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is ImportedApiEntry => {
            if (!item || typeof item !== 'object') return false;
            const entry = item as Partial<ImportedApiEntry>;
            return typeof entry.name === 'string' && typeof entry.url === 'string';
        });
    } catch (e) {
        return [];
    }
}

function writeImported(hidden: boolean, list: ImportedApiEntry[]): void {
    try {
        localStorage.setItem(hidden ? HIDDEN_IMPORTED_KEY : NORMAL_IMPORTED_KEY, JSON.stringify(list));
    } catch (e) {
        // 隐私模式或配额满：本次导入仍然合并进内存，只是失去持久化
    }
}

/** 基于 URL 生成稳定 key；同一 URL 重复导入得到同一个 key */
export function importedKeyForUrl(url: string): string {
    let hash = 2166136261;
    const text = normalizeUrl(url);
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return 'imported_' + (hash >>> 0).toString(36);
}

function addSelectedKeys(hidden: boolean, keys: string[]): void {
    if (!keys.length) return;
    let list: string[] = [];
    try {
        const parsed = JSON.parse(localStorage.getItem(hidden ? HIDDEN_SELECTED_KEY : NORMAL_SELECTED_KEY) || '[]') as unknown;
        if (Array.isArray(parsed)) list = parsed.filter((item): item is string => typeof item === 'string');
    } catch (e) {
        list = [];
    }
    for (const key of keys) {
        if (list.indexOf(key) === -1) list.push(key);
    }
    try {
        localStorage.setItem(hidden ? HIDDEN_SELECTED_KEY : NORMAL_SELECTED_KEY, JSON.stringify(list));
    } catch (e) {
        // 同上
    }
    if (isHiddenContentMode() === hidden) setSelectedAPIs(list);
}

/** 把一批导入源写进对应数据域（普通 / 私密），并自动启用 */
export function saveImportedSources(entries: ImportedApiEntry[]): SaveImportedResult {
    const groups: { normal: ImportedApiEntry[]; hidden: ImportedApiEntry[] } = {
        normal: [],
        hidden: [],
    };
    let skipped = 0;

    for (const raw of entries) {
        const url = normalizeUrl(raw.url);
        if (!url) {
            skipped++;
            continue;
        }
        const hidden = raw.hidden === true || raw.isAdult === true;
        const list = hidden ? groups.hidden : groups.normal;
        if (list.some((item) => normalizeUrl(item.url) === url)) {
            skipped++;
            continue;
        }
        list.push({
            key: typeof raw.key === 'string' && /^imported_[a-z0-9]+$/.test(raw.key)
                ? raw.key
                : importedKeyForUrl(url),
            name: String(raw.name || url).trim().slice(0, 40) || url,
            url,
            detail: raw.detail ? normalizeUrl(raw.detail) : undefined,
            hidden,
            isAdult: raw.isAdult === true,
        });
    }

    let added = 0;
    let hiddenAdded = 0;
    // Worker 源优先：导入列表里与 API_SITES 已有 URL 相同的条目不落库，也不进 selectedAPIs
    const apiUrls = new Set(
        Object.keys(API_SITES).map((key) => normalizeUrl(API_SITES[key].api))
    );
    const addToDomain = (hidden: boolean, incoming: ImportedApiEntry[]): string[] => {
        if (!incoming.length) return [];
        const existing = readImported(hidden);
        const existingUrls = new Set(existing.map((item) => normalizeUrl(item.url)));
        const keys: string[] = [];
        for (const item of incoming) {
            if (existingUrls.has(item.url) || apiUrls.has(item.url)) {
                skipped++;
                continue;
            }
            existing.push(item);
            existingUrls.add(item.url);
            keys.push(item.key);
        }
        if (keys.length) {
            writeImported(hidden, existing);
        }
        return keys;
    };

    const normalKeys = addToDomain(false, groups.normal);
    const hiddenKeys = addToDomain(true, groups.hidden);
    added = normalKeys.length + hiddenKeys.length;
    hiddenAdded = hiddenKeys.length;

    addSelectedKeys(false, normalKeys);
    addSelectedKeys(true, hiddenKeys);

    return { added, skipped, hiddenAdded };
}

/** 把单条导入源合并进 API_SITES；同 URL 已存在（Worker 源优先）则跳过 */
function mergeImportedEntry(item: ImportedApiEntry): string | null {
    const url = normalizeUrl(item.url);
    if (!url) return null;
    const existingKey = Object.keys(API_SITES).find(
        (key) => normalizeUrl(API_SITES[key].api) === url
    );
    if (existingKey) return null;

    let key = item.key || importedKeyForUrl(url);
    if (API_SITES[key]) key = key + '_' + (Object.keys(API_SITES).length + 1);
    API_SITES[key] = {
        api: item.url,
        name: item.name,
        detail: item.detail,
        hidden: item.hidden === true || item.isAdult === true,
        origin: 'import',
    };
    return key;
}

/** 启动时把本地导入源合并进 API_SITES */
export function applyImportedSourcesFromCache(): string[] {
    const changed: string[] = [];
    const all = readImported(false).concat(readImported(true));
    for (const item of all) {
        const key = mergeImportedEntry(item);
        if (key) changed.push(key);
    }
    return changed;
}

/** 导入完成后立即把新条目合并进当前页面的 API_SITES */
export function applyImportedSourcesToAPISites(entries: ImportedApiEntry[]): string[] {
    const changed: string[] = [];
    for (const item of entries) {
        const key = mergeImportedEntry(item);
        if (key) changed.push(key);
    }
    return changed;
}
