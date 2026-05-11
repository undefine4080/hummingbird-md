/** Markdown heading 信息 */
export interface Heading {
  /** 层级 (1-6) */
  level: number;
  /** 标题文本 */
  text: string;
  /** 锚点 ID（用于滚动定位） */
  id: string;
  /** 子标题 */
  children: Heading[];
}

/** 解析后的 Markdown 文档结构 */
export interface ParsedDocument {
  /** 原始 Markdown 文本 */
  source: string;
  /** 渲染后的 HTML */
  html: string;
  /** 目录树 */
  headings: Heading[];
}

/** 文档统计信息 */
export interface DocumentStats {
  /** 字数（中文字符 + 英文单词） */
  wordCount: number;
  /** 字符数（含标点和空格） */
  charCount: number;
  /** 段落数 */
  paragraphCount: number;
  /** 格式化的文件大小 */
  fileSize: string;
  /** 文件绝对路径 */
  filePath: string;
  /** 创建日期 */
  createdDate: string;
  /** 修改日期 */
  modifiedDate: string;
}

/** Webview 与插件之间的消息协议 */
export namespace MessageProtocol {
  /** 插件 → Webview 的消息 */
  export type ToWebview =
    | { type: "init"; data: { html: string; headings: Heading[]; theme: Theme } }
    | { type: "updateTheme"; data: { theme: Theme } }
    | { type: "highlightHeading"; data: { id: string } }
    | { type: "updateStyle"; data: ReadingStyleConfig }
    | { type: "updateThemeName"; data: { themeName: ThemeName } };

  /** Webview → 插件的消息 */
  export type ToExtension =
    | { type: "headingChanged"; data: { id: string } }
    | { type: "themeChanged"; data: { theme: Theme } }
    | { type: "fontChanged"; data: { fontFamily: string; fontSize: number; fontWeight: number } }
    | { type: "styleChanged"; data: ReadingStyleConfig }
    | { type: "themeNameChanged"; data: { themeName: ThemeName } }
    | { type: "openMermaidFullscreen"; data: { source: string } }
    | { type: "ready" };

  /** 主题类型 */
  export type Theme = "light" | "dark";
}

/** 字体配置 */
export interface FontConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}

/** 阅读样式配置 */
export interface ReadingStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  paragraphSpacing: number;
}

export type Theme = "light" | "dark";

/** 主题风格名称 */
export type ThemeName =
  | "classic"
  | "github"
  | "vue"
  | "minimal"
  | "dracula"
  | "solarized"
  | "nord"
  | "gruvbox"
  | "catppuccin"
  | "everforest"
  | "rose-pine"
  | "one-dark"
  | "notion"
  | "ayu"
  | "flexoki";
