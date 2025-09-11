# LeLeTV 项目概述 - 任务文档

## 1. 核心架构和基础设置

- [-] 1.1 创建项目目录结构和基础文件
  - File: 项目根目录
  - 完善项目目录结构，确保所有必要文件夹存在
  - 创建.gitignore文件，按照业内标准排除不需要版本控制的文件
  - 初始化package.json文件，定义项目依赖和脚本
  - _Leverage: 现有的项目结构和.gitignore文件_\r
  - _Requirements: 所有需求_\r
  - _Prompt: Role: 前端架构师 | Task: 完善项目目录结构，创建基础配置文件，确保符合现代前端项目标准 | Restrictions: 保持现有项目的核心文件不变，只补充缺失的基础配置 | Success: 项目结构清晰，基础配置完整，能支持后续开发_\r

- [ ] 1.2 整合Tailwind CSS和自定义样式系统
  - File: index.html, css/styles.css
  - 在HTML中正确引入Tailwind CSS和自定义样式文件
  - 配置Tailwind CSS自定义主题和工具类
  - 创建通用的响应式布局样式
  - _Leverage: 现有的HTML文件和css文件夹_\r
  - _Requirements: 1.1, 1.2_\r
  - _Prompt: Role: UI设计师 | Task: 整合Tailwind CSS和自定义样式，创建简约、高端、雅致的界面风格 | Restrictions: 遵循简约设计原则，保持代码整洁 | Success: 样式系统整合完成，界面风格一致，响应式设计有效_\r

- [ ] 1.3 创建模块化JavaScript架构
  - File: js/app.js, js/*.js
  - 设计并实现模块化的JavaScript代码结构
  - 定义清晰的模块依赖关系和导出接口
  - 实现核心应用初始化逻辑
  - _Leverage: 现有的app.js文件和js文件夹_\r
  - _Requirements: 1.1, 1.2_\r
  - _Prompt: Role: JavaScript开发者 | Task: 重构和优化JavaScript代码结构，实现模块化设计 | Restrictions: 保持现有功能不变，提高代码可维护性 | Success: 代码模块化程度高，依赖关系清晰，功能正常_\r

## 2. 数据源管理和API集成

- [ ] 2.1 实现多数据源管理系统
  - File: js/api.js, js/loadBalancer.js
  - 设计和实现API数据源配置和管理功能
  - 创建数据源选择界面和逻辑
  - 实现数据源优先级排序和切换机制
  - _Leverage: 现有的API管理相关代码_\r
  - _Requirements: 1.3_\r
  - _Prompt: Role: API集成工程师 | Task: 实现多数据源管理系统，支持数据源的选择和配置 | Restrictions: 确保数据源切换对用户透明，保持系统稳定性 | Success: 用户可以选择多个数据源，系统能智能切换数据源_\r

- [ ] 2.2 开发负载均衡和故障转移机制
  - File: js/loadBalancer.js, js/loadBalancerUI.js
  - 实现请求负载均衡算法
  - 设计和开发故障检测和自动转移功能
  - 创建负载均衡监控和配置界面
  - _Leverage: 现有的负载均衡相关代码_\r
  - _Requirements: 1.3_\r
  - _Prompt: Role: 系统架构师 | Task: 开发负载均衡和故障转移机制，提高系统可靠性 | Restrictions: 不影响用户体验，保持高性能 | Success: 负载均衡有效分发请求，故障时自动切换，用户体验不受影响_\r

- [ ] 2.3 实现代理服务和API请求封装
  - File: api/proxy/[...path].mjs, functions/proxy/[[path]].js
  - 创建代理服务，处理跨域请求
  - 封装API请求函数，统一处理请求和响应
  - 实现请求重试和超时处理机制
  - _Leverage: 现有的代理相关代码_\r
  - _Requirements: 1.3_\r
  - _Prompt: Role: 后端开发工程师 | Task: 实现代理服务和API请求封装，保护API密钥和处理跨域 | Restrictions: 确保请求安全性，保持低延迟 | Success: 代理服务运行稳定，API请求封装易用，请求安全高效_\r

## 3. 用户界面和交互组件

- [ ] 3.1 设计和实现主页面布局
  - File: index.html, js/index-page.js
  - 创建响应式主页面布局，适配不同设备
  - 实现导航菜单和页面跳转逻辑
  - 开发搜索框和搜索历史功能
  - _Leverage: 现有的index.html和index-page.js文件_\r
  - _Requirements: 1.1, 1.2_\r
  - _Prompt: Role: UI/UX设计师 | Task: 设计并实现简约、高端的主页面布局，提供良好的用户体验 | Restrictions: 遵循设计文档，保持界面简洁美观 | Success: 主页面布局合理，响应式适配良好，交互流畅_\r

- [ ] 3.2 开发历史记录管理功能
  - File: js/ui.js, index.html
  - 实现观看历史的记录、显示和清除功能
  - 创建历史记录面板和交互界面
  - 开发历史记录排序和过滤功能
  - _Leverage: 现有的历史记录相关代码_\r
  - _Requirements: 1.4_\r
  - _Prompt: Role: 前端开发工程师 | Task: 开发完整的历史记录管理功能，包括记录、显示和清除 | Restrictions: 确保数据存储安全，界面交互友好 | Success: 历史记录功能完整，用户可以方便地管理观看历史_\r

- [ ] 3.3 实现设置面板和用户偏好管理
  - File: js/app.js, index.html
  - 创建设置面板界面，包括数据源、播放设置等
  - 实现设置的保存、加载和重置功能
  - 开发自定义API添加和管理功能
  - _Leverage: 现有的设置相关代码_\r
  - _Requirements: 1.3, 1.4_\r
  - _Prompt: Role: 全栈开发工程师 | Task: 实现设置面板和用户偏好管理功能，支持自定义配置 | Restrictions: 保持设置界面简洁，配置项易于理解 | Success: 设置面板功能完整，用户可以方便地配置系统_\r

## 4. 播放功能和体验

- [ ] 4.1 集成和定制视频播放器
  - File: player.html, js/player.js, libs/artplayer.min.js
  - 集成ArtPlayer播放器库
  - 实现播放器控制和自定义界面
  - 开发播放进度保存和恢复功能
  - _Leverage: 现有的播放器相关代码_\r
  - _Requirements: 1.2_\r
  - _Prompt: Role: 视频技术专家 | Task: 集成和定制视频播放器，提供流畅的播放体验 | Restrictions: 确保播放器兼容性，优化加载速度 | Success: 播放器功能完整，播放流畅，界面美观_\r

- [ ] 4.2 实现HLS流媒体播放支持
  - File: js/player.js, libs/hls.min.js
  - 集成HLS.js库，支持HLS流媒体播放
  - 实现自适应码率切换功能
  - 开发清晰度选择和切换逻辑
  - _Leverage: 现有的HLS相关代码_\r
  - _Requirements: 1.2_\r
  - _Prompt: Role: 流媒体技术专家 | Task: 实现HLS流媒体播放支持，优化流媒体播放体验 | Restrictions: 确保流媒体播放稳定，减少缓冲 | Success: HLS流媒体播放流畅，自适应码率切换有效_\r

- [ ] 4.3 开发观看页面和剧集选择功能
  - File: watch.html, js/watch.js
  - 创建观看页面布局和交互界面
  - 实现剧集列表和选集功能
  - 开发观看进度记录和恢复功能
  - _Leverage: 现有的watch.html和watch.js文件_\r
  - _Requirements: 1.2, 1.4_\r
  - _Prompt: Role: 前端开发工程师 | Task: 开发观看页面和剧集选择功能，提供良好的观看体验 | Restrictions: 界面简洁直观，交互流畅 | Success: 观看页面功能完整，用户可以方便地选择和观看剧集_\r

## 5. 安全和权限管理

- [ ] 5.1 实现密码保护和访问控制
  - File: js/password.js, js/sha256.js
  - 开发管理员密码设置和验证功能
  - 实现密码哈希存储和比较逻辑
  - 创建密码输入和验证界面
  - _Leverage: 现有的密码相关代码_\r
  - _Requirements: 1.5_\r
  - _Prompt: Role: 安全工程师 | Task: 实现密码保护和访问控制功能，确保系统安全性 | Restrictions: 遵循安全最佳实践，保护用户数据 | Success: 密码保护有效，只有授权用户可以访问管理功能_\r

- [ ] 5.2 开发内容过滤和访问控制机制
  - File: js/app.js
  - 实现内容分类和过滤功能
  - 开发年龄限制和内容分级机制
  - 创建内容过滤配置界面
  - _Leverage: 现有的应用逻辑代码_\r
  - _Requirements: 1.5_\r
  - _Prompt: Role: 安全产品经理 | Task: 开发内容过滤和访问控制机制，保护用户免受不当内容影响 | Restrictions: 确保过滤准确，配置灵活 | Success: 内容过滤功能有效，用户可以根据需要配置访问控制_\r

- [ ] 5.3 实现代理认证和安全请求处理
  - File: js/proxy-auth.js, api/proxy/[...path].mjs
  - 开发代理请求认证机制
  - 实现请求频率限制和防爬虫措施
  - 创建代理安全日志和监控功能
  - _Leverage: 现有的代理和安全相关代码_\r
  - _Requirements: 1.5_\r
  - _Prompt: Role: 网络安全工程师 | Task: 实现代理认证和安全请求处理，保护API安全 | Restrictions: 确保安全措施不影响正常用户体验 | Success: 代理安全机制有效，API受到保护，正常用户访问不受影响_\r

## 6. 性能优化和缓存策略

- [ ] 6.1 开发缓存管理系统
  - File: js/cache-manager.js
  - 实现资源缓存和过期机制
  - 开发缓存大小控制和清理功能
  - 创建缓存策略配置界面
  - _Leverage: 现有的缓存相关代码_\r
  - _Requirements: 1.6_\r
  - _Prompt: Role: 性能优化工程师 | Task: 开发缓存管理系统，提高系统响应速度和用户体验 | Restrictions: 确保缓存一致性，避免内存占用过高 | Success: 缓存系统有效提高加载速度，资源利用合理_\r

- [ ] 6.2 实现图片懒加载和优化
  - File: js/ui.js, css/styles.css
  - 开发图片懒加载功能，提高页面加载速度
  - 实现图片压缩和格式优化
  - 创建图片预加载和错误处理机制
  - _Leverage: 现有的UI和样式代码_\r
  - _Requirements: 1.6_\r
  - _Prompt: Role: 前端性能优化专家 | Task: 实现图片懒加载和优化，提高页面性能 | Restrictions: 确保图片质量，优化加载体验 | Success: 图片加载优化有效，页面加载速度提升_\r

- [ ] 6.3 开发PWA支持和离线功能
  - File: manifest.json, service-worker.js
  - 配置PWA清单文件和服务工作线程
  - 实现基本的离线访问功能
  - 开发应用安装和更新机制
  - _Leverage: 现有的PWA相关文件_\r
  - _Requirements: 1.6_\r
  - _Prompt: Role: PWA专家 | Task: 开发PWA支持和离线功能，提升用户体验和可访问性 | Restrictions: 确保离线功能的实用性，优化资源占用 | Success: PWA功能完整，用户可以在离线状态下访问部分内容_\r

## 7. 测试和部署

- [ ] 7.1 编写单元测试和集成测试
  - File: 项目根目录
  - 为核心功能模块编写单元测试
  - 开发集成测试，验证模块间交互
  - 创建测试覆盖率报告
  - _Requirements: 所有功能需求_\r
  - _Prompt: Role: 测试工程师 | Task: 编写全面的单元测试和集成测试，确保代码质量 | Restrictions: 测试覆盖核心功能，确保测试稳定性 | Success: 测试覆盖主要功能，测试通过率高，代码质量得到保障_\r

- [ ] 7.2 实现CI/CD流水线
  - File: .github/workflows/*
  - 配置GitHub Actions自动化测试和构建流程
  - 实现自动版本更新和发布机制
  - 开发部署前的质量检查脚本
  - _Leverage: 现有的GitHub工作流文件_\r
  - _Requirements: 所有功能需求_\r
  - _Prompt: Role: DevOps工程师 | Task: 实现CI/CD流水线，自动化测试、构建和发布流程 | Restrictions: 确保流水线稳定，自动化流程可靠 | Success: CI/CD流水线运行正常，自动化流程高效可靠_\r

- [ ] 7.3 优化项目文档和用户指南
  - File: README.md, CONTRIBUTING.md
  - 编写项目说明文档和使用指南
  - 开发API文档和技术参考
  - 创建版本更新日志和发布说明
  - _Leverage: 现有的文档文件_\r
  - _Requirements: 所有功能需求_\r
  - _Prompt: Role: 技术文档工程师 | Task: 优化项目文档和用户指南，提高项目可维护性和用户体验 | Restrictions: 文档内容准确，格式规范 | Success: 文档完整详细，用户可以方便地了解和使用项目_\r
