# 创建 GitHub Releases 的 PowerShell 脚本
# 需要先安装 GitHub CLI: https://cli.github.com/

# 检查是否安装了 GitHub CLI
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未找到 GitHub CLI (gh 命令)"
    Write-Host "请先安装 GitHub CLI: https://cli.github.com/"
    exit 1
}

# 登录 GitHub CLI (如果尚未登录)
# gh auth login

# 为每个版本创建 Release
$releases = @(
    @{
        tag = "v1.9.11.10"
        title = "v1.9.11.10"
        notes = @"
# Release v1.9.11.10

## 更新内容

- [其他] 增强自动标签工作流，添加提交信息和详情获取
- 在自动标签GitHub工作流中新增步骤，获取最新提交的完整内容
- 提取提交作者和提交时间信息，并设置输出变量便于后续使用
- 修改发布说明内容，新增提交信息显示模块
- 在Release页面增加提交作者和提交时间的详细展示
- 删除原有从CHANGELOG提取更新日志的冗余代码，优化工作流程逻辑。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    },
    @{
        tag = "v1.9.11.9"
        title = "v1.9.11.9"
        notes = @"
# Release v1.9.11.9

## 更新内容

- [其他] 优化自动打标签和发布工作流
- 添加了权限配置，允许写入内容权限
- 替换发布Action为ncipollo/release-action@v1
- 调整发布步骤参数：tag_name改为tag，release_name改为name
- 精简了自动发布流程的环境变量配置
- 保持发布说明格式统一。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    },
    @{
        tag = "v1.9.11.8"
        title = "v1.9.11.8"
        notes = @"
# Release v1.9.11.8

## 更新内容

- [其他] 实现自动打标签并创建发布版本
- 修改工作流名称为 "Auto Tag and Release" ，扩展功能包括自动创建 GitHub Release
- 在执行打标签脚本后，提取最新版本号与更新日志信息，设置为输出参数
- 添加发布任务，利用 actions/create-release@v1 发布对应版本的 Release
- 脚本中增加正则匹配判断版本号的健壮性
- 在标签创建前检查标签是否已存在，避免重复创建
- 输出版本号和更新日志供 GitHub Actions 后续步骤使用
- 对更新日志内容进行转义处理，防止 GitHub Actions 解析异常。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    },
    @{
        tag = "v1.9.11.7"
        title = "v1.9.11.7"
        notes = @"
# Release v1.9.11.7

## 更新内容

- [其他] 移除图片懒加载模块及相关代码
- 删除js/lazy-loading.js文件，彻底移除懒加载实现
- 移除index.html、about.html、player.html中懒加载脚本引用
- 删除css/styles.css中懒加载相关样式定义
- 修改player.js中图片标签由懒加载改为直接加载，移除懒加载刷新调用
- 删除app.js和ui.js中调用懒加载刷新观察器的代码
- 保持代码一致性，简化页面加载流程和图片加载逻辑。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    },
    @{
        tag = "v1.9.11.6"
        title = "v1.9.11.6"
        notes = @"
# Release v1.9.11.6

## 更新内容

- [文档] 更新文档完善环境变量配置与项目说明
- 完善 CONTRIBUTING.md 中环境变量设置说明，新增 ADMINPASSWORD 支持
- 补充 README.md 环境变量配置、功能特性和目录结构详细信息
- 优化 VERSION_RULES.md 版本号规则说明，增加自动标签创建等内容
- 删除 OPTIMIZATION_SUGGESTIONS.md 中图片懒加载建议，更新性能优化策略
- 修正 README.md 中图片大小和项目技术栈描述
- 修改 js/douban.js 和 js/app.js 中豆瓣功能默认状态为启用。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    },
    @{
        tag = "v1.9.11.5"
        title = "v1.9.11.5"
        notes = @"
# Release v1.9.11.5

## 更新内容

- [其他] 优化隐藏内容过滤相关提示和文案。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    },
    @{
        tag = "v1.9.11.4"
        title = "v1.9.11.4"
        notes = @"
# Release v1.9.11.4

## 更新内容

- [其他]
- 保持原有功能与用户体验一致，修正文字表述更准确。

---
发布于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
    }
)

foreach ($release in $releases) {
    Write-Host "正在为标签 $($release.tag) 创建 Release..."
    
    # 将 Release notes 保存到临时文件
    $tempFile = [System.IO.Path]::GetTempFileName()
    $release.notes | Out-File -FilePath $tempFile -Encoding UTF8
    
    # 创建 Release
    $cmd = "gh release create `"$($release.tag)`" --title `"$($release.title)`" --notes-file `"$tempFile`""
    Write-Host "执行命令: $cmd"
    Invoke-Expression $cmd
    
    # 删除临时文件
    Remove-Item $tempFile
    
    Write-Host "已完成标签 $($release.tag) 的 Release 创建`n"
    Start-Sleep -Seconds 2  # 避免 API 限制
}

Write-Host "所有 Release 创建完成！"