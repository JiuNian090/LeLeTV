/**
 * 测试自动发布逻辑的脚本
 * 用于验证新的自动标签和发布流程
 */

import fs from 'fs';

// 模拟 CHANGELOG.md 内容
const testChangelog = `# 更新日志

所有项目的显著更改都将记录在此文件中。

## 自动标签功能

每次提交代码时，如果提交信息中包含 \`@CHANGELOG.md\`，系统会自动从 CHANGELOG.md 中提取最新版本号创建 Git 标签，并推送到 GitHub 仓库。

## 版本历史

### v1.9.11.17 (2025-09-11 20:00)
- [测试] 验证新的自动发布逻辑
- 测试从 CHANGELOG.md 提取版本号和更新内容
- 验证标签创建和 Release 发布流程

### v1.9.11.16 (2025-09-11 19:30)
- [其他] 重新修改 release 和 tag 的自动更新逻辑
- 修改了触发条件：只有当提交信息包含 @CHANGELOG.md 时才执行自动标签和发布
- 优化了版本号和更新内容的提取逻辑，直接从 CHANGELOG.md 中获取
- 改进了标签存在性检查，避免重复创建
- 确保每次提交的 release 自动变为 latest

`;

// 将测试内容写入 CHANGELOG.md（备份原文件）
if (fs.existsSync('CHANGELOG.md')) {
  fs.copyFileSync('CHANGELOG.md', 'CHANGELOG.md.backup');
}

fs.writeFileSync('CHANGELOG.md', testChangelog, 'utf8');
console.log('已创建测试用的 CHANGELOG.md 文件');

// 模拟提交包含 @CHANGELOG.md 的提交信息
console.log('模拟 git commit -m "Update features @CHANGELOG.md"');
console.log('接下来 GitHub Actions 将会:');
console.log('1. 检测到提交信息包含 @CHANGELOG.md');
console.log('2. 从 CHANGELOG.md 提取最新版本号: v1.9.11.17');
console.log('3. 提取该版本的更新内容');
console.log('4. 检查标签是否存在，如果不存在则创建标签');
console.log('5. 创建 Release 并设置为 latest');