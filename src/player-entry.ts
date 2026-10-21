/**
 * leletv-player 的 ESM 入口（阶段 5B-5：替代 build.config.js 的 files 清单）。
 * 导入顺序即播放器初始化的副作用顺序，与迁移前的 bundle 清单一致。
 * 放在 src 根：入口同时引用 services / ui，不属于任何单层模块。
 */
import './services/api';
import './services/search';
import './services/viewing-history';

import './ui/player/utils';
import './ui/player/navigation';
import './ui/player/manager';
import './ui/player/shortcuts';
import './ui/player/core';
import './ui/player/episodes';
import './ui/player/ui';
import './ui/player/failover';
import './ui/player/lights';
import './ui/player/detail';
import './ui/player/quality';
import './ui/player/index';

import './services/version-updater';
import './core/cache';
