/**
 * 公共类型模板：按层放到 src/core/types.ts 或 src/services/types.ts。
 */

export interface Source {
  id: string;
  name: string;
  api: string;
  enabled?: boolean;
}

export interface PlayItem {
  id: string;
  title: string;
  source: string;
  url: string;
  episode?: string;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
