import * as vscode from "vscode";
import type { DocumentStats, Heading, ReadingStyleConfig, Theme, ThemeName } from "../types/index.js";

/** 生成阅读器面板的 HTML */
export function getReaderHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  html: string,
  headings: Heading[],
  theme: Theme,
  readingStyle?: ReadingStyleConfig,
  themeName?: ThemeName,
): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "reader.js"),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}" data-theme-name="${themeName ?? "classic"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: https: http: ${webview.cspSource};" />
  <title>Hummingbird MD</title>
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
      <span class="mf-separator"></span>
      <button id="mf-zoom-in" title="放大">+</button>
      <button id="mf-zoom-out" title="缩小">−</button>
      <button id="mf-zoom-fit" title="适应窗口">⊡</button>
      <button id="mf-zoom-original" title="原始尺寸">1:1</button>
      <span class="mf-separator"></span>
      <button id="mf-rotate-left" title="左旋 90°">↺</button>
      <button id="mf-rotate-right" title="右旋 90°">↻</button>
      <span class="mf-spacer"></span>
      <button id="mf-download" title="下载为 JPG">下载 JPG</button>
      <button id="mf-close" title="关闭 (Esc)">✕</button>
    </div>
    <div class="mermaid-fullscreen-content" id="mermaid-fullscreen-content"></div>
  </div>
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${JSON.stringify({ headings, theme, readingStyle: readingStyle ?? null, themeName: themeName ?? "classic" })};
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
  stats?: DocumentStats,
  readingStyle?: ReadingStyleConfig,
  themeName?: ThemeName,
): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "toc.js"),
  );

  const statsPanelHtml = stats ? /* html */ `
  <div class="doc-stats-panel" id="doc-stats-panel">
    <div class="doc-stats-header" id="doc-stats-toggle">
      <span class="doc-stats-header-text">文档信息</span>
      <span class="doc-stats-arrow" id="doc-stats-arrow">▶</span>
    </div>
    <div class="doc-stats-body" id="doc-stats-body">
      <div class="doc-stats-grid" id="doc-stats-grid"></div>
    </div>
  </div>` : "";

  const currentThemeName = themeName ?? "classic";

  return /* html */ `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}" data-theme-name="${currentThemeName}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    ${getTocStyles()}
  </style>
</head>
<body>
  <div class="settings-panel">
    <div class="settings-header" id="settings-toggle">
      <span class="settings-header-text">设置</span>
      <span class="settings-arrow" id="settings-arrow">▶</span>
    </div>
    <div class="settings-body" id="settings-body">
      <div class="settings-section-label">明暗模式</div>
      <div class="settings-theme-group">
        <button class="theme-btn" id="theme-btn-light" title="浅色模式">浅色</button>
        <button class="theme-btn" id="theme-btn-dark" title="深色模式">深色</button>
      </div>
      <div class="settings-section-label" style="margin-top: 10px;">主题风格</div>
      <div class="settings-theme-card-group" id="theme-card-group">
        <button class="theme-card${currentThemeName === "classic" ? " active" : ""}" data-theme-name="classic"><span class="theme-card-dot" style="background: #0d6efd;"></span>Classic</button>
        <button class="theme-card${currentThemeName === "github" ? " active" : ""}" data-theme-name="github"><span class="theme-card-dot" style="background: #0969da;"></span>GitHub</button>
        <button class="theme-card${currentThemeName === "vue" ? " active" : ""}" data-theme-name="vue"><span class="theme-card-dot" style="background: #42b883;"></span>Vue</button>
        <button class="theme-card${currentThemeName === "minimal" ? " active" : ""}" data-theme-name="minimal"><span class="theme-card-dot" style="background: #666;"></span>Minimal</button>
      </div>
      <div class="settings-section-label" style="margin-top: 12px;">阅读样式</div>
      <div class="settings-style-group">
        <div class="style-control">
          <label class="style-label" for="style-font-size">字体大小 <span id="style-font-size-val">16</span>px</label>
          <input type="range" id="style-font-size" class="style-slider" min="12" max="24" value="16" step="1" />
        </div>
        <div class="style-control">
          <label class="style-label" for="style-font-family">字体</label>
          <select id="style-font-family" class="style-select">
            <optgroup label="系统 / 无衬线">
              <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">系统默认</option>
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica Neue</option>
              <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
              <option value="Verdana, Geneva, sans-serif">Verdana</option>
              <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
              <option value="'Segoe UI', Tahoma, sans-serif">Segoe UI</option>
              <option value="system-ui, sans-serif">system-ui</option>
            </optgroup>
            <optgroup label="中文字体">
              <option value="'PingFang SC', 'Microsoft YaHei', sans-serif">苹方 / 微软雅黑</option>
              <option value="'Noto Sans SC', 'Source Han Sans SC', sans-serif">思源黑体</option>
              <option value="'Noto Serif SC', 'Source Han Serif SC', serif">思源宋体</option>
              <option value="'SimSun', 'Songti SC', serif">宋体</option>
              <option value="'SimHei', 'Heiti SC', sans-serif">黑体</option>
              <option value="'KaiTi', 'STKaiti', serif">楷体</option>
              <option value="'FangSong', 'STFangsong', serif">仿宋</option>
            </optgroup>
            <optgroup label="衬线">
              <option value="Georgia, 'Times New Roman', serif">Georgia</option>
              <option value="'Times New Roman', Times, serif">Times New Roman</option>
              <option value="'Palatino Linotype', Palatino, serif">Palatino</option>
              <option value="'Book Antiqua', Palatino, serif">Book Antiqua</option>
              <option value="Garamond, 'Times New Roman', serif">Garamond</option>
            </optgroup>
            <optgroup label="等宽">
              <option value="Menlo, Consolas, monospace">Menlo</option>
              <option value="'Fira Code', 'Courier New', monospace">Fira Code</option>
              <option value="'JetBrains Mono', Consolas, monospace">JetBrains Mono</option>
              <option value="'Source Code Pro', Consolas, monospace">Source Code Pro</option>
              <option value="'IBM Plex Mono', Consolas, monospace">IBM Plex Mono</option>
              <option value="Consolas, 'Courier New', monospace">Consolas</option>
            </optgroup>
            <optgroup label="其他">
              <option value="__custom__">自定义...</option>
            </optgroup>
          </select>
          <input type="text" id="style-font-family-custom" class="style-input" placeholder="例: 'Georgia', serif" style="display:none;" />
        </div>
        <div class="style-control">
          <label class="style-label" for="style-font-weight">字体粗细 <span id="style-font-weight-val">400</span></label>
          <input type="range" id="style-font-weight" class="style-slider" min="300" max="700" value="400" step="100" />
        </div>
        <div class="style-control">
          <label class="style-label" for="style-line-height">行间距 <span id="style-line-height-val">1.8</span></label>
          <input type="range" id="style-line-height" class="style-slider" min="1.2" max="2.5" value="1.8" step="0.1" />
        </div>
        <div class="style-control">
          <label class="style-label" for="style-paragraph-spacing">段落间距 <span id="style-paragraph-spacing-val">1.0</span>em</label>
          <input type="range" id="style-paragraph-spacing" class="style-slider" min="0.5" max="2" value="1" step="0.1" />
        </div>
      </div>
    </div>
  </div>
  <div id="toc-root"></div>
  ${statsPanelHtml}
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${JSON.stringify({ headings, theme, stats: stats ?? null, readingStyle: readingStyle ?? null, themeName: currentThemeName })};
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
      --code-text: #d63384;
      --blockquote-border: #0d6efd;
      --table-stripe: #f8f9fa;
      --shadow: rgba(0,0,0,0.1);
      --overlay-bg: #ffffff;
      --overlay-toolbar-bg: rgba(255,255,255,0.95);
      --overlay-btn-border: rgba(0,0,0,0.15);
      --overlay-btn-text: #333;
      --overlay-btn-hover: rgba(0,0,0,0.08);
    }
    [data-theme="dark"] {
      --bg-primary: #1e1e2e;
      --bg-secondary: #2a2a3e;
      --text-primary: #cdd6f4;
      --text-secondary: #7f849c;
      --border-color: #45475a;
      --accent-color: #89b4fa;
      --code-bg: #313244;
      --code-text: #f38ba8;
      --blockquote-border: #89b4fa;
      --table-stripe: #2a2a3e;
      --shadow: rgba(0,0,0,0.3);
      --overlay-bg: rgba(0,0,0,0.9);
      --overlay-toolbar-bg: rgba(0,0,0,0.7);
      --overlay-btn-border: rgba(255,255,255,0.2);
      --overlay-btn-text: #fff;
      --overlay-btn-hover: rgba(255,255,255,0.15);
    }

    /* GitHub 主题 */
    [data-theme-name="github"] { --bg-primary: #ffffff; --bg-secondary: #f6f8fa; --text-primary: #1f2328; --text-secondary: #656d76; --border-color: #d0d7de; --accent-color: #0969da; --code-bg: #f6f8fa; --code-text: #cf222e; --blockquote-border: #0969da; --table-stripe: #f6f8fa; --shadow: rgba(31,35,40,0.1); --overlay-bg: #ffffff; --overlay-toolbar-bg: rgba(255,255,255,0.95); --overlay-btn-border: rgba(31,35,40,0.15); --overlay-btn-text: #1f2328; --overlay-btn-hover: rgba(31,35,40,0.08); }
    [data-theme-name="github"][data-theme="dark"] { --bg-primary: #0d1117; --bg-secondary: #161b22; --text-primary: #e6edf3; --text-secondary: #7d8590; --border-color: #30363d; --accent-color: #58a6ff; --code-bg: #161b22; --code-text: #ff7b72; --blockquote-border: #58a6ff; --table-stripe: #161b22; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(255,255,255,0.2); --overlay-btn-text: #e6edf3; --overlay-btn-hover: rgba(255,255,255,0.15); }

    /* Vue 主题 */
    [data-theme-name="vue"] { --bg-primary: #ffffff; --bg-secondary: #f6f8fa; --text-primary: #213547; --text-secondary: #6c757d; --border-color: #e2e8f0; --accent-color: #42b883; --code-bg: #f8f8f8; --code-text: #c9402d; --blockquote-border: #42b883; --table-stripe: #f6f8fa; --shadow: rgba(33,53,71,0.1); --overlay-bg: #ffffff; --overlay-toolbar-bg: rgba(255,255,255,0.95); --overlay-btn-border: rgba(33,53,71,0.15); --overlay-btn-text: #213547; --overlay-btn-hover: rgba(33,53,71,0.08); }
    [data-theme-name="vue"][data-theme="dark"] { --bg-primary: #1a1a2e; --bg-secondary: #252540; --text-primary: #cdd6f4; --text-secondary: #8b8ba7; --border-color: #3a3a5c; --accent-color: #42b883; --code-bg: #252540; --code-text: #f97583; --blockquote-border: #42b883; --table-stripe: #252540; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(255,255,255,0.2); --overlay-btn-text: #cdd6f4; --overlay-btn-hover: rgba(255,255,255,0.15); }

    /* Minimal 主题 */
    [data-theme-name="minimal"] { --bg-primary: #ffffff; --bg-secondary: #fafafa; --text-primary: #333333; --text-secondary: #999999; --border-color: #e0e0e0; --accent-color: #333333; --code-bg: #f0f0f0; --code-text: #555555; --blockquote-border: #999999; --table-stripe: #fafafa; --shadow: rgba(0,0,0,0.08); --overlay-bg: #ffffff; --overlay-toolbar-bg: rgba(255,255,255,0.95); --overlay-btn-border: rgba(0,0,0,0.12); --overlay-btn-text: #333; --overlay-btn-hover: rgba(0,0,0,0.06); }
    [data-theme-name="minimal"][data-theme="dark"] { --bg-primary: #1a1a1a; --bg-secondary: #222222; --text-primary: #e0e0e0; --text-secondary: #888888; --border-color: #333333; --accent-color: #e0e0e0; --code-bg: #222222; --code-text: #aaaaaa; --blockquote-border: #555555; --table-stripe: #222222; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(255,255,255,0.15); --overlay-btn-text: #e0e0e0; --overlay-btn-hover: rgba(255,255,255,0.1); }

    /* 主题切换过渡 */
    html { transition: background-color 0.3s, color 0.3s; }
    body { transition: background-color 0.3s, color 0.3s; }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--hb-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: var(--hb-font-size, 16px);
      font-weight: var(--hb-font-weight, 400);
      line-height: var(--hb-line-height, 1.8);
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
    p { margin-bottom: var(--hb-paragraph-spacing, 1em); }

    /* 链接 */
    a { color: var(--accent-color); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* 代码 */
    code { background: var(--code-bg); color: var(--code-text); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; }
    pre { position: relative; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; background: var(--code-bg); }
    pre code { background: none; color: inherit; padding: 0; font-size: 0.88em; line-height: 1.6; }

    /* 代码块复制按钮 */
    .code-copy-btn { position: absolute; top: 8px; right: 8px; padding: 6px; border: none; border-radius: 4px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; opacity: 0; transition: opacity 0.2s, color 0.2s, background 0.2s; display: flex; align-items: center; justify-content: center; }
    pre:hover .code-copy-btn { opacity: 1; }
    .code-copy-btn:hover { color: var(--text-primary); background: var(--border-color); }
    .code-copy-btn.copied { color: #42b883; opacity: 1; }

    /* Shiki 双主题切换 */
    .shiki { background-color: var(--code-bg) !important; }
    [data-theme="dark"] .shiki, [data-theme="dark"] .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--code-bg) !important;
    }

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
    .image-viewer-overlay { position: fixed; inset: 0; z-index: 1000; background: var(--overlay-bg); display: none; flex-direction: column; }
    .image-viewer-overlay.active { display: flex; }
    .image-viewer-toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--overlay-toolbar-bg); color: var(--overlay-btn-text); font-size: 14px; }
    .image-viewer-toolbar button { background: none; border: 1px solid var(--overlay-btn-border); color: var(--overlay-btn-text); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .image-viewer-toolbar button:hover { background: var(--overlay-btn-hover); }
    .iv-separator { width: 1px; height: 20px; background: var(--overlay-btn-border); margin: 0 4px; }
    .iv-counter { color: rgba(255,255,255,0.6); font-size: 12px; min-width: 40px; text-align: center; }
    .iv-spacer { flex: 1; }
    .image-viewer-canvas { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: grab; }
    .image-viewer-canvas:active { cursor: grabbing; }
    .image-viewer-canvas img { max-width: none; max-height: none; user-select: none; -webkit-user-drag: none; transition: none; }

    /* Mermaid 容器 */
    .mermaid-container { margin: 1em 0; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; cursor: pointer; }
    .mermaid-container:hover { box-shadow: 0 2px 12px var(--shadow); }
    .mermaid-error { border-color: #e74c3c; background: rgba(231,76,60,0.08); cursor: default; }
    .mermaid-error pre { background: none; border: none; color: #e74c3c; text-align: left; white-space: pre-wrap; word-break: break-word; font-size: 13px; margin: 0; }
    .mermaid-error-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .mermaid-error-title { color: #e74c3c; font-weight: 600; font-size: 14px; }
    .mermaid-error-message { color: #e74c3c; font-size: 13px; margin-bottom: 12px; text-align: left; }
    .mermaid-error-actions { display: flex; gap: 6px; }
    .mermaid-error-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid rgba(231,76,60,0.4); border-radius: 4px; background: rgba(231,76,60,0.1); color: #e74c3c; font-size: 12px; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; }
    .mermaid-error-btn:hover { background: rgba(231,76,60,0.2); border-color: #e74c3c; }
    .mermaid-error-btn.copied { border-color: #27ae60; color: #27ae60; background: rgba(39,174,96,0.1); }
    .mermaid-error-btn svg { flex-shrink: 0; }
    .mermaid-error details summary { cursor: pointer; font-size: 13px; color: #e74c3c; margin-bottom: 8px; }

    /* Mermaid 全屏 */
    .mermaid-fullscreen-overlay { position: fixed; inset: 0; z-index: 1000; background: var(--overlay-bg); display: none; flex-direction: column; }
    .mermaid-fullscreen-overlay.active { display: flex; }
    .mermaid-fullscreen-toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--overlay-toolbar-bg); color: var(--overlay-btn-text); font-size: 14px; }
    .mermaid-fullscreen-toolbar button { background: none; border: 1px solid var(--overlay-btn-border); color: var(--overlay-btn-text); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .mermaid-fullscreen-toolbar button:hover { background: var(--overlay-btn-hover); }
    .mf-separator { width: 1px; height: 20px; background: var(--overlay-btn-border); margin: 0 4px; }
    .mf-spacer { flex: 1; }
    .mf-title { color: rgba(255,255,255,0.7); font-size: 13px; }
    .mermaid-fullscreen-content { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: grab; }
    .mermaid-fullscreen-content:active { cursor: grabbing; }
    .mermaid-fullscreen-content svg { max-width: none; max-height: none; user-select: none; -webkit-user-drag: none; transition: none; }
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

    /* GitHub 主题 */
    [data-theme-name="github"] { --bg-primary: #ffffff; --bg-hover: #f6f8fa; --bg-active: #ddf4ff; --text-primary: #1f2328; --text-secondary: #656d76; --accent-color: #0969da; --border-color: #d0d7de; }
    [data-theme-name="github"][data-theme="dark"] { --bg-primary: #0d1117; --bg-hover: #161b22; --bg-active: #1a2744; --text-primary: #e6edf3; --text-secondary: #7d8590; --accent-color: #58a6ff; --border-color: #30363d; }

    /* Vue 主题 */
    [data-theme-name="vue"] { --bg-primary: #ffffff; --bg-hover: #f6f8fa; --bg-active: #e6f7ef; --text-primary: #213547; --text-secondary: #6c757d; --accent-color: #42b883; --border-color: #e2e8f0; }
    [data-theme-name="vue"][data-theme="dark"] { --bg-primary: #1a1a2e; --bg-hover: #252540; --bg-active: #2a3a4a; --text-primary: #cdd6f4; --text-secondary: #8b8ba7; --accent-color: #42b883; --border-color: #3a3a5c; }

    /* Minimal 主题 */
    [data-theme-name="minimal"] { --bg-primary: #ffffff; --bg-hover: #f5f5f5; --bg-active: #eeeeee; --text-primary: #333333; --text-secondary: #999999; --accent-color: #333333; --border-color: #e0e0e0; }
    [data-theme-name="minimal"][data-theme="dark"] { --bg-primary: #1a1a1a; --bg-hover: #222222; --bg-active: #2a2a2a; --text-primary: #e0e0e0; --text-secondary: #888888; --accent-color: #e0e0e0; --border-color: #333333; }

    body { background: var(--bg-primary); color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }

    /* 设置面板 */
    .settings-panel { border-bottom: 1px solid var(--border-color); }
    .settings-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; cursor: pointer; user-select: none; }
    .settings-header:hover { background: var(--bg-hover); }
    .settings-header-text { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
    .settings-arrow { font-size: 10px; color: var(--text-secondary); transition: transform 0.2s; }
    .settings-arrow.open { transform: rotate(90deg); }
    .settings-body { display: none; padding: 8px 12px 12px; }
    .settings-body.open { display: block; }
    .settings-section-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; }
    .settings-theme-group { display: flex; gap: 6px; }
    .theme-btn { flex: 1; padding: 6px 0; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .theme-btn:hover { background: var(--bg-hover); }
    .theme-btn.active { border-color: var(--accent-color); background: var(--bg-active); color: var(--accent-color); font-weight: 500; }

    /* 阅读样式控件 */
    .settings-style-group { display: flex; flex-direction: column; gap: 10px; }
    .style-control { display: flex; flex-direction: column; gap: 4px; }
    .style-label { font-size: 11px; color: var(--text-secondary); display: flex; justify-content: space-between; }
    .style-label span { color: var(--accent-color); font-weight: 500; font-family: monospace; }
    .style-slider { width: 100%; height: 4px; appearance: none; background: var(--border-color); border-radius: 2px; outline: none; cursor: pointer; }
    .style-slider::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; background: var(--accent-color); border-radius: 50%; cursor: pointer; border: 2px solid var(--bg-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .style-select { width: 100%; padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; outline: none; cursor: pointer; }
    .style-select:focus { border-color: var(--accent-color); }
    .style-input { width: 100%; padding: 4px 8px; border: 1px solid var(--accent-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 11px; font-family: monospace; outline: none; margin-top: 4px; }
    .style-input::placeholder { color: var(--text-secondary); opacity: 0.6; }

    /* 主题风格卡片 */
    .settings-theme-card-group { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .theme-card { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 11px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .theme-card:hover { background: var(--bg-hover); }
    .theme-card.active { border-color: var(--accent-color); background: var(--bg-active); font-weight: 500; }
    .theme-card-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

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

    /* 文档信息面板 */
    .doc-stats-panel { border-top: 1px solid var(--border-color); margin-top: auto; }
    .doc-stats-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; cursor: pointer; user-select: none; }
    .doc-stats-header:hover { background: var(--bg-hover); }
    .doc-stats-header-text { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
    .doc-stats-arrow { font-size: 10px; color: var(--text-secondary); transition: transform 0.2s; }
    .doc-stats-arrow.open { transform: rotate(90deg); }
    .doc-stats-body { display: none; padding: 6px 12px 12px; }
    .doc-stats-body.open { display: block; }
    .doc-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
    .stat-item { display: flex; flex-direction: column; gap: 2px; }
    .stat-item-full { grid-column: 1 / -1; }
    .stat-label { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; }
    .stat-value { font-size: 12px; color: var(--text-primary); word-break: break-all; }
    .stat-path { font-family: monospace; font-size: 11px; cursor: pointer; border-radius: 3px; padding: 2px 4px; margin: -2px -4px; }
    .stat-path:hover { background: var(--bg-hover); }
    .stat-path.copied { color: #27ae60; }
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
