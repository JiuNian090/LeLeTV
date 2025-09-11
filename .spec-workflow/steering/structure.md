# 项目结构

## 目录组织

```
LeLeTV/
├── api/                    # API代理相关文件
│   └── proxy/             # 代理实现
├── css/                    # 样式文件
│   ├── index.css          # 首页样式
│   ├── player.css         # 播放器页面样式
│   ├── styles.css         # 通用样式
│   └── watch.css          # 观看页面样式
├── functions/              # Cloudflare Functions
│   ├── proxy/             # 代理函数
│   └── _middleware.js     # 中间件
├── js/                     # JavaScript文件
│   ├── api.js             # API相关功能
│   ├── app.js             # 主应用逻辑
│   ├── cache-manager.js   # 缓存管理
│   ├── config.js          # 配置文件
│   ├── customer_site.js   # 自定义站点配置
│   ├── douban.js          # 豆瓣相关功能
│   ├── index-page.js      # 首页功能
│   ├── lazy-loading.js    # 懒加载实现
│   ├── loadBalancer.js    # 负载均衡器
│   ├── loadBalancerUI.js  # 负载均衡UI
│   ├── password.js        # 密码验证
│   ├── player.js          # 播放器功能
│   ├── proxy-auth.js      # 代理认证
│   ├── pwa-register.js    # PWA注册
│   ├── search.js          # 搜索功能
│   ├── sha256.js          # SHA256加密
│   ├── ui.js              # UI相关功能
│   ├── version-check.js   # 版本检查
│   ├── version-utils.js   # 版本工具
│   └── watch.js           # 观看页面逻辑
├── libs/                   # 第三方库
│   └── sha256.min.js      # SHA256加密库
├── scripts/                # 脚本文件
│   ├── changelog-updater.js # 更新日志更新器
│   ├── update-all-versions.js # 所有版本更新
│   ├── update-version.js   # 版本更新
│   └── version-tracker.js  # 版本跟踪
├── .spec-workflow/         # 规范工作流文件
├── assets/                 # 静态资源
├── docs/                   # 文档
├── tests/                  # 测试文件
└── [build/dist]           # 构建输出（如果有的话）
```

## 命名约定

### 文件
- **组件/模块**: `kebab-case`（例如：`lazy-loading.js`）
- **服务/处理器**: `kebab-case`（例如：`load-balancer.js`）
- **工具/助手**: `kebab-case`（例如：`version-utils.js`）
- **测试**: `[filename].test.js`（例如：`api.test.js`）

### 代码
- **类/类型**: `PascalCase`（例如：`LazyLoader`）
- **函数/方法**: `camelCase`（例如：`initAPICheckboxes`）
- **常量**: `UPPER_SNAKE_CASE`（例如：`API_CONFIG`）
- **变量**: `camelCase`（例如：`selectedAPIs`）

## 导入模式

### 导入顺序
1. 外部依赖（第三方库）
2. 内部模块（项目内其他模块）
3. 相对导入（同目录或子目录文件）
4. 样式导入

### 模块/包组织
- 绝对导入从项目根目录开始
- 相对导入用于同一模块内的文件
- 按功能分组组织模块
- 依赖管理采用npm包管理

## 代码结构模式

### 模块/类组织
1. 导入/依赖
2. 常量和配置
3. 类型/接口定义
4. 主要实现
5. 辅助/工具函数
6. 导出/公共API

### 函数/方法组织
- 输入验证优先
- 核心逻辑在中间
- 错误处理贯穿始终
- 清晰的返回点

### 文件组织原则
- 每个文件有一个明确的目的
- 相关功能组合在一起
- 公共API在文件顶部
- 实现细节隐藏在文件内部

## 代码组织原则

1. **单一职责**: 每个文件应该有一个明确的目的
2. **模块化**: 代码应该组织成可重用的模块
3. **可测试性**: 结构化代码以便于测试
4. **一致性**: 遵循代码库中建立的模式

## 模块边界

- **核心功能 vs 扩展功能**: 核心视频播放功能 vs 扩展特性（如豆瓣推荐）
- **公共API vs 内部实现**: 导出的公共函数 vs 内部实现细节
- **稳定功能 vs 实验功能**: 生产代码 vs 实验性特性
- **依赖方向**: 前端模块可以依赖工具模块，但工具模块不应依赖前端模块

## 代码大小指南

- **文件大小**: 单个文件不超过500行
- **函数/方法大小**: 单个函数不超过50行
- **类/模块复杂度**: 类的公共方法不超过20个
- **嵌套深度**: 最大嵌套层级不超过4层

## 仪表板/监控结构

### 示例结构:
```
LeLeTV/
├── js/                    # 主要JavaScript功能
│   └── ui.js             # UI相关功能（包含仪表板元素）
└── css/                  # 样式文件
    └── styles.css        # 包含仪表板样式
```

### 关注点分离
- UI组件与核心业务逻辑分离
- 仪表板功能可以独立于核心功能工作
- 最小化对主应用的依赖
- 可以禁用而不影响核心功能

## 文档标准
- 所有公共API必须有文档
- 复杂逻辑应包含内联注释
- 主要模块应有README文件
- 遵循JavaScript文档约定