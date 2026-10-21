/**
 * 导航栏滚动毛玻璃（阶段 2 从 index.html 内联脚本抽出）。
 * 未滚动时纯半透明底，滚动后才启用 backdrop-filter。
 */

export function initNavScroll(): void {
    const nav = document.querySelector<HTMLElement>('.top-nav-bar.v2-nav');
    if (!nav) return;

    let ticking = false;

    function updateNav(): void {
        if (window.scrollY > 8) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        ticking = false;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            requestAnimationFrame(updateNav);
            ticking = true;
        }
    }, { passive: true });

    updateNav();
}

initNavScroll();
