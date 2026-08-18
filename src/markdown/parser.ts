import MarkdownIt from "markdown-it";
import markdownItKatex from "@vscode/markdown-it-katex";
import katex from "katex";
import type { Heading, ParsedDocument } from "../types/index.js";
import {
  bundledLanguages,
  bundledThemes,
  createJavaScriptRegexEngine,
} from "shiki";
import type { Highlighter } from "shiki";

/** markdown-it 的 Token 类型（通过返回值推导，避免跨模块类型引用问题） */
type MdToken = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

const LIGHT_THEME = "github-light";
const DARK_THEME = "github-dark";

/** highlighter 单例 */
let highlighter: Highlighter | null = null;

/** 初始化 Shiki highlighter，插件激活时调用一次 */
export async function initHighlighter(): Promise<void> {
  if (highlighter) return;
  const { createBundledHighlighter } = await import("shiki/core");
  const factory = createBundledHighlighter({
    langs: bundledLanguages,
    themes: bundledThemes,
    engine: () => createJavaScriptRegexEngine(),
  });
  highlighter = await factory({
    themes: [LIGHT_THEME, DARK_THEME],
    langs: [],
  });
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(markdownItKatex, {
  enableBareBlocks: true,
  enableFencedBlocks: true,
  throwOnError: false,
});

/** 查找未被反斜杠转义的数学结束标记。 */
function findUnescapedDelimiter(
  source: string,
  delimiter: string,
  start: number,
): number {
  let index = start;
  while ((index = source.indexOf(delimiter, index)) >= 0) {
    let slashCount = 0;
    for (
      let cursor = index - 1;
      cursor >= 0 && source[cursor] === "\\";
      cursor--
    ) {
      slashCount++;
    }
    if (slashCount % 2 === 0) {
      return index;
    }
    index += delimiter.length;
  }
  return -1;
}

/** 转义公式错误提示中的 HTML 特殊字符。 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 渲染方括号形式的 TeX 公式。 */
function renderBracketMath(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source.trim(), {
      displayMode,
      throwOnError: false,
    });
  } catch {
    const escaped = escapeHtml(source);
    return `<span class="katex-error" title="${escaped}">${escaped}</span>`;
  }
}

// 支持 LaTeX 常见的 \\(inline\\) 和 \\[block\\] 分隔符。
md.inline.ruler.before(
  "escape",
  "math_bracket_inline",
  (state, silent): boolean => {
    if (state.src.slice(state.pos, state.pos + 2) !== "\\(") {
      return false;
    }

    const contentStart = state.pos + 2;
    const closingIndex = findUnescapedDelimiter(state.src, "\\)", contentStart);
    if (closingIndex < 0) {
      return false;
    }

    if (!silent) {
      const token = state.push("math_bracket_inline", "math", 0);
      token.markup = "\\(\\)";
      token.content = state.src.slice(contentStart, closingIndex);
    }
    state.pos = closingIndex + 2;
    return true;
  },
);

md.block.ruler.after(
  "math_block",
  "math_bracket_block",
  (state, startLine, endLine, silent): boolean => {
    const openingStart = state.bMarks[startLine] + state.tShift[startLine];
    const lineEnd = state.eMarks[startLine];
    const firstLine = state.src.slice(openingStart, lineEnd).trimStart();
    if (!firstLine.startsWith("\\[")) {
      return false;
    }

    const contentStart =
      openingStart + state.src.slice(openingStart, lineEnd).indexOf("\\[") + 2;
    const closingIndex = findUnescapedDelimiter(state.src, "\\]", contentStart);
    if (closingIndex < 0) {
      return false;
    }

    const closingLine =
      startLine +
      state.src.slice(state.bMarks[startLine], closingIndex).split("\n")
        .length -
      1;
    if (closingLine >= endLine) {
      return false;
    }

    const trailingText = state.src
      .slice(closingIndex + 2, state.eMarks[closingLine])
      .trim();
    if (trailingText.length > 0) {
      return false;
    }

    if (!silent) {
      const token = state.push("math_bracket_block", "math", 0);
      token.block = true;
      token.markup = "\\[\\]";
      token.content = state.src.slice(contentStart, closingIndex);
      token.map = [startLine, closingLine + 1];
    }
    state.line = closingLine + 1;
    return true;
  },
);

md.renderer.rules.math_bracket_inline = (tokens, idx): string => {
  return renderBracketMath(tokens[idx].content, false);
};
md.renderer.rules.math_bracket_block = (tokens, idx): string => {
  return `<p class="katex-block">${renderBracketMath(tokens[idx].content, true)}</p>\n`;
};

// 保存原始 fence 渲染器，用于 Shiki 未初始化或语言不支持时回退
const defaultFenceRenderer = md.renderer.rules.fence;
const defaultImageRenderer = md.renderer.rules.image;
const defaultTableOpenRenderer = md.renderer.rules.table_open;
const defaultTableCloseRenderer = md.renderer.rules.table_close;

/** Markdown 渲染时与当前文档相关的资源解析配置。 */
export interface MarkdownRenderOptions {
  /** 将 Markdown 图片地址转换为 Webview 可访问的地址。 */
  resolveImageUrl?: (source: string) => string;
}

// 自定义 fence 渲染器：mermaid → 前端渲染，其他 → Shiki 语法高亮
md.renderer.rules.fence = (tokens, idx, options, env, self): string => {
  const token = tokens[idx];
  if (token.info.trim() === "mermaid") {
    const escaped = token.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<div class="mermaid">${escaped}</div>`;
  }

  // Shiki 高亮（同步调用，语言已在前置加载阶段准备就绪）
  if (highlighter) {
    const lang = token.info.trim() || "text";
    const loadedLangs = highlighter.getLoadedLanguages();
    if ((loadedLangs as readonly string[]).includes(lang)) {
      return highlighter.codeToHtml(token.content, {
        lang: lang as Parameters<typeof highlighter.codeToHtml>[1]["lang"],
        themes: { light: LIGHT_THEME, dark: DARK_THEME },
      });
    }
  }

  // 回退到 markdown-it 默认渲染
  if (defaultFenceRenderer) {
    return defaultFenceRenderer(tokens, idx, options, env, self);
  }
  return "";
};

// 解析本地图片地址，外部和 data/blob 地址保持原样。
md.renderer.rules.image = (tokens, idx, options, env, self): string => {
  const token = tokens[idx];
  const source = token.attrGet("src");
  const renderOptions = env as MarkdownRenderOptions;
  if (source && renderOptions.resolveImageUrl) {
    token.attrSet("src", renderOptions.resolveImageUrl(source));
  }

  if (defaultImageRenderer) {
    return defaultImageRenderer(tokens, idx, options, env, self);
  }
  return self.renderToken(tokens, idx, options);
};

// 为宽表格增加局部横向滚动容器，避免撑开阅读器主容器。
md.renderer.rules.table_open = (tokens, idx, options, env, self): string => {
  const tableHtml = defaultTableOpenRenderer
    ? defaultTableOpenRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
  return `<div class="table-scroll" role="region" tabindex="0" aria-label="可横向滚动的表格">${tableHtml}`;
};

md.renderer.rules.table_close = (tokens, idx, options, env, self): string => {
  const tableHtml = defaultTableCloseRenderer
    ? defaultTableCloseRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
  return `${tableHtml}</div>`;
};

/** 为标题生成锚点 ID */
function generateHeadingId(text: string, existingIds: Set<string>): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, "-")
    .replace(/^-|-$/g, "");

  let id = base;
  let counter = 1;
  while (existingIds.has(id)) {
    id = `${base}-${counter}`;
    counter++;
  }
  existingIds.add(id);
  return id;
}

/** 从 token 流中提取标题信息，并在 token 上设置 id 属性 */
function extractAndApplyHeadingIds(tokens: MdToken[]): Heading[] {
  const headings: Heading[] = [];
  const stack: Heading[] = [];
  const usedIds = new Set<string>();

  for (const token of tokens) {
    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1), 10);
      const inlineToken = tokens[tokens.indexOf(token) + 1];
      const text = inlineToken?.content ?? "";
      const id = generateHeadingId(text, usedIds);

      const heading: Heading = { level, text, id, children: [] };

      // 构建树形结构：找到父级
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(heading);
      } else {
        headings.push(heading);
      }

      stack.push(heading);
      token.attrSet("id", id);
    }
  }

  return headings;
}

/** 从 token 流中收集所有非 mermaid 代码块的语言标识 */
function collectFenceLanguages(tokens: MdToken[]): string[] {
  const langs: string[] = [];
  for (const token of tokens) {
    if (
      token.type === "fence" &&
      token.info.trim() !== "mermaid" &&
      token.info.trim().toLowerCase() !== "math"
    ) {
      const lang = token.info.trim();
      if (lang) langs.push(lang);
    }
  }
  return langs;
}

/** 解析 Markdown 文本，返回渲染 HTML 和目录树 */
export async function parseMarkdown(
  source: string,
  renderOptions: MarkdownRenderOptions = {},
): Promise<ParsedDocument> {
  const tokens = md.parse(source, renderOptions);

  // 按需加载代码块中使用的语言
  if (highlighter) {
    const langs = collectFenceLanguages(tokens);
    const loadedLangs = new Set<string>(highlighter.getLoadedLanguages());
    for (const lang of langs) {
      if (!loadedLangs.has(lang)) {
        try {
          await highlighter.loadLanguage(
            lang as Parameters<typeof highlighter.loadLanguage>[0],
          );
        } catch {
          // 语言不支持，回退到默认渲染
        }
      }
    }
  }

  const headings = extractAndApplyHeadingIds(tokens);
  const html = md.renderer.render(tokens, md.options, renderOptions);

  return { source, html, headings };
}
