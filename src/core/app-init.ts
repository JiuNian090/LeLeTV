/**
 * AppInit — 应用初始化协调器
 *
 * 显式定义 LeLeTV 首页的初始化阶段和依赖顺序，不再隐式依赖 <script> 标签顺序。
 * 各模块逐步迁移到此机制，目前 index.html 的内联初始化已接入。
 * 新模块应通过 AppInit.register() 注册初始化函数。
 *
 * 初始化阶段（按顺序执行）：
 *   1. CORE   — 核心基础设施（config, storage, listener tracker）
 *   2. AUTH   — 密码验证
 *   3. CONFIG — API 配置、数据源初始化
 *   4. UI     — DOM 初始化、事件绑定
 *   5. POST   — 后处理（hash 路由、极光背景、版本检测）
 *
 * 使用方式：
 *   AppInit.register('myModule', AppInit.PHASES.UI, () => { ... });
 *   AppInit.run();
 */

// ==================== 阶段类型定义 ====================

interface PhaseDef {
  order: number;
  name: string;
}

interface Task {
  name: string;
  order: number;
  fn: (context?: Record<string, unknown>) => void;
  once: boolean;
  executed: boolean;
}

interface AppInitInstance {
  PHASES: Record<string, PhaseDef>;
  register: (name: string, phase: PhaseDef, fn: () => void, options?: { once?: boolean }) => void;
  run: (context?: Record<string, unknown>) => void;
  reset: () => void;
}

// ==================== 实现 ====================

export const AppInit: AppInitInstance = (() => {
  'use strict';

  /** 初始化阶段枚举 */
  const PHASES: Record<string, PhaseDef> = {
    CORE: { order: 0, name: 'core' },
    AUTH: { order: 1, name: 'auth' },
    CONFIG: { order: 2, name: 'config' },
    UI: { order: 3, name: 'ui' },
    POST: { order: 4, name: 'post' },
  };

  /** 已注册的初始化任务 */
  const _tasks: Task[] = [];

  /** 是否已执行 */
  let _ran = false;

  /**
   * 注册一个初始化函数
   * @param name 模块名称
   * @param phase 阶段（AppInit.PHASES.xxx）
   * @param fn 初始化函数
   * @param options 可选配置
   */
  function register(
    name: string,
    phase: PhaseDef,
    fn: () => void,
    options?: { once?: boolean }
  ): void {
    if (typeof name !== 'string' || !name) {
      console.warn('AppInit.register: 需要有效的模块名');
      return;
    }
    if (typeof fn !== 'function') {
      console.warn('AppInit.register: 需要有效的初始化函数');
      return;
    }

    const order = (phase && typeof phase.order === 'number') ? phase.order : 99;

    _tasks.push({
      name,
      order,
      fn,
      once: !options || options.once !== false,
      executed: false,
    });

    // 按阶段排序
    _tasks.sort((a, b) => a.order - b.order);
  }

  /**
   * 执行所有已注册的初始化任务
   * @param context 可选的上下文参数
   */
  function run(context?: Record<string, unknown>): void {
    if (_ran) {
      console.warn('AppInit.run: 初始化已执行过');
      return;
    }
    _ran = true;

    for (let i = 0; i < _tasks.length; i++) {
      const task = _tasks[i];
      if (task.executed) continue;
      try {
        task.fn(context || {});
        task.executed = true;
      } catch (e) {
        console.error('AppInit: [' + task.name + '] 初始化失败:', e);
      }
    }
  }

  /**
   * 重置（主要用于测试）
   */
  function reset(): void {
    _tasks.length = 0;
    _ran = false;
  }

  return {
    PHASES,
    register,
    run,
    reset,
  };
})();
