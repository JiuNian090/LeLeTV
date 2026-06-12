/**
 * ListenerTracker — 事件监听追踪器
 *
 * 为模块提供统一的事件绑定和解绑机制，防止内存泄漏和重复绑定。
 * 每个模块创建一个 tracker 实例，通过它绑定事件，在 destroy() 时批量解绑。
 *
 * 使用方式：
 *   const tracker = new ListenerTracker();
 *   tracker.on(document, 'click', handleClick);
 *   tracker.on(window, 'resize', handleResize);
 *   tracker.on(element, 'mouseenter', handleEnter, { passive: true });
 *   tracker.removeAll();  // 批量解绑
 */

interface ListenerEntry {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: AddEventListenerOptions | boolean;
}

export class ListenerTracker {
  private _listeners: ListenerEntry[] = [];

  /**
   * 绑定事件并追踪
   * @param target 事件目标
   * @param type 事件类型
   * @param listener 事件处理函数
   * @param options addEventListener 选项
   * @returns 绑定的 listener（方便 removeEventListener）
   */
  on(
    target: EventTarget | null,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): EventListenerOrEventListenerObject {
    if (!target || typeof target.addEventListener !== 'function') {
      console.warn('ListenerTracker.on: 无效的 target', target);
      return listener;
    }

    target.addEventListener(type, listener, options);

    this._listeners.push({
      target,
      type,
      listener,
      options,
    });

    return listener;
  }

  /**
   * 解绑单个事件
   */
  off(
    target: EventTarget | null,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): void {
    if (!target || typeof target.removeEventListener !== 'function') return;

    target.removeEventListener(type, listener, options);

    this._listeners = this._listeners.filter(
      (item) =>
        !(item.target === target && item.type === type && item.listener === listener)
    );
  }

  /**
   * 批量解绑所有追踪的事件
   */
  removeAll(): void {
    for (let i = this._listeners.length - 1; i >= 0; i--) {
      const item = this._listeners[i];
      try {
        item.target.removeEventListener(item.type, item.listener, item.options);
      } catch {
        // 静默处理
      }
    }
    this._listeners = [];
  }

  /**
   * 获取当前追踪的监听器数量
   */
  count(): number {
    return this._listeners.length;
  }
}
