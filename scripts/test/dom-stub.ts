/**
 * node --test 用的最小浏览器桩。
 *
 * 只覆盖被测试模块在「导入阶段」会碰到的 API；业务函数没有调用就不会触达更多 DOM。
 * 测试文件先 `import './dom-stub'`，再动态 import 目标模块。
 */

type AnyFn = (...args: unknown[]) => unknown;

const noop: AnyFn = () => undefined;

const documentStub = {
  readyState: 'complete',
  documentElement: {
    setAttribute: noop,
    removeAttribute: noop,
  },
  body: {
    classList: { add: noop, remove: noop },
    appendChild: noop,
    removeChild: noop,
  },
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({
    style: {},
    classList: { add: noop, remove: noop, toggle: noop },
    setAttribute: noop,
    removeAttribute: noop,
    appendChild: noop,
    addEventListener: noop,
  }),
};

const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => { store.set(key, String(value)); },
  removeItem: (key: string): void => { store.delete(key); },
  clear: (): void => { store.clear(); },
};

const mediaQuery = {
  matches: false,
  addEventListener: noop,
  removeEventListener: noop,
};

const windowStub = {
  location: { origin: 'http://localhost', href: 'http://localhost/' },
  localStorage: localStorageStub,
  matchMedia: () => mediaQuery,
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: () => true,
  setTimeout,
  clearTimeout,
};

class CustomEventStub {
  type: string;
  detail: unknown;

  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type;
    this.detail = init?.detail;
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
globals.window = windowStub;
globals.document = documentStub;
globals.localStorage = localStorageStub;
globals.CustomEvent = CustomEventStub;
