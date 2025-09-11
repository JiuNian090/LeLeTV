# LeLeTV 项目概述 - 设计文档

## 1. 概述
LeLeTV是一个现代化的视频流媒体平台，提供多数据源聚合、流畅播放体验和用户友好的界面。本设计文档详细描述了系统架构、组件设计、数据模型和技术实现方案。

## 2. 技术标准对齐
- **前端框架**：纯HTML/CSS/JavaScript实现，无依赖重型前端框架
- **样式系统**：Tailwind CSS v3 + 自定义CSS样式
- **播放器**：ArtPlayer + HLS.js
- **数据存储**：localStorage (用户设置、观看历史) + 外部API (视频内容)
- **代码规范**：模块化设计，组件化结构，分离关注点
- **安全标准**：密码哈希存储，代理请求保护，权限控制
- **性能标准**：响应式设计，懒加载，缓存策略，负载均衡

## 3. 代码复用分析
- **核心组件**：播放器组件、搜索组件、导航组件可在不同页面复用
- **工具函数库**：API请求处理、缓存管理、SHA256加密可作为独立模块复用
- **样式模块**：模态框、加载动画、响应式布局可跨页面复用
- **数据处理**：数据源管理、负载均衡策略可在不同API调用场景复用

## 4. 架构
### 4.1 整体架构
- **前端层**：HTML/CSS/JavaScript提供用户界面和交互体验
- **代理层**：中间件处理跨域请求，保护API密钥
- **数据层**：外部视频API + 本地存储
- **服务层**：Node.js服务器提供代理服务和API路由

### 4.2 主要模块划分
- **核心应用模块**：`app.js`负责整体应用逻辑协调
- **API模块**：`api.js`和`loadBalancer.js`处理数据源选择和请求分发
- **UI模块**：`ui.js`和`index-page.js`管理界面交互
- **播放器模块**：`player.js`封装播放逻辑
- **安全模块**：`password.js`和`proxy-auth.js`处理认证和授权
- **缓存模块**：`cache-manager.js`实现资源缓存策略

## 5. 组件接口
### 5.1 播放器组件
- **功能**：视频播放、进度控制、清晰度切换
- **接口**：
  - `initPlayer(videoUrl, options)`: 初始化播放器
  - `loadVideo(source)`: 加载视频源
  - `play()`, `pause()`, `seek(time)`: 播放控制方法
- **事件**：`onPlay`, `onPause`, `onEnded`, `onError`

### 5.2 搜索组件
- **功能**：搜索视频内容，过滤结果
- **接口**：
  - `search(keyword, filters)`: 执行搜索
  - `clearSearch()`: 清除搜索结果
  - `saveSearchHistory(keyword)`: 保存搜索历史
- **参数**：关键字、类型过滤、排序方式

### 5.3 导航组件
- **功能**：页面导航，菜单切换
- **接口**：
  - `toggleMenu()`: 切换菜单显示状态
  - `navigateTo(page)`: 导航到指定页面
  - `updateNavState(state)`: 更新导航状态
- **响应式适配**：移动端底部菜单，桌面端顶部导航

### 5.4 设置面板组件
- **功能**：管理用户偏好设置
- **接口**：
  - `loadSettings()`: 加载设置
  - `saveSettings(settings)`: 保存设置
  - `resetSettings()`: 重置设置
- **设置项**：数据源选择、播放设置、界面主题

### 5.5 历史记录组件
- **功能**：记录和显示观看历史
- **接口**：
  - `addHistoryItem(item)`: 添加历史记录
  - `getHistoryList()`: 获取历史列表
  - `clearHistory()`: 清除历史记录
- **数据结构**：标题、URL、时间戳、进度

## 6. 数据模型
### 6.1 用户设置
```javascript
{
  selectedAPIs: string[],     // 选中的API数据源
  customAPIs: Array<{         // 自定义API配置
    name: string,
    url: string,
    enabled: boolean
  }>,
  playerSettings: {
    defaultQuality: string,
    autoplay: boolean,
    subtitles: boolean
  },
  theme: string,
  proxyEnabled: boolean,
  loadBalancerEnabled: boolean
}
```

### 6.2 观看历史
```javascript
{
  id: string,
  title: string,
  url: string,
  cover: string,
  timestamp: number,
  progress: number,
  source: string
}
```

### 6.3 视频信息
```javascript
{
  id: string,
  title: string,
  description: string,
  cover: string,
  category: string,
  year: number,
  rating: number,
  episodes: Array<{
    id: string,
    title: string,
    url: string,
    quality: string
  }>
}
```

### 6.4 API配置
```javascript
{
  name: string,
  url: string,
  priority: number,
  timeout: number,
  reliability: number,
  enabled: boolean
}
```

## 7. 错误处理
- **网络错误**：API请求失败时显示重试选项，切换备用数据源
- **播放错误**：视频播放失败时提供错误信息，尝试其他清晰度或数据源
- **认证错误**：密码验证失败时提供清晰反馈，限制重试次数
- **数据解析错误**：处理API返回格式异常，提供友好的错误提示

## 8. 测试策略
- **单元测试**：对核心函数如API请求、缓存管理、密码哈希进行测试
- **集成测试**：测试模块间交互，如播放器与数据源选择的协同工作
- **UI测试**：测试响应式布局在不同设备上的表现
- **性能测试**：评估加载速度、内存占用、缓存命中率

## 9. 部署与发布
- **构建流程**：静态资源优化，代码压缩
- **部署方式**：支持Vercel、Netlify等平台一键部署
- **版本控制**：遵循语义化版本规范，自动更新版本号
- **CI/CD**：GitHub Actions自动化测试、构建和发布

## 10. 其他设计考量
- **PWA支持**：实现渐进式Web应用功能，支持离线访问
- **可访问性**：符合WCAG标准，支持键盘导航和屏幕阅读器
- **国际化**：预留多语言支持框架
- **扩展性**：模块化设计便于功能扩展和维护
