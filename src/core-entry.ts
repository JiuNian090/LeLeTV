/**
 * leletv-core 的 ESM 入口（阶段 5B-5：替代 build.config.js 的 files 清单）。
 * 导入顺序即副作用求值顺序，与迁移前的 bundle 清单一致，禁止随意调整。
 */
import './ui/modals';

// remote-sources 必须排在 config 之后（依赖 API_SITES / extendAPISites / isHiddenContentMode），
// 且要在 app 与 player 之前（两个页面启动时都会调用它）
import './core/config';
import './services/sources/remote';

import './core/global';
import './core/storage';

// 旧播放页地址迁移必须在页面启动前跑
import './services/migrate-player-url';

import './core/listener-tracker';
import './core/timing';
import './core/http';
import './core/crypto';
import './services/invitation';

// 模态框 / Toast 必须在 ui/toast 之前注入：toast 初始化时会查找 #toast / #modal
import './ui/toast';
import './ui/motion-pref';
import './services/line-probe';
