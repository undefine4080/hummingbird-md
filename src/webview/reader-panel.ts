import * as path from "node:path";
import * as vscode from "vscode";
import {
  buildRelativeHref,
  type CodePathCandidate,
} from "../markdown/code-path.js";
import { parseMarkdown } from "../markdown/parser.js";
import { resolveLinkTarget } from "../markdown/link-resolver.js";
import {
  createImageUrlResolver,
  getDocumentDirectoryUri,
  getDocumentResourceRoots,
} from "../markdown/resource-resolver.js";
import type {
  DocumentStats,
  FontConfig,
  Heading,
  MermaidThemePreset,
  ReadingStyleConfig,
  Theme,
  ThemeName,
} from "../types/index.js";
import type { MessageProtocol } from "../types/index.js";
import { computeDocStats } from "../utils/doc-stats.js";
import { getReaderHtml } from "./html-generator.js";

/** 阅读器面板配置键 */
const FONT_CONFIG_KEY = "hummingbird-md.fontConfig";
const STYLE_CONFIG_KEY = "hummingbird-md.readingStyle";

/** 获取当前 VSCode 主题 */
function getTheme(): Theme {
  const current = vscode.window.activeColorTheme;
  return current.kind === vscode.ColorThemeKind.Dark ? "dark" : "light";
}

/** 对 URI path 的每一段做百分号编码，得到可直接用作 href 的路径。 */
function encodeUriPath(uriPath: string): string {
  return uriPath
    .split("/")
    .map((segment): string => encodeURIComponent(segment))
    .join("/");
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
  private onHeadingsLoaded:
    | ((headings: Heading[], theme: Theme, stats: DocumentStats) => void)
    | null = null;

  /** VSCode 主题变化监听器的 Disposable */
  private themeChangeListener: vscode.Disposable;

  /** 面板视图状态变化监听器 */
  private viewStateListener: vscode.Disposable;

  /** 文件变更监听器 */
  private fileWatcher: vscode.Disposable;

  /** 滚动位置请求的 Promise resolver */
  private scrollResolve: ((scrollY: number) => void) | null = null;

  /** 防抖重载定时器 */
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  /** 缓存的标题数据，面板重新激活时通知 TOC 刷新 */
  private cachedHeadings: Heading[] | null = null;

  /** 缓存的文档统计信息 */
  private cachedStats: DocumentStats | null = null;

  /** Webview 消息监听器的 Disposable */
  private messageListener: vscode.Disposable;

  /** 拷贝 context 引用，用于存取 globalState */
  private readonly context: vscode.ExtensionContext;

  /** 当前阅读样式配置 */
  private styleConfig: ReadingStyleConfig | null = null;

  /** 当前主题风格名称 */
  private currentThemeName: ThemeName = "classic";

  /** 当前 Mermaid 主题预设 */
  private currentMermaidThemePreset: MermaidThemePreset = "auto";

  /** 最后活跃的标题 ID，面板重新激活时恢复高亮 */
  private lastHighlightedId = "";

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
      localResourceRoots: getDocumentResourceRoots(uri, this.extensionUri),
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

    // 监听面板视图状态变化，切换到此 tab 时刷新 TOC 并恢复高亮
    this.viewStateListener = this.panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active && this.cachedHeadings && this.cachedStats) {
        const theme = getTheme();
        this.onHeadingsLoaded?.(this.cachedHeadings, theme, this.cachedStats);
        if (this.lastHighlightedId) {
          setTimeout(() => {
            this.onHeadingChanged?.(this.lastHighlightedId);
          }, 150);
        }
      }
    });

    // 监听文件变更，自动刷新预览
    this.fileWatcher = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.path === this.currentUri.path) {
        this.scheduleReload();
      }
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
      `预览: ${fileName}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const instance = new ReaderPanel(
      panel,
      extensionUri,
      uri,
      context,
      onDispose,
    );
    console.log("[HummingbirdMD] 面板实例创建完成:", fileName);
    return instance;
  }

  /** 设置标题变化回调 */
  public setOnHeadingChanged(callback: (id: string) => void): void {
    this.onHeadingChanged = callback;
  }

  /** 设置标题加载完成回调 */
  public setOnHeadingsLoaded(
    callback: (headings: Heading[], theme: Theme, stats: DocumentStats) => void,
  ): void {
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

  /** 设置阅读样式配置（面板创建时和样式变更时调用） */
  public setStyleConfig(config: ReadingStyleConfig): void {
    this.styleConfig = config;
  }

  /** 应用阅读样式（从 TOC 侧边栏实时触发） */
  public applyStyle(config: ReadingStyleConfig): void {
    this.styleConfig = config;
    this.postMessage({ type: "updateStyle", data: config });
    void this.saveStyleConfig(config);
  }

  /** 设置主题风格名称 */
  public setThemeName(name: ThemeName): void {
    this.currentThemeName = name;
  }

  /** 应用主题风格（从 TOC 侧边栏触发） */
  public applyThemeName(name: ThemeName): void {
    this.currentThemeName = name;
    this.postMessage({ type: "updateThemeName", data: { themeName: name } });
  }

  /** 设置 Mermaid 主题预设（面板创建时调用） */
  public setMermaidThemePreset(preset: MermaidThemePreset): void {
    this.currentMermaidThemePreset = preset;
  }

  /** 应用 Mermaid 主题预设（从 TOC 侧边栏触发） */
  public applyMermaidThemePreset(preset: MermaidThemePreset): void {
    this.currentMermaidThemePreset = preset;
    this.postMessage({ type: "updateMermaidTheme", data: { preset } });
  }

  /** 聚焦已有面板（当用户再次打开同一文档时） */
  public reveal(): void {
    this.panel.reveal();
  }

  /** 防抖调度重载：文件变更后延迟刷新 */
  private scheduleReload(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => {
      void this.reloadWithScrollRestore();
    }, 500);
  }

  /** 保存滚动位置后重新加载文档 */
  private async reloadWithScrollRestore(): Promise<void> {
    const scrollY = await this.requestScrollPosition();
    await this.loadAndRender();
    if (scrollY > 0) {
      this.postMessage({ type: "restoreScrollPosition", data: { scrollY } });
    }
  }

  /** 向 webview 请求当前滚动位置 */
  private requestScrollPosition(): Promise<number> {
    return new Promise((resolve) => {
      this.scrollResolve = resolve;
      this.postMessage({ type: "requestScrollPosition" });
      setTimeout(() => {
        if (this.scrollResolve) {
          this.scrollResolve = null;
          resolve(0);
        }
      }, 300);
    });
  }

  /** 更新文档内容（重新加载 Markdown） */
  public async updateDocument(uri: vscode.Uri): Promise<void> {
    this.currentUri = uri;
    this.panel.webview.options = {
      ...this.panel.webview.options,
      localResourceRoots: getDocumentResourceRoots(uri, this.extensionUri),
    };

    const fileName = uri.path.split("/").pop() ?? "未命名";
    this.panel.title = `预览: ${fileName}`;

    await this.loadAndRender();
  }

  /** 获取当前文档 URI */
  public getUri(): vscode.Uri {
    return this.currentUri;
  }

  /** 加载并渲染文档 */
  public async loadAndRender(): Promise<void> {
    console.log("[HummingbirdMD] 开始加载文档:", this.currentUri.path);
    const [content, fileStat] = await Promise.all([
      vscode.workspace.fs.readFile(this.currentUri),
      vscode.workspace.fs.stat(this.currentUri),
    ]);
    const source = new TextDecoder("utf-8").decode(content);
    console.log("[HummingbirdMD] 文件读取完成，长度:", source.length);

    // 代码路径自动链接（默认开启；配置变更后随下次文档刷新生效）
    const codePathLinksEnabled = vscode.workspace
      .getConfiguration("hummingbird-md")
      .get<boolean>("codePathLinks", true);

    const doc = await parseMarkdown(source, {
      resolveImageUrl: createImageUrlResolver(
        this.currentUri,
        this.panel.webview,
      ),
      ...(codePathLinksEnabled
        ? { resolveCodePathHref: this.createCodePathResolver() }
        : {}),
    });
    console.log(
      "[HummingbirdMD] Markdown 解析完成，标题数:",
      doc.headings.length,
    );

    const stats = computeDocStats(
      source,
      fileStat.size,
      fileStat.ctime,
      fileStat.mtime,
      this.currentUri.fsPath,
    );

    const theme = getTheme();
    this.cachedHeadings = doc.headings;
    this.cachedStats = stats;
    this.lastHighlightedId = "";
    this.panel.webview.html = getReaderHtml(
      this.panel.webview,
      this.extensionUri,
      doc.html,
      doc.headings,
      theme,
      this.styleConfig ?? undefined,
      this.currentThemeName,
      this.currentMermaidThemePreset,
    );
    console.log("[HummingbirdMD] HTML 已设置到 webview");

    console.log(
      "[HummingbirdMD] onHeadingsLoaded 回调是否存在:",
      !!this.onHeadingsLoaded,
    );
    this.onHeadingsLoaded?.(doc.headings, theme, stats);
  }

  /** 处理来自 Webview 的消息 */
  private handleMessage(message: MessageProtocol.ToExtension): void {
    switch (message.type) {
      case "headingChanged":
        this.lastHighlightedId = message.data.id;
        this.onHeadingChanged?.(message.data.id);
        break;

      case "themeChanged":
        // 主题变化由前端驱动，此处可做持久化（暂不需要）
        break;

      case "fontChanged":
        // 保存字体配置到 globalState
        void this.saveFontConfig(message.data);
        break;

      case "styleChanged":
        // 样式变更由 TOC 侧边栏发起，Reader 不直接处理
        break;

      case "themeNameChanged":
        // 主题名称变更由 TOC 侧边栏发起，Reader 不直接处理
        break;

      case "mermaidThemeChanged":
        // Mermaid 主题预设变更由 TOC 侧边栏发起，Reader 不直接处理
        break;

      case "ready":
        // 面板就绪
        break;

      case "openMermaidFullscreen":
        break;

      case "openLink":
        void this.openLink(message.data.href);
        break;

      case "scrollPosition":
        if (this.scrollResolve) {
          this.scrollResolve(message.data.scrollY);
          this.scrollResolve = null;
        }
        break;
    }
  }

  /** 处理 Reader 中的 Markdown 链接。 */
  private async openLink(href: string): Promise<void> {
    const target = resolveLinkTarget(this.currentUri, href);
    if (target.kind === "anchor") {
      this.postMessage({
        type: "highlightHeading",
        data: { id: target.fragment ?? "" },
      });
      return;
    }

    if (target.kind === "external" && target.uri) {
      await vscode.env.openExternal(target.uri);
      return;
    }

    if (target.kind !== "file" || !target.uri) {
      void vscode.window.showWarningMessage("不支持打开此链接");
      return;
    }

    if (
      target.uri.toString() === this.currentUri.toString() &&
      target.fragment &&
      !target.location
    ) {
      this.onHeadingChanged?.(target.fragment);
      this.postMessage({
        type: "highlightHeading",
        data: { id: target.fragment },
      });
      return;
    }

    if (!this.isAllowedFileUri(target.uri)) {
      void vscode.window.showWarningMessage(
        "链接目标不在当前工作区或文档目录内",
      );
      return;
    }

    try {
      await vscode.workspace.fs.stat(target.uri);
      const selection = target.location
        ? await this.createLinkSelection(target.uri, target.location)
        : undefined;
      await vscode.window.showTextDocument(target.uri, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true,
        selection,
      });
    } catch {
      void vscode.window.showWarningMessage(
        `找不到链接目标：${target.uri.fsPath}`,
      );
    }
  }

  /** 限制本地链接只能访问当前文档目录或工作区。 */
  private isAllowedFileUri(uri: vscode.Uri): boolean {
    const documentDirectory = getDocumentDirectoryUri(this.currentUri);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      this.currentUri,
    );
    const normalizedPath = path.resolve(uri.fsPath);
    const roots = [
      documentDirectory.fsPath,
      ...(workspaceFolder ? [workspaceFolder.uri.fsPath] : []),
    ].map((root): string => path.resolve(root));
    return roots.some(
      (root): boolean =>
        normalizedPath === root ||
        normalizedPath.startsWith(`${root}${path.sep}`),
    );
  }

  /**
   * 创建代码 span 文件引用解析器。
   *
   * 双基准（文档目录 → 工作区根）并行探测，仅真实存在的文件生成链接；
   * 与 isAllowedFileUri 使用同一组根目录，保证渲染与点击行为一致。
   * 基准顺序即优先级：文档目录命中优先于工作区根。
   */
  private createCodePathResolver(): (
    candidate: CodePathCandidate,
  ) => Promise<string | undefined> {
    const documentDirectory = getDocumentDirectoryUri(this.currentUri);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      this.currentUri,
    );
    const bases = [
      documentDirectory,
      ...(workspaceFolder ? [workspaceFolder.uri] : []),
    ].filter(
      (base, index, list): boolean =>
        list.findIndex(
          (item): boolean => item.toString() === base.toString(),
        ) === index,
    );

    return async (candidate): Promise<string | undefined> => {
      const segments = candidate.path
        .split("/")
        .filter((segment): boolean => segment.length > 0 && segment !== ".");
      const targets = bases.map((base): vscode.Uri =>
        vscode.Uri.joinPath(base, ...segments),
      );
      const stats = await Promise.all(
        targets.map((uri): Promise<vscode.FileStat | undefined> =>
          Promise.resolve(vscode.workspace.fs.stat(uri)).catch(
            (): undefined => undefined,
          ),
        ),
      );

      for (let index = 0; index < targets.length; index++) {
        const stat = stats[index];
        if (!stat || (stat.type & vscode.FileType.File) === 0) {
          continue;
        }
        if (!this.isAllowedFileUri(targets[index])) {
          continue;
        }
        return buildRelativeHref(
          encodeUriPath(documentDirectory.path),
          encodeUriPath(targets[index].path),
          candidate.location,
        );
      }
      return undefined;
    };
  }

  /** 根据链接位置创建 VS Code 编辑器选择范围。 */
  private async createLinkSelection(
    uri: vscode.Uri,
    location: {
      startLine?: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
    },
  ): Promise<vscode.Range> {
    const document = await vscode.workspace.openTextDocument(uri);
    const startLine = Math.max(0, (location.startLine ?? 1) - 1);
    const startColumn = Math.max(0, (location.startColumn ?? 1) - 1);
    const endLine = Math.max(
      0,
      (location.endLine ?? location.startLine ?? 1) - 1,
    );
    const endColumn = Math.max(
      0,
      location.endColumn !== undefined
        ? location.endColumn - 1
        : location.endLine !== undefined
          ? document.lineAt(endLine).range.end.character
          : location.startColumn !== undefined
            ? location.startColumn - 1
            : 0,
    );
    const start = document.validatePosition(
      new vscode.Position(startLine, startColumn),
    );
    const end = document.validatePosition(
      new vscode.Position(endLine, endColumn),
    );
    return new vscode.Range(start, end);
  }

  /** 保存字体配置到 globalState */
  private async saveFontConfig(config: FontConfig): Promise<void> {
    await this.context.globalState.update(FONT_CONFIG_KEY, config);
  }

  /** 保存阅读样式配置到 globalState */
  private async saveStyleConfig(config: ReadingStyleConfig): Promise<void> {
    await this.context.globalState.update(STYLE_CONFIG_KEY, config);
  }

  /** 向 Webview 发送消息 */
  private postMessage(message: MessageProtocol.ToWebview): void {
    void this.panel.webview.postMessage(message);
  }

  /** 清理资源 */
  private dispose(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.messageListener.dispose();
    this.themeChangeListener.dispose();
    this.viewStateListener.dispose();
    this.fileWatcher.dispose();
    this.onDisposeCallback();
  }
}
