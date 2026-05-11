import * as vscode from "vscode";
import type { DocumentStats, Heading, ReadingStyleConfig, Theme, ThemeName } from "../types/index.js";

/** 字体选项 */
interface FontOption {
  /** font-family CSS 值 */
  value: string;
  /** 显示名称 */
  label: string;
  /** 用于 Canvas 验证的字体族名称（取 value 中第一个） */
  detectName: string;
}

/** 字体分组 */
interface FontGroup {
  /** 分组显示名称 */
  label: string;
  /** 分组内的字体选项 */
  fonts: FontOption[];
  /** 该分组仅在指定平台显示（不指定则所有平台都显示） */
  platform?: NodeJS.Platform | NodeJS.Platform[];
}

/** 字体数据库：按分组定义所有候选字体 */
const FONT_DATABASE: FontGroup[] = [
  {
    label: "系统 / 无衬线",
    fonts: [
      { value: "-apple-system, 'Segoe UI', sans-serif", label: "系统默认", detectName: "-apple-system" },
      { value: "system-ui, sans-serif", label: "system-ui", detectName: "system-ui" },
      { value: "Arial, Helvetica, sans-serif", label: "Arial", detectName: "Arial" },
      { value: "Tahoma, Geneva, sans-serif", label: "Tahoma", detectName: "Tahoma" },
      { value: "Verdana, Geneva, sans-serif", label: "Verdana", detectName: "Verdana" },
    ],
  },
  {
    label: "系统 / 无衬线",
    platform: "darwin",
    fonts: [
      { value: "'Helvetica Neue', Helvetica, sans-serif", label: "Helvetica Neue", detectName: "Helvetica Neue" },
      { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS", detectName: "Trebuchet MS" },
    ],
  },
  {
    label: "系统 / 无衬线",
    platform: "win32",
    fonts: [
      { value: "'Segoe UI', Tahoma, sans-serif", label: "Segoe UI", detectName: "Segoe UI" },
      { value: "Calibri, 'Segoe UI', sans-serif", label: "Calibri", detectName: "Calibri" },
      { value: "Bahnschrift, 'Segoe UI', sans-serif", label: "Bahnschrift", detectName: "Bahnschrift" },
      { value: "Tahoma, Geneva, sans-serif", label: "Tahoma", detectName: "Tahoma" },
    ],
  },
  {
    label: "中文字体",
    platform: "darwin",
    fonts: [
      { value: "'PingFang SC', 'Microsoft YaHei', sans-serif", label: "苹方", detectName: "PingFang SC" },
      { value: "'Heiti SC', 'SimHei', sans-serif", label: "黑体", detectName: "Heiti SC" },
      { value: "'Songti SC', 'SimSun', serif", label: "宋体", detectName: "Songti SC" },
      { value: "'STKaiti', 'KaiTi', serif", label: "楷体", detectName: "STKaiti" },
      { value: "'STFangsong', 'FangSong', serif", label: "仿宋", detectName: "STFangsong" },
    ],
  },
  {
    label: "中文字体",
    platform: "win32",
    fonts: [
      { value: "'Microsoft YaHei', 'PingFang SC', sans-serif", label: "微软雅黑", detectName: "Microsoft YaHei" },
      { value: "DengXian, 'PingFang SC', sans-serif", label: "等线体", detectName: "DengXian" },
      { value: "SimHei, 'Heiti SC', sans-serif", label: "黑体", detectName: "SimHei" },
      { value: "SimSun, 'Songti SC', serif", label: "宋体", detectName: "SimSun" },
      { value: "KaiTi, 'STKaiti', serif", label: "楷体", detectName: "KaiTi" },
      { value: "FangSong, 'STFangsong', serif", label: "仿宋", detectName: "FangSong" },
    ],
  },
  {
    label: "中文字体",
    fonts: [
      { value: "'Noto Sans SC', 'Source Han Sans SC', sans-serif", label: "思源黑体", detectName: "Noto Sans SC" },
      { value: "'Noto Serif SC', 'Source Han Serif SC', serif", label: "思源宋体", detectName: "Noto Serif SC" },
    ],
  },
  {
    label: "衬线",
    fonts: [
      { value: "Georgia, 'Times New Roman', serif", label: "Georgia", detectName: "Georgia" },
      { value: "'Times New Roman', Times, serif", label: "Times New Roman", detectName: "Times New Roman" },
    ],
  },
  {
    label: "衬线",
    platform: "darwin",
    fonts: [
      { value: "'Palatino Linotype', Palatino, serif", label: "Palatino", detectName: "Palatino Linotype" },
    ],
  },
  {
    label: "衬线",
    platform: "win32",
    fonts: [
      { value: "Cambria, Georgia, serif", label: "Cambria", detectName: "Cambria" },
      { value: "'Palatino Linotype', Palatino, serif", label: "Palatino", detectName: "Palatino Linotype" },
      { value: "Georgia, 'Times New Roman', serif", label: "Georgia", detectName: "Georgia" },
    ],
  },
  {
    label: "等宽",
    platform: "darwin",
    fonts: [
      { value: "'SF Mono', Menlo, Consolas, monospace", label: "SF Mono", detectName: "SF Mono" },
      { value: "Menlo, Consolas, monospace", label: "Menlo", detectName: "Menlo" },
      { value: "Monaco, Menlo, monospace", label: "Monaco", detectName: "Monaco" },
    ],
  },
  {
    label: "等宽",
    platform: "win32",
    fonts: [
      { value: "Consolas, 'Courier New', monospace", label: "Consolas", detectName: "Consolas" },
      { value: "'Cascadia Code', Consolas, monospace", label: "Cascadia Code", detectName: "Cascadia Code" },
      { value: "'Cascadia Mono', Consolas, monospace", label: "Cascadia Mono", detectName: "Cascadia Mono" },
      { value: "'Lucida Console', Monaco, monospace", label: "Lucida Console", detectName: "Lucida Console" },
    ],
  },
  {
    label: "等宽",
    fonts: [
      { value: "'Fira Code', 'Courier New', monospace", label: "Fira Code", detectName: "Fira Code" },
      { value: "'JetBrains Mono', Consolas, monospace", label: "JetBrains Mono", detectName: "JetBrains Mono" },
      { value: "'Source Code Pro', Consolas, monospace", label: "Source Code Pro", detectName: "Source Code Pro" },
      { value: "'IBM Plex Mono', Consolas, monospace", label: "IBM Plex Mono", detectName: "IBM Plex Mono" },
    ],
  },
];

/** 根据当前平台过滤字体数据库，返回候选分组列表 */
function getFontCandidatesForPlatform(): FontGroup[] {
  const platform = process.platform;
  return FONT_DATABASE
    .filter((group): boolean => {
      if (!group.platform) { return true; }
      const platforms = Array.isArray(group.platform) ? group.platform : [group.platform];
      return platforms.includes(platform);
    })
    .map((group): FontGroup => ({ label: group.label, fonts: group.fonts }));
}

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
      <div class="settings-section">
        <div class="settings-section-label">外观</div>
        <div class="settings-theme-group">
          <button class="theme-btn" id="theme-btn-light" title="浅色模式">☀ 浅色</button>
          <button class="theme-btn" id="theme-btn-dark" title="深色模式">☾ 深色</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-label">主题风格</div>
        <div class="settings-theme-card-group" id="theme-card-group">
          <button class="theme-card${currentThemeName === "classic" ? " active" : ""}" data-theme-name="classic"><span class="theme-card-dot" style="background: #0d6efd;"></span>Classic</button>
          <button class="theme-card${currentThemeName === "github" ? " active" : ""}" data-theme-name="github"><span class="theme-card-dot" style="background: #0969da;"></span>GitHub</button>
          <button class="theme-card${currentThemeName === "vue" ? " active" : ""}" data-theme-name="vue"><span class="theme-card-dot" style="background: #42b883;"></span>Vue</button>
          <button class="theme-card${currentThemeName === "minimal" ? " active" : ""}" data-theme-name="minimal"><span class="theme-card-dot" style="background: #666;"></span>Minimal</button>
          <button class="theme-card${currentThemeName === "dracula" ? " active" : ""}" data-theme-name="dracula"><span class="theme-card-dot" style="background: #bd93f9;"></span>Dracula</button>
          <button class="theme-card${currentThemeName === "solarized" ? " active" : ""}" data-theme-name="solarized"><span class="theme-card-dot" style="background: #268bd2;"></span>Solarized</button>
          <button class="theme-card${currentThemeName === "nord" ? " active" : ""}" data-theme-name="nord"><span class="theme-card-dot" style="background: #88c0d0;"></span>Nord</button>
          <button class="theme-card${currentThemeName === "gruvbox" ? " active" : ""}" data-theme-name="gruvbox"><span class="theme-card-dot" style="background: #fe8019;"></span>Gruvbox</button>
          <button class="theme-card${currentThemeName === "catppuccin" ? " active" : ""}" data-theme-name="catppuccin"><span class="theme-card-dot" style="background: #cba6f7;"></span>Catppuccin</button>
          <button class="theme-card${currentThemeName === "everforest" ? " active" : ""}" data-theme-name="everforest"><span class="theme-card-dot" style="background: #7fbbb3;"></span>Everforest</button>
          <button class="theme-card${currentThemeName === "rose-pine" ? " active" : ""}" data-theme-name="rose-pine"><span class="theme-card-dot" style="background: #c4a7e7;"></span>Rosé Pine</button>
          <button class="theme-card${currentThemeName === "one-dark" ? " active" : ""}" data-theme-name="one-dark"><span class="theme-card-dot" style="background: #61afef;"></span>One Dark</button>
          <button class="theme-card${currentThemeName === "notion" ? " active" : ""}" data-theme-name="notion"><span class="theme-card-dot" style="background: #2383e2;"></span>Notion</button>
          <button class="theme-card${currentThemeName === "ayu" ? " active" : ""}" data-theme-name="ayu"><span class="theme-card-dot" style="background: #e6b450;"></span>Ayu</button>
          <button class="theme-card${currentThemeName === "flexoki" ? " active" : ""}" data-theme-name="flexoki"><span class="theme-card-dot" style="background: #5e9af0;"></span>Flexoki</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-label">阅读样式</div>
        <div class="settings-style-group">
          <div class="style-control">
            <label class="style-label" for="style-font-size">字体大小 <span id="style-font-size-val">16</span>px</label>
            <input type="range" id="style-font-size" class="style-slider" min="12" max="24" value="16" step="1" />
          </div>
          <div class="style-control">
            <label class="style-label" for="style-font-family">字体</label>
            <select id="style-font-family" class="style-select"></select>
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
  </div>
  <div id="toc-root"></div>
  ${statsPanelHtml}
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${JSON.stringify({ headings, theme, stats: stats ?? null, readingStyle: readingStyle ?? null, themeName: currentThemeName, fontGroups: getFontCandidatesForPlatform() })};
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

    /* Dracula 主题 */
    [data-theme-name="dracula"] { --bg-primary: #f5f5f9; --bg-secondary: #eaeaf0; --text-primary: #2b2e3b; --text-secondary: #6a6d83; --border-color: #d5d6dc; --accent-color: #7c5cbf; --code-bg: #eaeaf0; --code-text: #7c5cbf; --blockquote-border: #7c5cbf; --table-stripe: #eaeaf0; --shadow: rgba(43,46,59,0.1); --overlay-bg: #ffffff; --overlay-toolbar-bg: rgba(255,255,255,0.95); --overlay-btn-border: rgba(43,46,59,0.15); --overlay-btn-text: #2b2e3b; --overlay-btn-hover: rgba(43,46,59,0.08); }
    [data-theme-name="dracula"][data-theme="dark"] { --bg-primary: #282a36; --bg-secondary: #44475a; --text-primary: #f8f8f2; --text-secondary: #6272a4; --border-color: #44475a; --accent-color: #bd93f9; --code-bg: #44475a; --code-text: #ff79c6; --blockquote-border: #bd93f9; --table-stripe: #44475a; --shadow: rgba(0,0,0,0.4); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(248,248,242,0.2); --overlay-btn-text: #f8f8f2; --overlay-btn-hover: rgba(248,248,242,0.15); }

    /* Solarized 主题 */
    [data-theme-name="solarized"] { --bg-primary: #fdf6e3; --bg-secondary: #eee8d5; --text-primary: #657b83; --text-secondary: #93a1a1; --border-color: #d3d0c8; --accent-color: #268bd2; --code-bg: #eee8d5; --code-text: #2aa198; --blockquote-border: #268bd2; --table-stripe: #eee8d5; --shadow: rgba(101,123,131,0.1); --overlay-bg: #fdf6e3; --overlay-toolbar-bg: rgba(253,246,227,0.95); --overlay-btn-border: rgba(101,123,131,0.15); --overlay-btn-text: #657b83; --overlay-btn-hover: rgba(101,123,131,0.08); }
    [data-theme-name="solarized"][data-theme="dark"] { --bg-primary: #002b36; --bg-secondary: #073642; --text-primary: #839496; --text-secondary: #586e75; --border-color: #073642; --accent-color: #268bd2; --code-bg: #073642; --code-text: #2aa198; --blockquote-border: #268bd2; --table-stripe: #073642; --shadow: rgba(0,0,0,0.4); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(131,148,150,0.2); --overlay-btn-text: #839496; --overlay-btn-hover: rgba(131,148,150,0.15); }

    /* Nord 主题 */
    [data-theme-name="nord"] { --bg-primary: #eceff4; --bg-secondary: #e5e9f0; --text-primary: #2e3440; --text-secondary: #4c566a; --border-color: #d8dee9; --accent-color: #5e81ac; --code-bg: #e5e9f0; --code-text: #bf616a; --blockquote-border: #5e81ac; --table-stripe: #e5e9f0; --shadow: rgba(46,52,64,0.1); --overlay-bg: #eceff4; --overlay-toolbar-bg: rgba(236,239,244,0.95); --overlay-btn-border: rgba(46,52,64,0.15); --overlay-btn-text: #2e3440; --overlay-btn-hover: rgba(46,52,64,0.08); }
    [data-theme-name="nord"][data-theme="dark"] { --bg-primary: #2e3440; --bg-secondary: #3b4252; --text-primary: #eceff4; --text-secondary: #d8dee9; --border-color: #434c5e; --accent-color: #88c0d0; --code-bg: #3b4252; --code-text: #bf616a; --blockquote-border: #88c0d0; --table-stripe: #3b4252; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(236,239,244,0.2); --overlay-btn-text: #eceff4; --overlay-btn-hover: rgba(236,239,244,0.15); }

    /* Gruvbox 主题 */
    [data-theme-name="gruvbox"] { --bg-primary: #fbf1c7; --bg-secondary: #ebdbb2; --text-primary: #3c3836; --text-secondary: #928374; --border-color: #d5c4a1; --accent-color: #076678; --code-bg: #ebdbb2; --code-text: #9d0006; --blockquote-border: #076678; --table-stripe: #ebdbb2; --shadow: rgba(60,56,54,0.1); --overlay-bg: #fbf1c7; --overlay-toolbar-bg: rgba(251,241,199,0.95); --overlay-btn-border: rgba(60,56,54,0.15); --overlay-btn-text: #3c3836; --overlay-btn-hover: rgba(60,56,54,0.08); }
    [data-theme-name="gruvbox"][data-theme="dark"] { --bg-primary: #282828; --bg-secondary: #3c3836; --text-primary: #ebdbb2; --text-secondary: #928374; --border-color: #504945; --accent-color: #fe8019; --code-bg: #3c3836; --code-text: #fb4934; --blockquote-border: #fe8019; --table-stripe: #3c3836; --shadow: rgba(0,0,0,0.4); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(235,219,178,0.2); --overlay-btn-text: #ebdbb2; --overlay-btn-hover: rgba(235,219,178,0.15); }

    /* Catppuccin 主题 */
    [data-theme-name="catppuccin"] { --bg-primary: #eff1f5; --bg-secondary: #e6e9ef; --text-primary: #4c4f69; --text-secondary: #6c6f85; --border-color: #ccd0da; --accent-color: #1e66f5; --code-bg: #e6e9ef; --code-text: #d20f39; --blockquote-border: #1e66f5; --table-stripe: #e6e9ef; --shadow: rgba(76,79,105,0.1); --overlay-bg: #eff1f5; --overlay-toolbar-bg: rgba(239,241,245,0.95); --overlay-btn-border: rgba(76,79,105,0.15); --overlay-btn-text: #4c4f69; --overlay-btn-hover: rgba(76,79,105,0.08); }
    [data-theme-name="catppuccin"][data-theme="dark"] { --bg-primary: #1e1e2e; --bg-secondary: #313244; --text-primary: #cdd6f4; --text-secondary: #6c7086; --border-color: #45475a; --accent-color: #cba6f7; --code-bg: #313244; --code-text: #f38ba8; --blockquote-border: #cba6f7; --table-stripe: #313244; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(205,214,244,0.2); --overlay-btn-text: #cdd6f4; --overlay-btn-hover: rgba(205,214,244,0.15); }

    /* Everforest 主题 */
    [data-theme-name="everforest"] { --bg-primary: #fffbef; --bg-secondary: #f3ead3; --text-primary: #5c6a72; --text-secondary: #939f91; --border-color: #d9dace; --accent-color: #3a94c5; --code-bg: #f3ead3; --code-text: #f85552; --blockquote-border: #3a94c5; --table-stripe: #f3ead3; --shadow: rgba(92,106,114,0.1); --overlay-bg: #fffbef; --overlay-toolbar-bg: rgba(255,251,239,0.95); --overlay-btn-border: rgba(92,106,114,0.15); --overlay-btn-text: #5c6a72; --overlay-btn-hover: rgba(92,106,114,0.08); }
    [data-theme-name="everforest"][data-theme="dark"] { --bg-primary: #272e33; --bg-secondary: #2e383c; --text-primary: #d3c6aa; --text-secondary: #859289; --border-color: #414b50; --accent-color: #7fbbb3; --code-bg: #2e383c; --code-text: #e67e80; --blockquote-border: #7fbbb3; --table-stripe: #2e383c; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(211,198,170,0.2); --overlay-btn-text: #d3c6aa; --overlay-btn-hover: rgba(211,198,170,0.15); }

    /* Rosé Pine 主题 */
    [data-theme-name="rose-pine"] { --bg-primary: #faf4ed; --bg-secondary: #fffaf3; --text-primary: #575279; --text-secondary: #9893a5; --border-color: #ebdfe4; --accent-color: #286983; --code-bg: #fffaf3; --code-text: #b4637a; --blockquote-border: #286983; --table-stripe: #fffaf3; --shadow: rgba(87,82,121,0.1); --overlay-bg: #faf4ed; --overlay-toolbar-bg: rgba(250,244,237,0.95); --overlay-btn-border: rgba(87,82,121,0.15); --overlay-btn-text: #575279; --overlay-btn-hover: rgba(87,82,121,0.08); }
    [data-theme-name="rose-pine"][data-theme="dark"] { --bg-primary: #191724; --bg-secondary: #1f1d2e; --text-primary: #e0def4; --text-secondary: #908caa; --border-color: #26233a; --accent-color: #c4a7e7; --code-bg: #1f1d2e; --code-text: #eb6f92; --blockquote-border: #c4a7e7; --table-stripe: #1f1d2e; --shadow: rgba(0,0,0,0.4); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(224,222,244,0.2); --overlay-btn-text: #e0def4; --overlay-btn-hover: rgba(224,222,244,0.15); }

    /* One Dark 主题 */
    [data-theme-name="one-dark"] { --bg-primary: #fafafa; --bg-secondary: #f0f0f0; --text-primary: #383a42; --text-secondary: #a0a1a7; --border-color: #e5e5e6; --accent-color: #4078f2; --code-bg: #f0f0f0; --code-text: #e45649; --blockquote-border: #4078f2; --table-stripe: #f0f0f0; --shadow: rgba(56,58,66,0.1); --overlay-bg: #fafafa; --overlay-toolbar-bg: rgba(250,250,250,0.95); --overlay-btn-border: rgba(56,58,66,0.15); --overlay-btn-text: #383a42; --overlay-btn-hover: rgba(56,58,66,0.08); }
    [data-theme-name="one-dark"][data-theme="dark"] { --bg-primary: #282c34; --bg-secondary: #2c313a; --text-primary: #abb2bf; --text-secondary: #5c6370; --border-color: #3e4451; --accent-color: #61afef; --code-bg: #2c313a; --code-text: #e06c75; --blockquote-border: #61afef; --table-stripe: #2c313a; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(171,178,191,0.2); --overlay-btn-text: #abb2bf; --overlay-btn-hover: rgba(171,178,191,0.15); }

    /* Notion 主题 */
    [data-theme-name="notion"] { --bg-primary: #ffffff; --bg-secondary: #f7f6f3; --text-primary: #37352f; --text-secondary: #9b9a97; --border-color: #e9e9e7; --accent-color: #2383e2; --code-bg: #f7f6f3; --code-text: #eb5757; --blockquote-border: #2383e2; --table-stripe: #f7f6f3; --shadow: rgba(55,53,47,0.08); --overlay-bg: #ffffff; --overlay-toolbar-bg: rgba(255,255,255,0.95); --overlay-btn-border: rgba(55,53,47,0.15); --overlay-btn-text: #37352f; --overlay-btn-hover: rgba(55,53,47,0.06); }
    [data-theme-name="notion"][data-theme="dark"] { --bg-primary: #191919; --bg-secondary: #202020; --text-primary: #d4d4d4; --text-secondary: #808080; --border-color: #2e2e2e; --accent-color: #529cca; --code-bg: #202020; --code-text: #ff7373; --blockquote-border: #529cca; --table-stripe: #202020; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(255,255,255,0.15); --overlay-btn-text: #d4d4d4; --overlay-btn-hover: rgba(255,255,255,0.1); }

    /* Ayu 主题 */
    [data-theme-name="ayu"] { --bg-primary: #fafafa; --bg-secondary: #f3f3f3; --text-primary: #5c6773; --text-secondary: #828a93; --border-color: #e6e6e6; --accent-color: #f29718; --code-bg: #f3f3f3; --code-text: #e6b450; --blockquote-border: #f29718; --table-stripe: #f3f3f3; --shadow: rgba(92,103,115,0.1); --overlay-bg: #fafafa; --overlay-toolbar-bg: rgba(250,250,250,0.95); --overlay-btn-border: rgba(92,103,115,0.15); --overlay-btn-text: #5c6773; --overlay-btn-hover: rgba(92,103,115,0.08); }
    [data-theme-name="ayu"][data-theme="dark"] { --bg-primary: #0a0e14; --bg-secondary: #0d1017; --text-primary: #b3b1ad; --text-secondary: #626a73; --border-color: #1a1f29; --accent-color: #e6b450; --code-bg: #0d1017; --code-text: #ff8f40; --blockquote-border: #e6b450; --table-stripe: #0d1017; --shadow: rgba(0,0,0,0.4); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(179,177,173,0.2); --overlay-btn-text: #b3b1ad; --overlay-btn-hover: rgba(179,177,173,0.15); }

    /* Flexoki 主题 */
    [data-theme-name="flexoki"] { --bg-primary: #fffcf0; --bg-secondary: #f2f0e5; --text-primary: #100f0f; --text-secondary: #6e6a5f; --border-color: #e8e5d9; --accent-color: #205ea6; --code-bg: #f2f0e5; --code-text: #af3029; --blockquote-border: #205ea6; --table-stripe: #f2f0e5; --shadow: rgba(16,15,15,0.08); --overlay-bg: #fffcf0; --overlay-toolbar-bg: rgba(255,252,240,0.95); --overlay-btn-border: rgba(16,15,15,0.12); --overlay-btn-text: #100f0f; --overlay-btn-hover: rgba(16,15,15,0.06); }
    [data-theme-name="flexoki"][data-theme="dark"] { --bg-primary: #100f0f; --bg-secondary: #1c1b1a; --text-primary: #cecdc3; --text-secondary: #878580; --border-color: #282726; --accent-color: #5e9af0; --code-bg: #1c1b1a; --code-text: #d14d41; --blockquote-border: #5e9af0; --table-stripe: #1c1b1a; --shadow: rgba(0,0,0,0.3); --overlay-bg: rgba(0,0,0,0.9); --overlay-toolbar-bg: rgba(0,0,0,0.7); --overlay-btn-border: rgba(206,205,195,0.15); --overlay-btn-text: #cecdc3; --overlay-btn-hover: rgba(206,205,195,0.1); }

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

    /* Dracula 主题 */
    [data-theme-name="dracula"] { --bg-primary: #f5f5f9; --bg-hover: #eaeaf0; --bg-active: #e0dff0; --text-primary: #2b2e3b; --text-secondary: #6a6d83; --accent-color: #7c5cbf; --border-color: #d5d6dc; }
    [data-theme-name="dracula"][data-theme="dark"] { --bg-primary: #282a36; --bg-hover: #44475a; --bg-active: #3a3d52; --text-primary: #f8f8f2; --text-secondary: #6272a4; --accent-color: #bd93f9; --border-color: #44475a; }

    /* Solarized 主题 */
    [data-theme-name="solarized"] { --bg-primary: #fdf6e3; --bg-hover: #eee8d5; --bg-active: #e0dac5; --text-primary: #657b83; --text-secondary: #93a1a1; --accent-color: #268bd2; --border-color: #d3d0c8; }
    [data-theme-name="solarized"][data-theme="dark"] { --bg-primary: #002b36; --bg-hover: #073642; --bg-active: #0a4050; --text-primary: #839496; --text-secondary: #586e75; --accent-color: #268bd2; --border-color: #073642; }

    /* Nord 主题 */
    [data-theme-name="nord"] { --bg-primary: #eceff4; --bg-hover: #e5e9f0; --bg-active: #d8dee9; --text-primary: #2e3440; --text-secondary: #4c566a; --accent-color: #5e81ac; --border-color: #d8dee9; }
    [data-theme-name="nord"][data-theme="dark"] { --bg-primary: #2e3440; --bg-hover: #3b4252; --bg-active: #434c5e; --text-primary: #eceff4; --text-secondary: #d8dee9; --accent-color: #88c0d0; --border-color: #434c5e; }

    /* Gruvbox 主题 */
    [data-theme-name="gruvbox"] { --bg-primary: #fbf1c7; --bg-hover: #ebdbb2; --bg-active: #d5c4a1; --text-primary: #3c3836; --text-secondary: #928374; --accent-color: #076678; --border-color: #d5c4a1; }
    [data-theme-name="gruvbox"][data-theme="dark"] { --bg-primary: #282828; --bg-hover: #3c3836; --bg-active: #504945; --text-primary: #ebdbb2; --text-secondary: #928374; --accent-color: #fe8019; --border-color: #504945; }

    /* Catppuccin 主题 */
    [data-theme-name="catppuccin"] { --bg-primary: #eff1f5; --bg-hover: #e6e9ef; --bg-active: #dce0e8; --text-primary: #4c4f69; --text-secondary: #6c6f85; --accent-color: #1e66f5; --border-color: #ccd0da; }
    [data-theme-name="catppuccin"][data-theme="dark"] { --bg-primary: #1e1e2e; --bg-hover: #313244; --bg-active: #45475a; --text-primary: #cdd6f4; --text-secondary: #6c7086; --accent-color: #cba6f7; --border-color: #45475a; }

    /* Everforest 主题 */
    [data-theme-name="everforest"] { --bg-primary: #fffbef; --bg-hover: #f3ead3; --bg-active: #eae0c3; --text-primary: #5c6a72; --text-secondary: #939f91; --accent-color: #3a94c5; --border-color: #d9dace; }
    [data-theme-name="everforest"][data-theme="dark"] { --bg-primary: #272e33; --bg-hover: #2e383c; --bg-active: #374145; --text-primary: #d3c6aa; --text-secondary: #859289; --accent-color: #7fbbb3; --border-color: #414b50; }

    /* Rosé Pine 主题 */
    [data-theme-name="rose-pine"] { --bg-primary: #faf4ed; --bg-hover: #fffaf3; --bg-active: #f2ece5; --text-primary: #575279; --text-secondary: #9893a5; --accent-color: #286983; --border-color: #ebdfe4; }
    [data-theme-name="rose-pine"][data-theme="dark"] { --bg-primary: #191724; --bg-hover: #1f1d2e; --bg-active: #26233a; --text-primary: #e0def4; --text-secondary: #908caa; --accent-color: #c4a7e7; --border-color: #26233a; }

    /* One Dark 主题 */
    [data-theme-name="one-dark"] { --bg-primary: #fafafa; --bg-hover: #f0f0f0; --bg-active: #e5e5e6; --text-primary: #383a42; --text-secondary: #a0a1a7; --accent-color: #4078f2; --border-color: #e5e5e6; }
    [data-theme-name="one-dark"][data-theme="dark"] { --bg-primary: #282c34; --bg-hover: #2c313a; --bg-active: #3e4451; --text-primary: #abb2bf; --text-secondary: #5c6370; --accent-color: #61afef; --border-color: #3e4451; }

    /* Notion 主题 */
    [data-theme-name="notion"] { --bg-primary: #ffffff; --bg-hover: #f7f6f3; --bg-active: #edece8; --text-primary: #37352f; --text-secondary: #9b9a97; --accent-color: #2383e2; --border-color: #e9e9e7; }
    [data-theme-name="notion"][data-theme="dark"] { --bg-primary: #191919; --bg-hover: #202020; --bg-active: #2a2a2a; --text-primary: #d4d4d4; --text-secondary: #808080; --accent-color: #529cca; --border-color: #2e2e2e; }

    /* Ayu 主题 */
    [data-theme-name="ayu"] { --bg-primary: #fafafa; --bg-hover: #f3f3f3; --bg-active: #e6e6e6; --text-primary: #5c6773; --text-secondary: #828a93; --accent-color: #f29718; --border-color: #e6e6e6; }
    [data-theme-name="ayu"][data-theme="dark"] { --bg-primary: #0a0e14; --bg-hover: #0d1017; --bg-active: #1a1f29; --text-primary: #b3b1ad; --text-secondary: #626a73; --accent-color: #e6b450; --border-color: #1a1f29; }

    /* Flexoki 主题 */
    [data-theme-name="flexoki"] { --bg-primary: #fffcf0; --bg-hover: #f2f0e5; --bg-active: #e8e5d9; --text-primary: #100f0f; --text-secondary: #6e6a5f; --accent-color: #205ea6; --border-color: #e8e5d9; }
    [data-theme-name="flexoki"][data-theme="dark"] { --bg-primary: #100f0f; --bg-hover: #1c1b1a; --bg-active: #282726; --text-primary: #cecdc3; --text-secondary: #878580; --accent-color: #5e9af0; --border-color: #282726; }

    body { background: var(--bg-primary); color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }

    /* 设置面板 */
    /* 设置面板 */
    .settings-panel { border-bottom: 1px solid var(--border-color); }
    .settings-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; cursor: pointer; user-select: none; }
    .settings-header:hover { background: var(--bg-hover); }
    .settings-header-text { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-secondary); }
    .settings-arrow { font-size: 10px; color: var(--text-secondary); transition: transform 0.2s; }
    .settings-arrow.open { transform: rotate(90deg); }
    .settings-body { display: none; padding: 4px 16px 16px; }
    .settings-body.open { display: block; }

    /* 设置分区 */
    .settings-section { padding: 12px 0; border-top: 1px solid var(--border-color); }
    .settings-section:first-child { border-top: none; padding-top: 4px; }
    .settings-section-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; letter-spacing: 0.3px; }

    /* 明暗模式按钮 */
    .settings-theme-group { display: flex; gap: 8px; }
    .theme-btn { flex: 1; padding: 8px 0; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .theme-btn:hover { background: var(--bg-hover); }
    .theme-btn.active { border-color: var(--accent-color); background: var(--bg-active); color: var(--accent-color); font-weight: 500; }

    /* 阅读样式控件 */
    .settings-style-group { display: flex; flex-direction: column; gap: 14px; }
    .style-control { display: flex; flex-direction: column; gap: 6px; }
    .style-label { font-size: 12px; color: var(--text-primary); display: flex; justify-content: space-between; opacity: 0.85; }
    .style-label span { color: var(--accent-color); font-weight: 600; font-family: monospace; font-size: 11px; opacity: 1; }
    .style-slider { width: 100%; height: 6px; appearance: none; background: var(--border-color); border-radius: 3px; outline: none; cursor: pointer; transition: background 0.15s; }
    .style-slider:hover { background: var(--text-secondary); }
    .style-slider::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: var(--accent-color); border-radius: 50%; cursor: pointer; border: 2px solid var(--bg-primary); box-shadow: 0 1px 4px rgba(0,0,0,0.2); transition: transform 0.1s; }
    .style-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
    .style-slider:active::-webkit-slider-thumb { transform: scale(0.95); }
    .style-select { width: 100%; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; outline: none; cursor: pointer; transition: border-color 0.15s; }
    .style-select:hover { border-color: var(--text-secondary); }
    .style-select:focus { border-color: var(--accent-color); }
    .style-input { width: 100%; padding: 7px 10px; border: 1px solid var(--accent-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; font-family: monospace; outline: none; margin-top: 6px; transition: border-color 0.15s; }
    .style-input::placeholder { color: var(--text-secondary); opacity: 0.5; }

    /* 主题风格卡片 */
    .settings-theme-card-group { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
    .theme-card { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 11px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .theme-card:hover { background: var(--bg-hover); border-color: var(--text-secondary); }
    .theme-card.active { border-color: var(--accent-color); background: var(--bg-active); font-weight: 500; }
    .theme-card-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); }

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
    .doc-stats-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; cursor: pointer; user-select: none; }
    .doc-stats-header:hover { background: var(--bg-hover); }
    .doc-stats-header-text { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-secondary); }
    .doc-stats-arrow { font-size: 10px; color: var(--text-secondary); transition: transform 0.2s; }
    .doc-stats-arrow.open { transform: rotate(90deg); }
    .doc-stats-body { display: none; padding: 8px 16px 16px; }
    .doc-stats-body.open { display: block; }
    .doc-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
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
