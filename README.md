<div align="center">

# Hummingbird MD

一款清爽好用的 VS Code Markdown 阅读器

[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

![文档预览](/media/preview-main.png)
![设置面板](/media/preview-setting.png)

</div>

## 它能做什么？

告别 VS Code 自带预览器的单调渲染——Hummingbird MD 把你的 Markdown 文件变成一份排版精良、赏心悦目的阅读体验。

## 功能一览

### 代码高亮

基于 [Shiki](https://shiki.style/) 的精确语法高亮，和 VS Code 编辑器使用同款 TextMate 语法引擎。亮色 / 暗色主题自动切换，代码块 hover 显示一键复制按钮。

### 目录导航

侧边栏自动生成文档目录树。点击标题跳转定位，阅读时实时高亮当前位置。长文档的好帮手。

### Mermaid 图表

流程图、时序图、甘特图、类图……用 Mermaid 语法写的图表直接渲染出来，点击还能全屏查看。

### 图片查看器

点击任意图片进入全屏模式——放大、缩小、旋转、拖拽，前后切换同一文档中的所有图片。

### 15 款主题风格

不只是亮色和暗色——内置 **Classic、GitHub、Vue、Minimal、Dracula、Solarized、Nord、Gruvbox、Catppuccin、Everforest、Rosé Pine、One Dark、Notion、Ayu、Flexoki** 共 15 款配色方案，每款都有亮色和暗色版本。总有一款适合你的口味。

### 阅读样式定制

在侧边栏的设置面板中可以调整：

- **字体选择**——自动检测当前操作系统，只显示已安装的系统字体（macOS 的苹方 / SF Mono，Windows 的微软雅黑 / Consolas 等），也支持手动输入自定义字体
- 字体大小、字重
- 行高、段落间距

所有设置自动保存，下次打开继续生效。

### 文档信息

侧边栏底部展示文档字数、字符数、段落数、文件大小、路径和日期信息，点击路径可一键复制。

## 怎么用？

有三种方式打开预览：

1. **编辑器工具栏** — 打开 `.md` 文件，点击右上角的蜂鸟图标
2. **文件资源管理器** — 右键 `.md` 文件，选择「Preview in Hummingbird MD」
3. **命令面板** — `Ctrl/Cmd + Shift + P`，输入 `Hummingbird MD`

## 技术栈

[markdown-it](https://github.com/markdown-it/markdown-it) + [Shiki](https://shiki.style/) + [Mermaid](https://mermaid.js.org/)，基于 VS Code Webview 双面板架构（阅读器 + TOC 侧边栏），esbuild 三入口并行构建。

## 许可证

[MIT](LICENSE)
