/**
 * LeLeTV 共享状态（阶段 5B-1）
 *
 * 只放跨多个模块共享的配置与可变状态，不依赖 services / ui / pages / router。
 * 旧位置（core/config.ts、services/sources/config.ts、main.ts）保留
 * re-export 或 getter/setter 兼容层；5B-3 逐模块改为 import 后再删除。
 */

export interface ApiSite {
    api: string;
    name: string;
    hidden?: boolean;
    detail?: string;
    /** 来源：Worker 云端下发，或用户导入的源列表 */
    origin?: 'worker' | 'import';
}

// ==================== 隐藏内容模式（双数据域隔离） ====================
// 开启隐藏内容模式后，下列键的读写会自动带 hidden:: 前缀，与正常域完全隔离，
// 两个域互不可见。其余键（设置项、播放器状态等）由两个域共用。
export const HIDDEN_MODE_KEY = 'hiddenContentMode';
export const HIDDEN_KEY_PREFIX = 'hidden::';
const SCOPED_STORAGE_KEYS = ['selectedAPIs', 'customAPIs', 'importedAPIs', 'viewingHistory', 'videoSearchHistory'];

/** 当前是否处于隐藏内容模式 */
export function isHiddenContentMode(): boolean {
    try {
        return localStorage.getItem(HIDDEN_MODE_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

/** 按当前数据域解析存储键名；非 scoped 键原样返回 */
export function scopedKey(key: string): string {
    if (SCOPED_STORAGE_KEYS.indexOf(key) === -1) return key;
    return isHiddenContentMode() ? HIDDEN_KEY_PREFIX + key : key;
}

// ==================== API 站点配置 ====================
// 内置源已全部迁到 Worker 的 D1（种子 JSON 见 workers/builtin-sources.json）。
// 前端启动时按「Worker 缓存 → 本地导入源 → Worker 最新」的顺序合并，
// 这里保持空对象，不再硬编码任何源。
export const API_SITES: Record<string, ApiSite> = {};

/** 合并远端 / 导入的站点配置（原地扩展，保持对象引用不变） */
export function extendAPISites(newSites: Record<string, ApiSite>): void {
    Object.assign(API_SITES, newSites);
}

// ==================== 数据源选择状态 ====================
// 原在 services/sources/config.ts 声明；迁到 core 后 core/global.ts 与
// services/sources/config.ts 不再互相依赖。旧位置保留 window getter/setter 代理。
export interface CustomApiEntry {
    name: string;
    url: string;
    detail?: string;
    isHidden?: boolean;
    isAdult?: boolean;
}

export let selectedAPIs: string[] = [];
export function getSelectedAPIs(): string[] {
    return selectedAPIs;
}
export function setSelectedAPIs(v: string[]): void {
    selectedAPIs = v;
}

export let customAPIs: CustomApiEntry[] = [];
export function getCustomAPIs(): CustomApiEntry[] {
    return customAPIs;
}
export function setCustomAPIs(v: CustomApiEntry[]): void {
    customAPIs = v;
}

// ==================== 搜索共享状态 ====================
// 原在 src/main.ts 声明，被 pages/search/index.ts 与 pages/category/index.ts 直接读写。
// 迁到 core 后 main / search / category 之间不再通过全局变量互相依赖。
export interface SearchFilterConfig {
    mode: 'blacklist' | 'whitelist';
    blacklist: string[];
    whitelist: string[];
}

/** 搜索结果条目的最小共享结构（原 pages/search/cards.ts 的 ResultItem） */
export interface SearchResultItem {
    [key: string]: unknown;
    vod_id?: string | number;
    vod_name?: string;
    vod_year?: string | number;
    vod_pic?: string;
    vod_remarks?: string;
    type_name?: string;
    source_code?: string;
    source_name?: string;
    source_latency?: number;
    api_url?: string;
}

/** 同名结果合并后的分组（原 pages/search/cards.ts 的 MergeGroup，跨页面共享） */
export interface MergeGroup {
    lead: SearchResultItem;
    items: SearchResultItem[];
    year?: string;
    name?: string;
    base?: string;
    season?: number | null;
    remarks?: string;
    pic?: string;
    kind?: string;
}

export let activeSourceFilter = 'all';
export function setActiveSourceFilter(v: string): void {
    activeSourceFilter = v;
}

export let lastAllResults: SearchResultItem[] = [];
export function setLastAllResults(v: SearchResultItem[]): void {
    lastAllResults = v;
}

export let searchFilterConfig: SearchFilterConfig | null = null;
export function setSearchFilterConfig(v: SearchFilterConfig | null): void {
    searchFilterConfig = v;
}

export let searchReady = false;
export function setSearchReady(v: boolean): void {
    searchReady = v;
}

export let searchThrottled = false;
export function setSearchThrottled(v: boolean): void {
    searchThrottled = v;
}


