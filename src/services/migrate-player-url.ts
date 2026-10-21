/**
 * 旧播放页地址迁移
 *   v4.1.2 起播放页从 player.html 搬到 src/pages/player/index.html（MAP 第 53 条）。
 *   观看记录里存的是完整播放页链接（如 player.html?url=...），这里在每次启动时
 *   把旧前缀改写为新路径并写回 localStorage；已是新地址的记录不会重复处理。
 *   只改「播放页链接」，直链记录（url 直接是 m3u8）保持原样。
 */

import { HIDDEN_KEY_PREFIX, scopedKey } from '../core/state';

const LEGACY_PLAYER_URL = /(^|\/)player\.html(\?|$)/;
const PLAYER_PAGE_PATH = 'src/pages/player/index.html';

function migrateKey(key: string): void {
    const raw = localStorage.getItem(key);
    if (!raw) return;

    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return;

    let changed = false;
    list.forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        const item = entry as { url?: unknown };
        if (typeof item.url !== 'string' || !LEGACY_PLAYER_URL.test(item.url)) return;
        item.url = item.url.replace(LEGACY_PLAYER_URL, (_match, lead: string, tail: string) => {
            return (lead || '') + PLAYER_PAGE_PATH + tail;
        });
        changed = true;
    });

    if (changed) localStorage.setItem(key, JSON.stringify(list));
}

export function migrateLegacyPlayerUrls(): void {
    try {
        // 正常域与私密域各自独立存储；scopedKey 只返回当前域，另一份要显式处理
        const keys = new Set([scopedKey('viewingHistory'), HIDDEN_KEY_PREFIX + 'viewingHistory']);
        keys.forEach(migrateKey);
    } catch (e) {
        /* 隐私模式 / 存储损坏：保持原样，忽略 */
    }
}

migrateLegacyPlayerUrls();
