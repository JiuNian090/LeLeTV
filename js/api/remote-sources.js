/**
 * 远端数据源同步
 *
 * 把 Worker（GET /api-sites、GET /api-sites/hidden）里配置的采集源合并进内置 API_SITES
 * （js/core/config.js）。内置源是永久兜底：Worker 未配置、请求失败或超时，页面照常使用内置源。
 *
 * 几个刻意的设计：
 *   - 启动时先同步套用上次成功拉取的本地缓存，不让首屏等网络；随后后台拉最新，列表有变化才刷新复选框。
 *   - 合并是字段级的：远端只覆盖它明确提供的字段。detail 为空串表示「明确清空」，
 *     而不是「没填」——否则远端同名覆盖内置源时会把内置的 detail 冲掉。
 *   - 私密源只在隐藏内容模式下拉取。正常访客既不会请求 /api-sites/hidden，
 *     也不会把私密源写进本地缓存。
 */

const REMOTE_SOURCES_CACHE_KEY = 'remoteApiSitesCache';
const REMOTE_SOURCES_TIMEOUT_MS = 5000;

/** Worker 基址；未配置（例如纯本地 dev）时返回空串，调用方据此跳过远端同步 */
function remoteSourcesBaseUrl() {
    try {
        return (window.__ENV__ && window.__ENV__.TMDB_WORKER_URL) || '';
    } catch (e) {
        return '';
    }
}

function readRemoteSourcesCache() {
    try {
        const raw = localStorage.getItem(REMOTE_SOURCES_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (e) {
        console.warn('远端数据源缓存解析失败:', e);
        return null;
    }
}

function writeRemoteSourcesCache(version, sites, hiddenSites) {
    try {
        localStorage.setItem(REMOTE_SOURCES_CACHE_KEY, JSON.stringify({
            version: version || '',
            sites: sites || {},
            hiddenSites: hiddenSites || {},
            savedAt: Date.now()
        }));
    } catch (e) {
        // 存储配额满或隐私模式：只是失去离线兜底，不影响本次会话
        console.warn('远端数据源缓存写入失败:', e);
    }
}

/**
 * 字段级合并单个源条目。
 * @param {Object|undefined} builtin 内置源条目；没有则为新增
 * @param {Object} remote 远端条目
 * @returns {Object} 合并后的条目
 */
function mergeRemoteSourceEntry(builtin, remote) {
    const merged = {};
    if (builtin) {
        Object.keys(builtin).forEach((k) => { merged[k] = builtin[k]; });
    }

    if (typeof remote.name === 'string' && remote.name) merged.name = remote.name;
    if (typeof remote.api === 'string' && remote.api) merged.api = remote.api;
    // 只认 true：远端普通源不该把内置私密源的 hidden 冲掉
    if (remote.hidden === true) merged.hidden = true;

    if (typeof remote.detail === 'string') {
        if (remote.detail) merged.detail = remote.detail;
        else delete merged.detail; // 空串 = 明确清空
    }

    return merged;
}

/**
 * 把一批远端源合并进 API_SITES。
 * @param {Object} sites { key: { api, name, detail?, hidden? } }
 * @returns {string[]} 实际发生新增或变更的 key
 */
function applyRemoteApiSites(sites) {
    if (!sites || typeof sites !== 'object') return [];
    if (typeof window.extendAPISites !== 'function') return [];

    const existing = window.API_SITES || {};
    const patches = {};
    const changed = [];

    Object.keys(sites).forEach((key) => {
        const remote = sites[key];
        if (!remote || typeof remote !== 'object') return;
        // 只接受形状正确的条目，避免脏数据污染 API_SITES
        if (typeof remote.api !== 'string' || !remote.api) return;
        if (typeof remote.name !== 'string' || !remote.name) return;

        const builtin = existing[key];
        const merged = mergeRemoteSourceEntry(builtin, remote);
        patches[key] = merged;

        if (!builtin || JSON.stringify(builtin) !== JSON.stringify(merged)) {
            changed.push(key);
        }
    });

    if (Object.keys(patches).length) {
        window.extendAPISites(patches);
    }
    return changed;
}

/**
 * 启动时同步套用本地缓存（不发起任何请求）。
 * 隐藏域才把缓存的私密源一起合并进来。
 * @returns {string[]} 实际合并的 key
 */
function applyRemoteApiSitesFromCache() {
    const cached = readRemoteSourcesCache();
    if (!cached) return [];

    const sites = {};
    Object.keys(cached.sites || {}).forEach((k) => { sites[k] = cached.sites[k]; });

    const hiddenMode = (typeof isHiddenContentMode === 'function') && isHiddenContentMode();
    if (hiddenMode) {
        Object.keys(cached.hiddenSites || {}).forEach((k) => { sites[k] = cached.hiddenSites[k]; });
    }

    return applyRemoteApiSites(sites);
}

function fetchRemoteSourcesJson(url, token, signal) {
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, { headers, signal }).then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    });
}

/**
 * 拉取远端配置并合并。
 * @returns {Promise<string[]>} 实际发生变化（新增/改动）的 key；失败或无变化时为空数组
 */
function syncRemoteApiSites() {
    const base = remoteSourcesBaseUrl();
    if (!base) return Promise.resolve([]);

    const hiddenMode = (typeof isHiddenContentMode === 'function') && isHiddenContentMode();
    // 私密源接口要求管理员 token；页面上公开的 HIDDENKEY hash 恰好就是它（读接口允许）
    const token = hiddenMode ? ((window.__ENV__ && window.__ENV__.HIDDENKEY) || '') : '';

    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = setTimeout(() => { if (controller) controller.abort(); }, REMOTE_SOURCES_TIMEOUT_MS);

    const publicTask = fetchRemoteSourcesJson(base + '/api-sites', '', controller ? controller.signal : undefined);
    const hiddenTask = (hiddenMode && token)
        ? fetchRemoteSourcesJson(base + '/api-sites/hidden', token, controller ? controller.signal : undefined)
        : Promise.resolve(null);

    return Promise.all([publicTask, hiddenTask]).then((results) => {
        const publicRes = results[0];
        const hiddenRes = results[1];

        if (!publicRes || publicRes.ok !== true) {
            console.warn('远端数据源下发失败，继续使用内置源:', publicRes && publicRes.error);
            return [];
        }

        let changed = applyRemoteApiSites(publicRes.sites);
        const hiddenOk = !!(hiddenRes && hiddenRes.ok === true);

        if (hiddenOk) {
            changed = changed.concat(applyRemoteApiSites(hiddenRes.sites));
        } else if (hiddenMode && hiddenRes) {
            console.warn('私密数据源下发失败，本次只使用普通源:', hiddenRes.error);
        }

        // 私密源那次失败时不覆盖缓存，避免把上次的私密源缓存抹成空
        writeRemoteSourcesCache(
            publicRes.version,
            publicRes.sites,
            hiddenOk ? hiddenRes.sites : (readRemoteSourcesCache() || {}).hiddenSites
        );

        return changed;
    }).catch((err) => {
        // 超时、断网、非 2xx 都落在这里：静默回退到内置源 + 上次缓存
        console.warn('远端数据源拉取失败，继续使用内置源与本地缓存:', err && err.message);
        return [];
    }).then((changed) => {
        clearTimeout(timer);
        return changed;
    });
}

window.applyRemoteApiSitesFromCache = applyRemoteApiSitesFromCache;
window.syncRemoteApiSites = syncRemoteApiSites;
