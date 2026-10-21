/**
 * ListenerTracker — 事件监听追踪器
 *
 * 为模块提供统一的事件绑定和解绑机制，防止内存泄漏和重复绑定。
 * 每个模块创建一个 tracker 实例，通过它绑定事件，在 destroy() 时批量解绑。
 *
 * 使用方式：
 *   const tracker = new ListenerTracker();
 *   tracker.on(document, 'click', handleClick);        // 绑定
 *   tracker.on(window, 'resize', handleResize);        // 绑定
 *   tracker.on(element, 'mouseenter', handleEnter, { passive: true });
 *   tracker.removeAll();                                // 批量解绑
 *
 * 与 PlayerManager 配合：
 *   在模块初始化时创建 tracker，在 destroy() 中调用 removeAll()。
 */

interface TrackedListener {
    target: EventTarget;
    type: string;
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
}

class ListenerTracker {
    private _listeners: TrackedListener[] = [];

    /**
     * 绑定事件并追踪
     * @returns 绑定的 listener（方便 removeEventListener）
     */
    on(
        target: EventTarget | null,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): EventListenerOrEventListenerObject {
        if (!target || typeof target.addEventListener !== 'function') {
            console.warn('ListenerTracker.on: 无效的 target', target);
            return listener;
        }

        target.addEventListener(type, listener, options);

        this._listeners.push({
            target: target,
            type: type,
            listener: listener,
            options: options
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
        options?: boolean | AddEventListenerOptions
    ): void {
        if (!target || typeof target.removeEventListener !== 'function') return;

        target.removeEventListener(type, listener, options);

        // 从追踪列表中移除
        this._listeners = this._listeners.filter(function (item) {
            return !(item.target === target &&
                item.type === type &&
                item.listener === listener);
        });
    }

    /**
     * 批量解绑所有追踪的事件
     */
    removeAll(): void {
        for (let i = this._listeners.length - 1; i >= 0; i--) {
            const item = this._listeners[i];
            try {
                item.target.removeEventListener(item.type, item.listener, item.options);
            } catch (e) {
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

// 保持原有全局构造器行为（原 var 声明会挂到 window）
(window as Window & { ListenerTracker?: typeof ListenerTracker }).ListenerTracker = ListenerTracker;

// 阶段 5A-3 过渡期兼容桥：core bundle 切 ESM 入口后，
// 未改造的模块仍通过裸名 / window 访问这些符号。5B 全部改为 import 后删除本段。
Object.assign(window, {
  ListenerTracker
});
