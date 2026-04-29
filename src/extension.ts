import * as vscode from "vscode";
import { registerCommands } from "./commands/register.js";
import { ReaderPanel } from "./webview/reader-panel.js";
import { TocSidebar } from "./webview/toc-sidebar.js";
import { initHighlighter } from "./markdown/parser.js";

/** 活跃的阅读器面板，key 为文档 URI 路径 */
const activePanels = new Map<string, ReaderPanel>();

/** TOC 侧边栏实例 */
let tocSidebar: TocSidebar;

/** 插件激活入口 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 初始化 Shiki 语法高亮引擎
  await initHighlighter();
  // 注册 TOC 侧边栏 Provider
  tocSidebar = new TocSidebar(context.extensionUri);

  // 设置 TOC 侧边栏标题点击回调：通知活跃的 ReaderPanel 滚动
  tocSidebar.setOnHeadingClicked((id: string): void => {
    console.log("[HummingbirdMD] onHeadingClicked 回调触发，id:", id);
    // 找到最近活跃的阅读器面板并高亮标题
    const activeEditor = vscode.window.activeTextEditor;
    console.log("[HummingbirdMD] activeTextEditor:", activeEditor ? activeEditor.document.uri.path : "null");
    console.log("[HummingbirdMD] activePanels keys:", Array.from(activePanels.keys()));
    if (activeEditor) {
      const panel = activePanels.get(activeEditor.document.uri.path);
      if (panel) {
        console.log("[HummingbirdMD] 通过 activeEditor 找到面板，调用 highlightHeading");
        panel.highlightHeading(id);
        return;
      }
    }

    // 回退：通知最后一个面板
    const lastPanel = Array.from(activePanels.values()).pop();
    if (lastPanel) {
      console.log("[HummingbirdMD] 回退到最后的面板，调用 highlightHeading");
      lastPanel.highlightHeading(id);
    } else {
      console.log("[HummingbirdMD] 没有找到任何活跃面板");
    }
  });

  // 设置 TOC 侧边栏主题变更回调：通知活跃的 ReaderPanel 切换主题
  tocSidebar.setOnThemeChanged((theme: string): void => {
    for (const panel of activePanels.values()) {
      panel.applyTheme(theme as "light" | "dark");
    }
  });

  const tocDisposable = vscode.window.registerWebviewViewProvider(
    "hummingbird-md.tocView",
    tocSidebar,
  );

  // 注册命令
  registerCommands(context, (uri: vscode.Uri): Promise<void> => {
    return openReader(uri, context);
  });

  context.subscriptions.push(tocDisposable);
}

/** 插件销毁 */
export function deactivate(): void {
  // 销毁所有活跃面板（由 VSCode 自动销毁 WebviewPanel）
  activePanels.clear();
}

/** 打开阅读器面板 */
async function openReader(
  uri: vscode.Uri,
  context: vscode.ExtensionContext,
): Promise<void> {
  // 如果已有该文档的面板，则聚焦
  if (activePanels.has(uri.path)) {
    return;
  }

  // 创建新面板
  const panel = ReaderPanel.create(
    context.extensionUri,
    uri,
    context,
    (): void => {
      // 面板销毁时从 Map 中移除
      activePanels.delete(uri.path);
    },
  );

  // 先注册回调，再加载数据
  panel.setOnHeadingChanged((id: string): void => {
    tocSidebar.highlightHeading(id);
  });

  panel.setOnHeadingsLoaded((headings, theme): void => {
    console.log("[HummingbirdMD] onHeadingsLoaded 回调触发，标题数:", headings.length);
    tocSidebar.updateHeadings(headings, theme);
  });

  await panel.loadAndRender();

  // 加入活跃面板管理
  activePanels.set(uri.path, panel);
}
