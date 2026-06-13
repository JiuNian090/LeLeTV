/**
 * LeLeTV 主页面入口
 * 导入应用主模块和 Vue 渐进式迁移模块，触发初始化
 */

import './ui/app/app';
import './core/leletv-global';
import './ui/components/version-updater';

// Vue 渐进式迁移：初始化 Pinia
import { getPinia, mountVueComponent } from './vue/setup';
import AboutPanel from './vue/components/AboutPanel.vue';
import SettingsPanel from './vue/components/SettingsPanel.vue';
import SearchHistoryDropdown from './vue/components/SearchHistoryDropdown.vue';
import SearchBar from './vue/components/SearchBar.vue';
import SearchResultGrid from './vue/components/SearchResultGrid.vue';
import TmdbCategory from './vue/components/TmdbCategory.vue';
import ViewingHistory from './vue/components/ViewingHistory.vue';

// 提前创建全局 Pinia 实例
getPinia();

// 挂载 Vue 组件到指定容器（绞杀者模式）
mountVueComponent(AboutPanel, '#page-about');
mountVueComponent(SettingsPanel, '#page-settings');
mountVueComponent(SearchHistoryDropdown, '#searchHistoryDropdown');
mountVueComponent(SearchBar, '#searchArea');
mountVueComponent(SearchResultGrid, '#resultsArea');
mountVueComponent(TmdbCategory, '#page-category');
mountVueComponent(ViewingHistory, '#page-history');

console.log('[LeLeTV] Main entry loaded, Vue components mounted');
