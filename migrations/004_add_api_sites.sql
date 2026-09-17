-- 数据源配置表：把原先写死在 js/core/config.js 的采集源搬到 D1，通过 Worker 的 /admin 面板维护
--
-- 背景：内置源（API_SITES）是构建期常量，加一个源就得改 config.js 并重新 build。
-- 改造后源配置存这里，前端启动时拉取 GET /api-sites 合并（内置源仍是永久兜底）。
--
-- 字段说明：
--   source_key  前端 API_SITES 的 key，也是用户 localStorage selectedAPIs 里存的值。
--               **创建后不可修改** —— 改了 key 等于换了一个源，所有用户原先勾选的记录会失效。
--               与内置源同名（例如 bdzy）即为覆盖内置源。
--   name        设置页显示的源名称
--   api         采集接口地址（前端会拼 ?ac=videolist&wd=xxx）
--   detail      可选，详情接口地址；留空表示与 api 相同
--   hidden      1 = 私密源（18+），只在隐藏内容模式下可见，且不通过公开接口下发
--   enabled     0 = 停用（保留记录但不下发给前端），1 = 启用
--   sort_order  面板中的排序，越小越靠前
CREATE TABLE IF NOT EXISTS api_sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  api TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- 公开接口的查询条件就是 (enabled, hidden)，直接建复合索引
CREATE INDEX IF NOT EXISTS idx_api_sites_enabled ON api_sites(enabled, hidden, sort_order);
