import * as vscode from "vscode";
import { EditorProvider } from "../editor/editor-provider.js";

/** 注册「用阅读模式打开」与「用编辑模式打开」命令 */
export function registerCommands(
  context: vscode.ExtensionContext,
  openReader: (uri: vscode.Uri) => Promise<void>,
): void {
  const disposable = vscode.commands.registerCommand(
    "hummingbird-md.openReader",
    (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showWarningMessage("请先选择一个 Markdown 文件");
        return;
      }
      if (!targetUri.path.endsWith(".md")) {
        vscode.window.showWarningMessage("仅支持 Markdown 文件（.md）");
        return;
      }
      void openReader(targetUri);
    },
  );

  // 以 HMD 编辑器标签页打开（CustomTextEditorProvider，WYSIWYG 编辑）
  const editDisposable = vscode.commands.registerCommand(
    "hummingbird-md.edit",
    (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showWarningMessage("请先选择一个 Markdown 文件");
        return;
      }
      if (!targetUri.path.endsWith(".md")) {
        vscode.window.showWarningMessage("仅支持 Markdown 文件（.md）");
        return;
      }
      void vscode.commands.executeCommand(
        "vscode.openWith",
        targetUri,
        EditorProvider.viewType,
      );
    },
  );

  context.subscriptions.push(disposable, editDisposable);
}
