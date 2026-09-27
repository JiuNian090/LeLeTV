// LeLeTV — 线路预检
// 一条线路能不能播，只看两件事：详情接口有集数、当前集的 m3u8 能按 CORS 方式取到（hls.js 就是这么取的）。
// 结果页在最佳匹配渲染后先探一遍最快线路，判死就把播放按钮换到下一条，点播放时不用再等超时换线；
// 播放页起播前自动换线也用同一套校验。结论记在 sessionStorage，10 分钟内同一条线路不重复探。
(function () {
    'use strict';

    const CACHE_KEY = 'leletv_line_probe';
    const TTL_MS = 10 * 60 * 1000;
    const DETAIL_TIMEOUT_MS = 4000;
    const M3U8_TIMEOUT_MS = 5000;   // 清单 5 秒都拿不到的线路，起播也快不了
    const pending = {};

    function readCache() {
        try {
            const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
            return c && typeof c === 'object' ? c : {};
        } catch (e) { return {}; }
    }

    function writeCache(c) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* 忽略 */ }
    }

    function keyOf(source, vodId, index) {
        return String(source) + '|' + String(vodId) + '|' + (index || 0);
    }

    /** 缓存里的结论：true 能播 / false 不能播 / undefined 没探过或已过期 */
    function cached(source, vodId, index) {
        const hit = readCache()[keyOf(source, vodId, index)];
        if (!hit || Date.now() - (hit.t || 0) > TTL_MS) return undefined;
        return !!hit.ok;
    }

    function remember(source, vodId, index, ok) {
        const c = readCache();
        const now = Date.now();
        Object.keys(c).forEach(k => { if (now - (c[k].t || 0) > TTL_MS) delete c[k]; });
        c[keyOf(source, vodId, index)] = { ok: !!ok, t: now };
        writeCache(c);
    }

    function detailParams(source) {
        if (String(source).startsWith('custom_')) {
            const info = typeof getCustomApiInfo === 'function' ? getCustomApiInfo(String(source).replace('custom_', '')) : null;
            if (!info) return null;
            return '&customApi=' + encodeURIComponent(info.url) + (info.detail ? '&customDetail=' + encodeURIComponent(info.detail) : '') + '&source=custom';
        }
        return '&source=' + encodeURIComponent(source);
    }

    /** iOS 走原生 HLS，不受 CORS 限制；播放页有 shouldUseNativeHls 就以它为准 */
    function nativeHls() {
        if (typeof shouldUseNativeHls === 'function') return !!shouldUseNativeHls();
        const ua = navigator.userAgent || '';
        return /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    async function probe(source, vodId, index) {
        const params = detailParams(source);
        if (params === null) return false;
        const res = await fetch('/api/detail?id=' + encodeURIComponent(vodId) + params + '&_t=' + Date.now(), {
            cache: 'no-cache', signal: AbortSignal.timeout(DETAIL_TIMEOUT_MS)
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data || !Array.isArray(data.episodes) || !data.episodes.length) return false;
        const i = (index && index < data.episodes.length) ? index : 0;
        const url = data.episodes[i];
        if (!url || !/^https?:\/\//.test(url)) return false;
        // 不能带 cache: 'no-cache'：会加请求头触发预检，很多图床不答 OPTIONS，好线路也会被判死
        const native = nativeHls();
        const r = await fetch(url, { mode: native ? 'no-cors' : 'cors', signal: AbortSignal.timeout(M3U8_TIMEOUT_MS) });
        return native || r.ok;
    }

    /** 探一条线路：有缓存直接给；同一条并发只探一次；结论进缓存 */
    function check(source, vodId, index) {
        const known = cached(source, vodId, index);
        if (known !== undefined) return Promise.resolve(known);
        const k = keyOf(source, vodId, index);
        if (pending[k]) return pending[k];
        pending[k] = probe(source, vodId, index).catch(() => false).then(ok => {
            remember(source, vodId, index, ok);
            delete pending[k];
            return ok;
        });
        return pending[k];
    }

    window.LeLeLineProbe = { check, cached, remember };
})();
