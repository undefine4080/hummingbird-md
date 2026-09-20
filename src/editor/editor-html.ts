import * as vscode from "vscode";
import { getNonce } from "../webview/html-generator.js";
import type { EditorInitData } from "../types/index.js";

/**
 * 生成编辑器 Webview 的 HTML。
 *
 * CSP 要点（血泪教训，勿删）：
 * - nonce 存在时 'unsafe-inline' 在 script 侧失效，因此内联数据脚本与本地
 *   editor.js 用 nonce 放行，Vditor 运行时动态加载的资源用 cspSource 放行。
 * - style-src 必须 'unsafe-inline'：Mermaid SVG 内联 <style> 依赖它（Reader 同款问题）。
 * - script-src 必须 'wasm-unsafe-eval'：lute.min.js 是 Go WASM，
 *   WebAssembly.instantiate 会被 CSP 拦截，缺失时编辑器静默白屏。
 */
export function getEditorHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  document: vscode.TextDocument,
): string {
  // Vditor 运行时按 `${cdn}/dist/...` 拼接资源地址，
  // 因此 cdn 基址指向拷贝产物中包含 dist/ 的目录。
  const cdn = webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "vendor", "vditor"))
    .toString();
  const editorJs = webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "editor.js"))
    .toString();
  const cspSource = webview.cspSource;
  const nonce = getNonce();

  const initData: EditorInitData = {
    text: document.getText(),
    dark: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark,
    cdn,
  };

  // 序列化为 JSON 时转义 <，防止 </script> 提前闭合标签
  const initJson = JSON.stringify(initData)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'nonce-${nonce}' ${cspSource} 'wasm-unsafe-eval';
    style-src 'unsafe-inline' ${cspSource};
    img-src data: blob: https: http: ${cspSource};
    font-src ${cspSource} data:;
    connect-src ${cspSource} data: blob:;
    worker-src ${cspSource} blob:;
  ">
  <link rel="stylesheet" href="${cdn}/dist/index.css">
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    #editor { height: 100%; }
  </style>
</head>
<body>
  <div id="editor"></div>
  <script nonce="${nonce}">
    // 白屏自诊断：任何未捕获错误直接渲染到页面，避免 webview 静默失败
    window.addEventListener("error", function (event) {
      var box = document.createElement("pre");
      box.style.cssText =
        "position:fixed;inset:auto 0 0 0;max-height:40%;overflow:auto;" +
        "margin:0;padding:8px;background:#fff0f0;color:#c00;" +
        "font:12px/1.5 monospace;z-index:99999;white-space:pre-wrap;";
      box.textContent = "[HMD 编辑器错误] " + String(event.message) +
        "\\n at " + String(event.filename) + ":" + String(event.lineno);
      document.body.appendChild(box);
    });
    window.__HMD_EDITOR_DATA__ = ${initJson};
  </script>
  <script src="${cdn}/dist/index.min.js"></script>
  <script nonce="${nonce}" src="${editorJs}"></script>
</body>
</html>`;
}
