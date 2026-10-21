# 02 页面结构

1. `src/index.html` 只允许：全局导航、主题容器、启动动画、`<main id="app">`、全局模态框挂载点。
2. 页面业务 DOM 必须在 `src/pages/<name>/template.html`。
3. 每个页面 `index.ts` 必须导出 `mount(container: HTMLElement): void | Promise<void>` 与 `unmount(): void`。
4. 事件绑定只能在 `mount()` 内完成，禁止依赖"DOM 已在 HTML 中"。
5. 页面样式写在 `src/pages/<name>/style.css`；跨页共享样式放 `src/styles/`。
6. 页面之间禁止直接 import；共享逻辑下沉 `services/` 或 `ui/`。
7. 路由切换必须先调用上一页 `unmount()`，再 `mount()` 下一页。
8. `template.html` 根节点必须是单一容器元素，且 `id="page-<name>"`。
9. 首次进入页面的 chunk 与样式允许按需加载；加载失败必须显示占位页，不能白屏。
10. 页面内部禁止直接操作其他页面的 DOM。
