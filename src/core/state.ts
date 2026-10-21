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
}

// ==================== 隐藏内容模式（双数据域隔离） ====================
// 开启隐藏内容模式后，下列键的读写会自动带 hidden:: 前缀，与正常域完全隔离，
// 两个域互不可见。其余键（设置项、播放器状态等）由两个域共用。
export const HIDDEN_MODE_KEY = 'hiddenContentMode';
const HIDDEN_KEY_PREFIX = 'hidden::';
const SCOPED_STORAGE_KEYS = ['selectedAPIs', 'customAPIs', 'viewingHistory', 'videoSearchHistory'];

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
export const API_SITES: Record<string, ApiSite> = {
    bdzy: {
        api: 'https://api.apibdzy.com/api.php/provide/vod/',
        name: '百度资源',
    },

    gszy: {
        api: 'https://api.guangsuapi.com/api.php/provide/vod',
        name: '光速资源',
    },

    zy360: {
        api: 'https://360zy.com/api.php/provide/vod',
        name: '360资源',
    },

    bfzy: {
        api: 'https://bfzyapi.com/api.php/provide/vod',
        name: '暴风资源',
    },

    xlzy: {
        api: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/',
        name: '新浪资源'
    },

    zuid: {
        api: 'https://api.zuidapi.com/api.php/provide/vod',
        name: '最大资源'
    },

    hhzy: {
        api: 'https://hhzyapi.com/api.php/provide/vod',
        name: '豪华资源'
    },

    // 原 jpzy（荐片资源）的 api 与 hhzy 完全相同（重复配置），已替换为 ffzy（飞飞资源）。
    // from/ffm3u8/at/json/ 直接返回 .m3u8，与 lzzy/hnzy 同一模式，无需二次解析。
    ffzy: {
        api: 'https://api.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/',
        name: '非凡资源'
    },

    lzzy: {
        api: 'https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/at/json/',
        name: '量子资源'
    },

    jszy: {
        api: 'https://jszyapi.com/api.php/provide/vod',
        name: '极速资源'
    },
    hnzy: {
        api: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/',
        name: '红牛资源'
    },
    ckzy: {
        api: 'https://ckzy.me/api.php/provide/vod',
        name: 'ck资源',
        hidden: true
    },
    fhzy: {
        api: 'http://fhapi9.com/api.php/provide/vod',
        name: 'fh资源',
        hidden: true
    },
    ywzy: {
        api: 'https://155api.com/api.php/provide/vod',
        name: '155资源',
        hidden: true
    },
    mdzy: {
        api: 'https://91md.me/api.php/provide/vod',
        name: '麻豆资源',
        hidden: true
    },
    kgzy: {
        api: 'https://jkunzyapi.com/api.php/provide/vod',
        name: 'kg资源',
        hidden: true
    },
    nxzy: {
        api: 'https://naixxzy.com/api.php/provide/vod',
        name: '奶香资源',
        hidden: true
    },
    lbzy: {
        api: 'https://lbapi9.com/api.php/provide/vod',
        name: '乐播资源',
        hidden: true
    },
    xjzy: {
        api: 'https://www.xiangjiaozyw.com/api.php/provide/vod',
        name: '香蕉资源',
        hidden: true
    },
    hjzy: {
        api: 'https://api.apilyzy.com/api.php/provide/vod',
        name: '花椒资源',
        hidden: true
    },
    ttzy: {
        api: 'https://apittzy.com/api.php/provide/vod/',
        name: '探探资源',
        hidden: true
    },
};

/** 合并远端 / 导入的站点配置（原地扩展，保持对象引用不变） */
export function extendAPISites(newSites: Record<string, ApiSite>): void {
    Object.assign(API_SITES, newSites);
}

// 阶段 5B-1 过渡期类型桥：尚未改为 import 的全局脚本仍以裸名访问这些符号。
declare global {
    interface ApiSite {
        api: string;
        name: string;
        hidden?: boolean;
        detail?: string;
    }
    const API_SITES: Record<string, ApiSite>;
    const HIDDEN_MODE_KEY: string;
    function isHiddenContentMode(): boolean;
    function scopedKey(key: string): string;
    function extendAPISites(newSites: Record<string, ApiSite>): void;
}
