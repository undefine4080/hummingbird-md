import * as vscode from "vscode";
import type { EditorMessageProtocol } from "../types/index.js";
import { getEditorHtml } from "./editor-html.js";

/**
 * HMD 编辑器标签页（Spike 最小实现）。
 *
 * TextDocument 仍是文档唯一事实源：
 * - webview 编辑 → 全文 WorkspaceEdit 回写（原生脏标记/Cmd+S/undo 生效）
 * - 外部修改（git/其他编辑器）→ 推送 docChanged 到 webview
 * - 回环防护：webview 发起的回写在 applyEdit 期间抑制向 webview 的反向推送
 *
 * Spike 验证点：打开/编辑/保存/外部修改/热退出（文本型自定义编辑器的
 * 脏缓冲备份由 VS Code 原生处理，provider 无需实现 backup）。
 */
export class EditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "hummingbird-md.editor";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      EditorProvider.viewType,
      new EditorProvider(context),
      { supportsMultipleEditorsPerDocument: false },
    );
  }

  private constructor(private readonly context: vscode.ExtensionContext) {}

  /** webview 回写进行中的标记，阻断同步回环 */
  private applyingFromWebview = false;

  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webview.html = getEditorHtml(webview, this.context.extensionUri, document);

    // 与 webview 当前内容一致的基准文本，用于跳过无意义同步
    let syncedText = document.getText();

    /** 仅更新基准并按需推送外部变更到 webview */
    const markSynced = (text: string): void => {
      syncedText = text;
    };

    const pushExternalChange = (text: string): void => {
      markSynced(text);
      void webview.postMessage({
        type: "docChanged",
        data: { text },
      } satisfies EditorMessageProtocol.ToWebview);
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.contentChanges.length === 0) {
          return;
        }
        if (event.document.uri.toString() !== document.uri.toString()) {
          return;
        }
        const text = document.getText();
        if (this.applyingFromWebview || text === syncedText) {
          return;
        }
        pushExternalChange(text);
      },
    );

    webview.onDidReceiveMessage((raw) => {
      // webview 输入不可信任，在边界处解码
      if (typeof raw !== "object" || raw === null || !("type" in raw)) {
        return;
      }
      const message = raw as { type: string; data?: unknown };
      if (message.type !== "edit") {
        return;
      }
      const data = message.data;
      if (typeof data !== "object" || data === null || !("text" in data)) {
        return;
      }
      const text = (data as { text: unknown }).text;
      if (typeof text !== "string") {
        return;
      }
      if (text === syncedText || text === document.getText()) {
        return;
      }
      void this.applyFullReplace(document, text, markSynced);
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });
  }

  /**
   * 全文替换回写。
   *
   * Spike 采用全文替换：实现最简单且不依赖位置映射。
   * 已知代价是 VS Code undo 栈粒度变粗（编辑器内 undo 由 Vditor 接管），
   * P0 阶段评估是否需要换行级 diff 缩小替换区间。
   */
  private async applyFullReplace(
    document: vscode.TextDocument,
    text: string,
    markSynced: (text: string) => void,
  ): Promise<void> {
    this.applyingFromWebview = true;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      ),
      text,
    );
    try {
      await vscode.workspace.applyEdit(edit);
      // 回写成功后仅更新基准，不向源 webview 反推 docChanged，
      // 否则 Vditor.setValue 会重置用户的光标与 undo 状态
      markSynced(text);
    } catch (error) {
      console.error("[HummingbirdMD] 编辑器回写失败:", error);
    } finally {
      this.applyingFromWebview = false;
    }
  }
}
