/**
 * 导航预取（阶段 3）：hover / focus 导航项时，空闲预取目标页面片段与按需 bundle。
 * 不参与首屏关键路径；预取失败只记录警告，不阻断导航。
 */

import { LeLePages } from './page-loader';

(function initRoutePrefetch(): void {
    const SELECTOR = '[data-action="switch-page"][data-page]';
    const prefetched = new Set<string>();

    function prefetch(page: string): void {
        if (!page || page === 'home' || prefetched.has(page)) return;
        const pages = LeLePages;
        if (!pages || typeof pages.prefetch !== 'function') return;
        prefetched.add(page);
        pages.prefetch(page);
    }

    function onPointerOrFocus(event: Event): void {
        const target = event.target as Element | null;
        if (!target || typeof target.closest !== 'function') return;
        const el = target.closest(SELECTOR) as HTMLElement | null;
        if (!el) return;
        prefetch(el.dataset.page || '');
    }

    document.addEventListener('pointerover', onPointerOrFocus, { passive: true });
    document.addEventListener('focusin', onPointerOrFocus, { passive: true });
})();
