import * as vscode from "vscode";
import { parseMarkdown } from "../markdown/parser.js";
import type { FontConfig, Heading, Theme } from "../types/index.js";
import type { MessageProtocol } from "../types/index.js";
import { getReaderHtml } from "./html-generator.js";

/** 阅读器面板配置键 */
const FONT_CONFIG_KEY = "hummingbird-md.fontConfig";

/** 获取当前 VSCode 主题 */
function getTheme(): Theme {
  const current = vscode.window.activeColorTheme;
  return current.kind === vscode.ColorThemeKind.Dark ? "dark" : "light";
}

/** 阅读器面板管理器，负责管理 WebviewPanel 的生命周期和消息通信 */
export class ReaderPanel {
  /** 当前面板实例 */
  private readonly panel: vscode.WebviewPanel;

  /** 扩展 URI */
  private readonly extensionUri: vscode.Uri;

  /** 当前文档 URI */
  private currentUri: vscode.Uri;

  /** 面板销毁回调 */
  private readonly onDisposeCallback: () => void;

  /** 标题变化回调，通知 TOC 侧边栏高亮对应项 */
  private onHeadingChanged: ((id: string) => void) | null = null;

  /** 标题加载完成回调，通知 TOC 侧边栏更新目录树 */
  private onHeadingsLoaded: ((headings: Heading[], theme: Theme) => void) | null = null;

  /** VSCode 主题变化监听器的 Disposable */
  private themeChangeListener: vscode.Disposable;

  /** Webview 消息监听器的 Disposable */
  private messageListener: vscode.Disposable;

  /** 拷贝 context 引用，用于存取 globalState */
  private readonly context: vscode.ExtensionContext;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    onDispose: () => void,
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.currentUri = uri;
    this.context = context;
    this.onDisposeCallback = onDispose;

    // 设置 Webview 选项
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.getLocalResourceRoots(uri),
    };

    // 监听 Webview 消息
    this.messageListener = this.panel.webview.onDidReceiveMessage(
      (message: MessageProtocol.ToExtension) => this.handleMessage(message),
    );

    // 监听面板销毁
    this.panel.onDidDispose(() => this.dispose());

    // 监听 VSCode 主题变化
    this.themeChangeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      const theme = getTheme();
      this.postMessage({ type: "updateTheme", data: { theme } });
    });
  }

  /** 创建阅读器面板（仅创建实例，不加载文档，需手动调用 loadAndRender） */
  public static create(
    extensionUri: vscode.Uri,
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    onDispose: () => void,
  ): ReaderPanel {
    const fileName = uri.path.split("/").pop() ?? "未命名";

    const panel = vscode.window.createWebviewPanel(
      "hummingbird-md-reader",
      `阅读: ${fileName}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const instance = new ReaderPanel(panel, extensionUri, uri, context, onDispose);
    console.log("[HummingbirdMD] 面板实例创建完成:", fileName);
    return instance;
  }

  /** 设置标题变化回调 */
  public setOnHeadingChanged(callback: (id: string) => void): void {
    this.onHeadingChanged = callback;
  }

  /** 设置标题加载完成回调 */
  public setOnHeadingsLoaded(callback: (headings: Heading[], theme: Theme) => void): void {
    this.onHeadingsLoaded = callback;
  }

  /** 高亮指定标题（从 TOC 侧边栏触发） */
  public highlightHeading(id: string): void {
    console.log("[HummingbirdMD] ReaderPanel.highlightHeading 被调用，id:", id);
    this.postMessage({ type: "highlightHeading", data: { id } });
  }

  /** 应用主题（从 TOC 侧边栏触发） */
  public applyTheme(theme: Theme): void {
    this.postMessage({ type: "updateTheme", data: { theme } });
  }

  /** 更新文档内容（重新加载 Markdown） */
  public async updateDocument(uri: vscode.Uri): Promise<void> {
    this.currentUri = uri;
    this.panel.webview.options = {
      ...this.panel.webview.options,
      localResourceRoots: this.getLocalResourceRoots(uri),
    };

    const fileName = uri.path.split("/").pop() ?? "未命名";
    this.panel.title = `阅读: ${fileName}`;

    await this.loadAndRender();
  }

  /** 获取当前文档 URI */
  public getUri(): vscode.Uri {
    return this.currentUri;
  }

  /** 加载并渲染文档 */
  public async loadAndRender(): Promise<void> {
    console.log("[HummingbirdMD] 开始加载文档:", this.currentUri.path);
    const content = await vscode.workspace.fs.readFile(this.currentUri);
    const source = new TextDecoder("utf-8").decode(content);
    console.log("[HummingbirdMD] 文件读取完成，长度:", source.length);

    const doc = await parseMarkdown(source);
    console.log("[HummingbirdMD] Markdown 解析完成，标题数:", doc.headings.length);

    const theme = getTheme();
    this.panel.webview.html = getReaderHtml(
      this.panel.webview,
      this.extensionUri,
      doc.html,
      doc.headings,
      theme,
    );
    console.log("[HummingbirdMD] HTML 已设置到 webview");

    console.log("[HummingbirdMD] onHeadingsLoaded 回调是否存在:", !!this.onHeadingsLoaded);
    this.onHeadingsLoaded?.(doc.headings, theme);
  }

  /** 处理来自 Webview 的消息 */
  private handleMessage(message: MessageProtocol.ToExtension): void {
    switch (message.type) {
      case "headingChanged":
        // 转发给 TOC 侧边栏高亮对应项
        this.onHeadingChanged?.(message.data.id);
        break;

      case "themeChanged":
        // 主题变化由前端驱动，此处可做持久化（暂不需要）
        break;

      case "fontChanged":
        // 保存字体配置到 globalState
        void this.saveFontConfig(message.data);
        break;

      case "ready":
        // 面板就绪
        break;

      case "openMermaidFullscreen":
        // Mermaid 全屏查看暂不处理
        break;
    }
  }

  /** 保存字体配置到 globalState */
  private async saveFontConfig(config: FontConfig): Promise<void> {
    await this.context.globalState.update(FONT_CONFIG_KEY, config);
  }

  /** 向 Webview 发送消息 */
  private postMessage(message: MessageProtocol.ToWebview): void {
    void this.panel.webview.postMessage(message);
  }

  /** 获取 localResourceRoots，包含扩展目录和文档所在目录 */
  private getLocalResourceRoots(uri: vscode.Uri): vscode.Uri[] {
    const docDir = vscode.Uri.file(uri.path.split("/").slice(0, -1).join("/"));
    return [this.extensionUri, docDir];
  }

  /** 清理资源 */
  private dispose(): void {
    this.messageListener.dispose();
    this.themeChangeListener.dispose();
    this.onDisposeCallback();
  }
}
