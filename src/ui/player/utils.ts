/**
 * LeLeTV 播放器纯工具函数（阶段 5B-2c）
 *
 * 从 detail.ts 下沉。detail 与 ui 都依赖 escHtml，放在叶子里可拆掉
 * detail <-> ui 的双向引用。
 */

/** HTML 文本转义 */
export function escHtml(str: unknown): string {
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Object.assign(window, { escHtml });

// 阶段 5B-2 过渡期类型桥：尚未改为 import 的 player 模块仍以裸名访问。
declare global {
  function escHtml(str: unknown): string;
}
