/**
 * 服务模块模板：只依赖 core，不触碰 DOM 与页面。
 */

export interface ServiceResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
}

export async function fetchExample(input: string): Promise<ServiceResult<string>> {
  try {
    const res = await fetch(`/api/example?q=${encodeURIComponent(input)}`);
    if (!res.ok) {
      return { ok: false, data: null, error: `HTTP ${res.status}` };
    }
    return { ok: true, data: await res.text() };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, data: null, error: message };
  }
}
