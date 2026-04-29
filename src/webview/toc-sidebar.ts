import * as vscode from "vscode";
import type { Heading, Theme } from "../types/index.js";
import type { MessageProtocol } from "../types/index.js";
import { getTocHtml } from "./html-generator.js";

/** 获取当前 VSCode 主题 */
function getTheme(): Theme {
  const current = vscode.window.activeColorTheme;
  return current.kind === vscode.ColorThemeKind.Dark ? "dark" : "light";
}

/** TOC 侧边栏管理器，管理 WebviewView 的生命周期和消息通信 */
export class TocSidebar implements vscode.WebviewViewProvider {
  /** WebviewView 实例 */
  private view: vscode.WebviewView | null = null;

  /** 扩展 URI */
  private readonly extensionUri: vscode.Uri;

  /** 缓存的标题数据，等 view 就绪后渲染 */
  private pendingHeadings: Heading[] | null = null;

  /** 缓存的主题，配合 pendingHeadings 使用 */
  private pendingTheme: Theme | null = null;

  /** 标题点击回调，通知 ReaderPanel 滚动到对应位置 */
  private onHeadingClicked: ((id: string) => void) | null = null;

  /** 主题变更回调，通知 ReaderPanel 切换主题 */
  private onThemeChanged: ((theme: Theme) => void) | null = null;

  /** 消息监听器 */
  private messageListener: vscode.Disposable | null = null;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /** 设置标题点击回调 */
  public setOnHeadingClicked(callback: (id: string) => void): void {
    this.onHeadingClicked = callback;
  }

  /** 设置主题变更回调 */
  public setOnThemeChanged(callback: (theme: Theme) => void): void {
    this.onThemeChanged = callback;
  }

  /** WebviewViewProvider 接口实现：解析 WebviewView */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ): void {
    this.view = webviewView;

    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // 如果有缓存数据则直接渲染，否则显示空状态
    if (this.pendingHeadings && this.pendingTheme) {
      console.log("[HummingbirdMD TOC] resolveWebviewView 使用缓存数据渲染，标题数:", this.pendingHeadings.length);
      this.view.webview.html = getTocHtml(
        this.view.webview,
        this.extensionUri,
        this.pendingHeadings,
        this.pendingTheme,
      );
    } else {
      this.view.webview.html = this.getEmptyHtml();
    }

    // 监听 Webview 消息
    this.messageListener = this.view.webview.onDidReceiveMessage(
      (message: MessageProtocol.ToExtension) => this.handleMessage(message),
    );

    // 监听视图销毁
    this.view.onDidDispose(() => this.handleViewDispose());
  }

  /** 更新 TOC 内容（当文档加载或切换时调用） */
  public updateHeadings(headings: Heading[], theme: Theme): void {
    console.log("[HummingbirdMD TOC] updateHeadings 被调用，标题数:", headings.length, "view 是否存在:", !!this.view);

    // 缓存数据，供 resolveWebviewView 使用
    this.pendingHeadings = headings;
    this.pendingTheme = theme;

    if (!this.view) {
      console.log("[HummingbirdMD TOC] view 为 null，已缓存数据，等待 view 就绪");
      return;
    }

    this.view.webview.html = getTocHtml(
      this.view.webview,
      this.extensionUri,
      headings,
      theme,
    );
    console.log("[HummingbirdMD TOC] HTML 已设置到 TOC webview");
  }

  /** 高亮指定标题项（从 ReaderPanel 触发） */
  public highlightHeading(id: string): void {
    if (!this.view) {
      return;
    }

    void this.view.webview.postMessage({
      type: "highlightHeading",
      data: { id },
    });
  }

  /** 处理来自 Webview 的消息 */
  private handleMessage(message: MessageProtocol.ToExtension): void {
    console.log("[HummingbirdMD TOC] 收到 webview 消息:", JSON.stringify(message));
    switch (message.type) {
      case "headingChanged":
        // TOC 中点击标题，通知 ReaderPanel 滚动到对应位置
        console.log("[HummingbirdMD TOC] 收到 headingChanged 消息，id:", message.data.id);
        this.onHeadingClicked?.(message.data.id);
        break;

      case "ready":
        // TOC 面板就绪
        break;

      case "themeChanged":
        this.onThemeChanged?.(message.data.theme);
        break;

      case "fontChanged":
      case "openMermaidFullscreen":
        break;
    }
  }

  /** 生成空状态 HTML */
  private getEmptyHtml(): string {
    const theme = getTheme();
    const bgPrimary = theme === "dark" ? "#1e1e2e" : "#ffffff";
    const textSecondary = theme === "dark" ? "#7f849c" : "#6c757d";

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      background: ${bgPrimary};
      color: ${textSecondary};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      margin: 0;
      padding: 16px;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>打开 Markdown 文件后显示目录</body>
</html>`;
  }

  /** 视图销毁时清理 */
  private handleViewDispose(): void {
    if (this.messageListener) {
      this.messageListener.dispose();
      this.messageListener = null;
    }
    this.view = null;
  }
}
