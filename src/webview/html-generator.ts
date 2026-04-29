import * as vscode from "vscode";
import type { Heading, Theme } from "../types/index.js";

/** 生成阅读器面板的 HTML */
export function getReaderHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  html: string,
  headings: Heading[],
  theme: Theme,
): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "reader.js"),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: https: http: ${webview.cspSource};" />
  <title>Hummingbird MD Reader</title>
  <style>
    ${getReaderStyles()}
  </style>
</head>
<body>
  <div id="reader-content">${html}</div>
  <div id="image-viewer-overlay" class="image-viewer-overlay">
    <div class="image-viewer-toolbar">
      <button id="iv-zoom-in" title="放大">+</button>
      <button id="iv-zoom-out" title="缩小">−</button>
      <button id="iv-zoom-fit" title="适应窗口">⊡</button>
      <button id="iv-zoom-original" title="原始尺寸">1:1</button>
      <span class="iv-separator"></span>
      <button id="iv-rotate-left" title="左旋 90°">↺</button>
      <button id="iv-rotate-right" title="右旋 90°">↻</button>
      <span class="iv-separator"></span>
      <button id="iv-prev" title="上一张">←</button>
      <button id="iv-next" title="下一张">→</button>
      <span id="iv-counter" class="iv-counter"></span>
      <span class="iv-spacer"></span>
      <button id="iv-close" title="关闭 (Esc)">✕</button>
    </div>
    <div class="image-viewer-canvas" id="image-viewer-canvas">
      <img id="iv-image" src="" alt="" />
    </div>
  </div>
  <div id="mermaid-fullscreen-overlay" class="mermaid-fullscreen-overlay">
    <div class="mermaid-fullscreen-toolbar">
      <span id="mf-title">Mermaid 图表</span>
      <span class="mf-spacer"></span>
      <button id="mf-download" title="下载为 JPG">下载 JPG</button>
      <button id="mf-close" title="关闭 (Esc)">✕</button>
    </div>
    <div class="mermaid-fullscreen-content" id="mermaid-fullscreen-content"></div>
  </div>
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${JSON.stringify({ headings, theme })};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/** 生成 TOC 侧边栏的 HTML */
export function getTocHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  headings: Heading[],
  theme: Theme,
): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "toc.js"),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <style>
    ${getTocStyles()}
  </style>
</head>
<body>
  <div id="toc-root"></div>
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${JSON.stringify({ headings, theme })};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/** 阅读器主面板样式 */
function getReaderStyles(): string {
  return /* css */ `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* 主题变量 */
    :root, [data-theme="light"] {
      --bg-primary: #ffffff;
      --bg-secondary: #f8f9fa;
      --text-primary: #1a1a2e;
      --text-secondary: #6c757d;
      --border-color: #dee2e6;
      --accent-color: #0d6efd;
      --code-bg: #f1f3f5;
      --blockquote-border: #0d6efd;
      --table-stripe: #f8f9fa;
      --shadow: rgba(0,0,0,0.1);
    }
    [data-theme="dark"] {
      --bg-primary: #1e1e2e;
      --bg-secondary: #2a2a3e;
      --text-primary: #cdd6f4;
      --text-secondary: #7f849c;
      --border-color: #45475a;
      --accent-color: #89b4fa;
      --code-bg: #313244;
      --blockquote-border: #89b4fa;
      --table-stripe: #2a2a3e;
      --shadow: rgba(0,0,0,0.3);
    }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--hb-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: var(--hb-font-size, 16px);
      font-weight: var(--hb-font-weight, 400);
      line-height: 1.8;
      padding: 32px 48px;
      max-width: 860px;
      margin: 0 auto;
    }

    /* 标题样式 */
    h1, h2, h3, h4, h5, h6 { margin-top: 1.8em; margin-bottom: 0.6em; line-height: 1.3; font-weight: 600; scroll-margin-top: 24px; }
    h1 { font-size: 2em; border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.6em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25em; }
    h3 { font-size: 1.3em; }
    h4 { font-size: 1.1em; }

    /* 段落 */
    p { margin-bottom: 1em; }

    /* 链接 */
    a { color: var(--accent-color); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* 代码 */
    code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; }
    pre { background: var(--code-bg); padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; }
    pre code { background: none; padding: 0; font-size: 0.88em; line-height: 1.6; }

    /* 引用 */
    blockquote { border-left: 4px solid var(--blockquote-border); padding: 0.5em 1em; margin: 1em 0; color: var(--text-secondary); background: var(--bg-secondary); border-radius: 0 4px 4px 0; }

    /* 列表 */
    ul, ol { padding-left: 2em; margin-bottom: 1em; }
    li { margin-bottom: 0.3em; }

    /* 表格 */
    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background: var(--bg-secondary); font-weight: 600; }
    tr:nth-child(even) { background: var(--table-stripe); }

    /* 水平线 */
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }

    /* 图片 */
    #reader-content img { max-width: 100%; height: auto; border-radius: 8px; cursor: zoom-in; transition: transform 0.2s, box-shadow 0.2s; }
    #reader-content img:hover { transform: scale(1.01); box-shadow: 0 4px 16px var(--shadow); }

    /* 图片查看器 */
    .image-viewer-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.9); display: none; flex-direction: column; }
    .image-viewer-overlay.active { display: flex; }
    .image-viewer-toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: rgba(0,0,0,0.7); color: #fff; font-size: 14px; }
    .image-viewer-toolbar button { background: none; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .image-viewer-toolbar button:hover { background: rgba(255,255,255,0.15); }
    .iv-separator { width: 1px; height: 20px; background: rgba(255,255,255,0.2); margin: 0 4px; }
    .iv-counter { color: rgba(255,255,255,0.6); font-size: 12px; min-width: 40px; text-align: center; }
    .iv-spacer { flex: 1; }
    .image-viewer-canvas { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: grab; }
    .image-viewer-canvas:active { cursor: grabbing; }
    .image-viewer-canvas img { max-width: none; max-height: none; user-select: none; -webkit-user-drag: none; transition: none; }

    /* Mermaid 容器 */
    .mermaid-container { margin: 1em 0; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; cursor: pointer; }
    .mermaid-container:hover { box-shadow: 0 2px 12px var(--shadow); }
    .mermaid-error { border-color: #e74c3c; background: rgba(231,76,60,0.08); }
    .mermaid-error pre { background: none; border: none; color: #e74c3c; text-align: left; white-space: pre-wrap; word-break: break-word; font-size: 13px; margin: 0; }
    .mermaid-error-title { color: #e74c3c; font-weight: 600; margin-bottom: 8px; font-size: 14px; }

    /* Mermaid 全屏 */
    .mermaid-fullscreen-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.9); display: none; flex-direction: column; }
    .mermaid-fullscreen-overlay.active { display: flex; }
    .mermaid-fullscreen-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,0,0,0.7); color: #fff; font-size: 14px; }
    .mermaid-fullscreen-toolbar button { background: none; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .mermaid-fullscreen-toolbar button:hover { background: rgba(255,255,255,0.15); }
    .mf-spacer { flex: 1; }
    .mf-title { color: rgba(255,255,255,0.7); font-size: 13px; }
    .mermaid-fullscreen-content { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .mermaid-fullscreen-content svg { max-width: 100%; max-height: 100%; }
  `;
}

/** TOC 侧边栏样式 */
function getTocStyles(): string {
  return /* css */ `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root, [data-theme="light"] {
      --bg-primary: #ffffff;
      --bg-hover: #f0f0f0;
      --bg-active: #e3f2fd;
      --text-primary: #1a1a2e;
      --text-secondary: #6c757d;
      --accent-color: #0d6efd;
      --border-color: #dee2e6;
    }
    [data-theme="dark"] {
      --bg-primary: #1e1e2e;
      --bg-hover: #2a2a3e;
      --bg-active: #2e3a50;
      --text-primary: #cdd6f4;
      --text-secondary: #7f849c;
      --accent-color: #89b4fa;
      --border-color: #45475a;
    }

    body { background: var(--bg-primary); color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }

    .toc-empty { color: var(--text-secondary); padding: 16px; text-align: center; font-style: italic; }

    .toc-item { display: block; padding: 4px 8px; color: var(--text-primary); text-decoration: none; border-left: 2px solid transparent; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toc-item:hover { background: var(--bg-hover); }
    .toc-item.active { background: var(--bg-active); border-left-color: var(--accent-color); color: var(--accent-color); font-weight: 500; }
    .toc-item[data-level="1"] { padding-left: 8px; font-weight: 600; font-size: 13px; }
    .toc-item[data-level="2"] { padding-left: 20px; }
    .toc-item[data-level="3"] { padding-left: 32px; font-size: 12px; }
    .toc-item[data-level="4"] { padding-left: 44px; font-size: 12px; }
    .toc-item[data-level="5"] { padding-left: 56px; font-size: 11px; color: var(--text-secondary); }
    .toc-item[data-level="6"] { padding-left: 68px; font-size: 11px; color: var(--text-secondary); }
  `;
}

/** 生成随机 nonce */
function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments: string[] = [];
  for (let i = 0; i < 32; i++) {
    segments.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  return segments.join("");
}
