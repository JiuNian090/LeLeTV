/**
 * 页面模板：复制到 src/pages/<name>/index.ts，替换 <name> 与标题。
 * 约束：事件绑定只在 mount() 内完成；unmount() 必须清理 DOM 与监听。
 */

let root: HTMLElement | null = null;

export function mount(container: HTMLElement): void {
  if (root) return;

  root = document.createElement('div');
  root.id = 'page-example';
  root.className = 'page-content';

  const header = document.createElement('header');
  header.className = 'page-header';
  const title = document.createElement('h1');
  title.textContent = '页面标题';
  header.appendChild(title);

  const body = document.createElement('main');
  body.className = 'page-body';

  root.append(header, body);
  container.appendChild(root);
}

export function unmount(): void {
  root?.remove();
  root = null;
}
