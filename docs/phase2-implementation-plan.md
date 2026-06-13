# Phase 2 实施计划 — 渐进式 Vue 3 迁移

> 基于 `docs/重构计划.md` 的 Phase 2 路线图细化
> 策略：绞杀者模式（Strangler Fig Pattern）— Vue 组件逐步替换原生 UI

---

## 第一步：技术栈安装与配置

### 1.1 安装依赖

```bash
npm install vue@latest
npm install -D @vitejs/plugin-vue
npm install pinia vue-router@4
```

### 1.2 更新 Vite 配置

`vite.config.ts` 新增 Vue 插件：

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { ... } },
  server: { port: 3000, open: true, proxy: { '/proxy/': { target: 'http://localhost:8080', changeOrigin: true } } },
});
```

### 1.3 tsconfig 补充

确保 `tsconfig.json` 包含 `"jsx": "preserve"` 和 Vue 类型声明。

### 1.4 双架构入口策略

- `index.html`：保留原生 `<div id="app">` 作为 Vue 挂载点，同时保留现有 HTML 结构
- 新建 `src/vue/main.ts`：Vue 应用入口，挂载到 `#app`
- 在 Vue 接管前，所有原生 HTML 照常工作
- 每个 Vue 组件通过 `app.component()` 或 `app.mount()` 挂载到指定 DOM 容器

---

## 第二步：渐进替换顺序（12 步）

### Task 1：关于面板（⭐ 难度）

**目标**：将 `#page-about` 区域替换为 Vue 组件。

**文件**：
- 新建：`src/vue/components/AboutPanel.vue`
- 修改：`index.html`（移除关于面板的原生 HTML，保留容器 `#page-about`）
- 修改：`src/ui/app/app.ts`（移除 `loadAboutPage` 调用）

**子步骤**：
1. 创建 `AboutPanel.vue`，用 Composition API 实现：
   - 读取 `CHANGELOG.md` 并渲染更新日志
   - 显示版本号
   - Markdown 解析逻辑从 `app.ts` 移植
2. 在主入口注册组件，挂载到 `#page-about`
3. 验证：关于页功能与原生版本完全一致

---

### Task 2：设置面板（⭐⭐ 难度）

**目标**：将 `#page-settings` 替换为 Vue 组件。

**文件**：
- 新建：`src/vue/components/SettingsPanel.vue`
- 修改：`src/ui/app/app-config.ts`（API 选择逻辑可复用）
- 修改：`index.html`（移除设置面板原生 HTML）

**子步骤**：
1. 创建 Pinia store `useSettingsStore`：
   - `selectedAPIs: string[]`
   - `customAPIs: CustomApi[]`
   - `adFilteringEnabled: boolean`
   - `hiddenContentEnabled: boolean`
2. 创建 `SettingsPanel.vue`：
   - API 源复选框列表（继承原生逻辑）
   - 自定义 API 管理（增删）
   - 隐藏内容过滤开关 + 管理员密码验证
   - 广告过滤开关
   - 配置导入/导出
3. 双架构同步：确保 Pinia 状态与 localStorage 双向同步
4. 移除 `src/ui/app/app-config.ts` 中已替换的渲染逻辑

---

### Task 3：搜索历史下拉（⭐⭐ 难度）

**目标**：搜索框下方的搜索历史下拉菜单 Vue 化。

**文件**：
- 新建：`src/vue/components/SearchHistoryDropdown.vue`
- 修改：`src/ui/components/search-history.ts`（逻辑可复用）
- 修改：`index.html`（移除搜索历史原生 HTML）

**子步骤**：
1. 创建 Pinia store `useSearchStore`（与搜索相关的状态）
2. 创建 `SearchHistoryDropdown.vue`：
   - 显示最近搜索历史
   - 点击填充搜索框
   - 删除单条 / 清空全部
3. 与搜索栏事件联动

---

### Task 4：Toast 消息（⭐ 难度）

**目标**：全局 Toast 通知 Vue 化。

**文件**：
- 新建：`src/vue/components/ToastContainer.vue`
- 修改：`src/ui/components/toast.ts`（移除 DOM 操作，改为调用 Pinia action）

**子步骤**：
1. 创建 Pinia store `useToastStore`
2. 创建 `ToastContainer.vue`：
   - 支持 success / error / info / warning 类型
   - 自动消失（3s）
   - 多条消息堆叠
   - 入场/出场动画（transition-group）
3. 暴露全局 `showToast()` 供原生 JS 代码调用（保持向后兼容）

---

### Task 5：模态框（⭐⭐ 难度）

**目标**：全局模态框 Vue 化。

**文件**：
- 新建：`src/vue/components/ModalContainer.vue`
- 修改：`src/ui/components/modal.ts`（移除 DOM 操作）

**子步骤**：
1. 创建 Pinia store `useModalStore`：
   - `isOpen: boolean`
   - `title: string`
   - `content: string | Component`（支持渲染自定义组件）
2. 创建 `ModalContainer.vue`：
   - 背景遮罩 + 居中弹窗
   - 标题区域 + 内容区域（slot）
   - 关闭按钮
   - 动画：淡入 + 缩放
3. 暴露 showModal/hideModal 供原生代码调用

---

### Task 6：搜索结果卡片（⭐⭐⭐ 难度）

**目标**：搜索结果卡片列表 Vue 化。

**文件**：
- 新建：`src/vue/components/SearchResultCard.vue`
- 新建：`src/vue/components/SearchResultGrid.vue`
- 新建：`src/vue/components/SourceFilterTabs.vue`
- 修改：`src/ui/app/app-search.ts`（移除渲染逻辑，改为更新 Pinia store）

**子步骤**：
1. 创建 `useSearchStore` 补充：
   - `results: SearchResult[]`
   - `activeFilter: string`
   - `isLoading: boolean`
2. 创建 `SearchResultCard.vue`：
   - 封面图（含 loading 占位 + error fallback）
   - 标题 + 来源名 + 类型标签
   - 点击触发播放（与 data-action 兼容）
3. 创建 `SourceFilterTabs.vue`：
   - 按来源过滤
   - 统计数显示
4. 创建 `SearchResultGrid.vue`：
   - 组合卡片 + 过滤标签
   - 加载状态（skeleton loader）
   - 空状态
   - 错误状态

---

### Task 7：搜索栏（⭐⭐⭐ 难度）

**目标**：搜索输入框 + 搜索按钮 Vue 化。

**文件**：
- 新建：`src/vue/components/SearchBar.vue`
- 修改：`index.html`（移除搜索栏原生 HTML）

**子步骤**：
1. `SearchBar.vue`：
   - 输入框（防抖 300ms）
   - 搜索按钮
   - 清除按钮（输入有内容时显示）
   - 回车触发搜索
   - 移动端全屏搜索覆盖层
   - 与 searchHistoryDropdown 联动

---

### Task 8：TMDB 分类浏览（⭐⭐⭐ 难度）

**目标**：分类浏览页面 Vue 化。

**文件**：
- 新建：`src/vue/components/TmdbCategory.vue`
- 修改：`src/ui/app/app-category.ts`（移除渲染逻辑）

---

### Task 9：观看历史（⭐⭐⭐ 难度）

**目标**：观看历史页面 Vue 化。

**文件**：
- 新建：`src/vue/components/ViewingHistory.vue`
- 修改：`src/services/history.ts`（移除渲染逻辑）

---

### Task 10：导航栏（⭐⭐⭐⭐ 难度）

**目标**：底部导航栏 Vue 化，引入 Vue Router。

**文件**：
- 新建：`src/vue/components/NavBar.vue`
- 新建：`src/vue/router/index.ts`

**子步骤**：
1. 安装 Vue Router（hash 模式）
2. 定义路由：home / category / history / settings / about
3. 页面切换逻辑从 `handleHashChange` 迁移到 Vue Router
4. 导航栏高亮跟随路由自动更新
5. `NavBar.vue` 使用 `<router-link>`

---

### Task 11：播放器控制栏（⭐⭐⭐⭐ 难度）

**目标**：播放器页面的控制元素 Vue 化。

**文件**：
- 新建：`src/vue/components/player/PlayerPage.vue`
- 新建：`src/vue/components/player/EpisodeList.vue`
- 新建：`src/vue/components/player/PlayerControls.vue`

**注意**：ArtPlayer 实例不 Vue 化，通过 ref/event 与 Vue 通信

---

### Task 12：移除所有原生代码（⭐⭐ 难度）

**目标**：清理原生 JS 代码，只保留 Vue 版本。

**文件**：
- 删除：`src/ui/` 目录下的全部渲染逻辑
- 保留：`src/services/` 和 `src/core/` 的逻辑层代码（通过 Pinia 调用）
- 简化：`index.html` 只保留 Vue 挂载点和 script 标签

---

## 验证清单

```
☐ Vue DevTools 可正常调试
☐ 双架构并存无 DOM 冲突
☐ 每个替换后的组件功能与原生版本一致
☐ 路由切换时面板正确显示
☐ 播放页跳转/返回不受 Vue 影响
☐ 所有 data-action 事件委托在 Vue 组件中仍有效
☐ 生产构建体积可接受
☐ 移除所有原生代码后页面正常
☐ TypeScript `strict: true` 零错误
☐ E2E 测试全部通过
```

---

## 目录结构建议

```
src/
├── vue/                          # Vue 相关代码
│   ├── main.ts                   # Vue 应用入口
│   ├── App.vue                   # 根组件
│   ├── router/
│   │   └── index.ts              # Vue Router 配置
│   ├── stores/
│   │   ├── settings.ts           # 设置状态
│   │   ├── search.ts             # 搜索状态
│   │   ├── toast.ts              # Toast 状态
│   │   └── modal.ts              # 模态框状态
│   └── components/
│       ├── AboutPanel.vue
│       ├── SettingsPanel.vue
│       ├── SearchBar.vue
│       ├── SearchHistoryDropdown.vue
│       ├── SearchResultCard.vue
│       ├── SearchResultGrid.vue
│       ├── SourceFilterTabs.vue
│       ├── ToastContainer.vue
│       ├── ModalContainer.vue
│       ├── TmdbCategory.vue
│       ├── ViewingHistory.vue
│       ├── NavBar.vue
│       └── player/
│           ├── PlayerPage.vue
│           ├── EpisodeList.vue
│           └── PlayerControls.vue
├── services/                     # 保持不变（Phase 1 已迁移）
├── core/                         # 保持不变
├── effects/                      # 保持不变
└── types/                        # 保持不变
```

---

## 双架构共存原则

1. **每个 Vue 组件对应一个 DOM 容器**：`<div id="page-about">` 等现有容器不变
2. **Vue 挂载时接管容器**：`app.mount('#page-about')` 替换容器内原生 HTML
3. **未替换的页面仍由原生 JS 控制**：`app.ts` 的路由逻辑逐步退让
4. **通信桥梁**：原生 JS 通过 `window.__VUE_EVENTS__` 或 Pinia store 与 Vue 交互
5. **最终目标**：`index.html` 只有 `<div id="app"><router-view /></div>`
