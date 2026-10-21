/**
 * 无业务 UI 组件模板：只依赖 core，不 import services / pages。
 */

export interface ComponentOptions {
  container: HTMLElement;
  className?: string;
}

export interface ComponentHandle {
  destroy(): void;
}

export function createComponent(options: ComponentOptions): ComponentHandle {
  const el = document.createElement('div');
  el.className = options.className ?? 'leletv-component';
  options.container.appendChild(el);

  return {
    destroy(): void {
      el.remove();
    },
  };
}
