# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Hummingbird MD 是一个 VSCode Markdown 阅读器插件，提供渲染阅读、目录导航（TOC 侧边栏）、图片查看器、Mermaid 图表渲染、主题跟随 VSCode 等功能。

## 常用命令

```bash
npm run build          # 生产构建（minify, 无 sourcemap）
npm run watch          # 开发监听（sourcemap, 三入口同时 watch）
npm run lint           # ESLint 检查 src/
npm run lint:fix       # ESLint 自动修复
npm run typecheck      # TypeScript 类型检查（tsc --noEmit）
npm run package        # 打包为 .vsix
```

F5 启动调试（Extension Host），launch.json 已配置 preLaunchTask 为 build。

## 构建架构

esbuild 三入口并行构建，产物全部输出到 `dist/`：

| 入口 | 产物 | 平台 | 格式 | 说明 |
|------|------|------|------|------|
| `src/extension.ts` | `dist/extension.js` | node18 | cjs | 插件主进程，external `vscode` |
| `src/webview/frontend/reader-entry.ts` | `dist/reader.js` | chrome100 | iife | 阅读器 Webview 前端 |
| `src/webview/frontend/toc-entry.ts` | `dist/toc.js` | chrome100 | iife | TOC 侧边栏 Webview 前端 |

`--production` 标志关闭 sourcemap 并开启 minify。

## 高层架构

### 双 Webview 设计

插件有两个独立的 Webview，各自有完整的 HTML/CSS/JS 生命周期：

1. **ReaderPanel**（`src/webview/reader-panel.ts`）— 主编辑区的 WebviewPanel，负责渲染 Markdown 文档、图片查看器、Mermaid 图表。通过 `vscode.window.createWebviewPanel` 创建，支持多文档（每个 URI 一个面板实例，Map 管理）。

2. **TocSidebar**（`src/webview/toc-sidebar.ts`）— 活动栏侧边的 WebviewView（`WebviewViewProvider`），负责显示和导航目录树。

### 消息通信

两个 Webview 之间**不能直接通信**，必须经过插件主进程中转：

- 消息协议类型定义在 `src/types/index.ts` 的 `MessageProtocol` 命名空间中（`ToWebview` 和 `ToExtension` 联合类型）。
- 前端通过 `src/webview/frontend/messaging.ts` 的 `postMessage` / `onMessage` 收发消息。
- `ReaderPanel` 和 `TocSidebar` 各自通过回调函数协同：标题滚动同步（ReaderPanel `onHeadingChanged` → TocSidebar `highlightHeading`；TOC 点击 → ReaderPanel `highlightHeading`）。

### 数据流

1. 用户触发 `openReader` 命令 → `extension.ts` 创建 `ReaderPanel`。
2. `ReaderPanel.loadAndRender()` 读取文件 → `parseMarkdown()` 解析为 `{ source, html, headings }` → 生成 Webview HTML。
3. HTML 通过 `window.__INITIAL_DATA__` 注入初始数据（headings + theme），前端 JS 在 DOMContentLoaded 后初始化各组件。
4. 前端滚动触发 `headingChanged` 消息 → 主进程转发给 TocSidebar 高亮对应项；反向同理。

### Markdown 解析

`src/markdown/parser.ts` 使用 markdown-it，核心产出 `ParsedDocument`（html + headings 树）。标题锚点 ID 通过 `generateHeadingId` 生成（支持中文），并在渲染后的 HTML 中注入 `id` 属性。

### 前端组件

Reader Webview 包含三个独立模块：
- **reader.ts** — 内容渲染、滚动追踪、标题高亮、字体/主题响应
- **image-viewer.ts** — 图片全屏查看器（缩放、旋转、拖拽、前后切换）
- **mermaid.ts** — Mermaid 图表渲染和全屏查看

## 编码规范

- ESLint 配置严格：禁止 `any`、禁止非空断言、要求显式函数返回类型、switch 穷尽检查。
- 优先使用 `interface` 定义对象类型，`type` 用于联合类型和工具类型。
- 方法签名统一使用 property 风格（`fn: () => void`）。
- 以下划线 `_` 前缀的变量免于未使用检查。
- 允许 `require`（Node 环境）和 `namespace`（消息协议分组）。
