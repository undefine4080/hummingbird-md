import * as vscode from "vscode";
import type { EditorMessageProtocol } from "../types/index.js";
import { getEditorHtml } from "./editor-html.js";
import { computeMinimalEdit } from "./text-diff.js";

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
      {
        // 标签页隐藏时保留 webview 上下文：避免切回时 webview 重建导致白屏，
        // 同时保留 Vditor 实例、光标与 undo 状态（vscode-office 同款配置）
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  private constructor(private readonly context: vscode.ExtensionContext) {}

  /** webview 回写进行中的标记，阻断同步回环 */
  private applyingFromWebview = false;

  /** 回写是否进行中；进行中时新编辑合并到 pendingWriteText（后到覆盖） */
  private writeInFlight = false;
  private pendingWriteText: string | null = null;

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

    // 从隐藏态恢复显示时，同步隐藏期间发生的外部变更
    // （用户常在原生 tab 与 HMD tab 间切换编辑同一文件）
    const viewStateSubscription = webviewPanel.onDidChangeViewState(
      (event) => {
        if (!event.webviewPanel.visible) {
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
      void this.enqueueWrite(document, text, markSynced);
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      viewStateSubscription.dispose();
    });
  }

  /**
   * 回写入口：串行化 + 合并。
   *
   * 一轮回写未完成时，后续编辑只保留最新文本，完成后补写一次，
   * 避免连续输入产生的写请求堆积与乱序。
   */
  private enqueueWrite(
    document: vscode.TextDocument,
    text: string,
    markSynced: (text: string) => void,
  ): void {
    if (this.writeInFlight) {
      this.pendingWriteText = text;
      return;
    }
    this.writeInFlight = true;
    void this.applyEdit(document, text, markSynced).then((): void => {
      this.writeInFlight = false;
      const pending = this.pendingWriteText;
      this.pendingWriteText = null;
      if (pending !== null && pending !== document.getText()) {
        this.enqueueWrite(document, pending, markSynced);
      }
    });
  }

  /**
   * 最小区间回写：只替换改动的部分，VS Code 的 undo 记录与脏区
   * 计算仅涉及被改内容，undo 粒度恢复正常。
   */
  private async applyEdit(
    document: vscode.TextDocument,
    text: string,
    markSynced: (text: string) => void,
  ): Promise<void> {
    const oldText = document.getText();
    const minimal = computeMinimalEdit(oldText, text);
    if (!minimal) {
      markSynced(text);
      return;
    }
    this.applyingFromWebview = true;
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        document.uri,
        new vscode.Range(
          document.positionAt(minimal.start),
          document.positionAt(minimal.end),
        ),
        minimal.insert,
      );
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
