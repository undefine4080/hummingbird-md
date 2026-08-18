import MarkdownIt from "markdown-it";
import markdownItKatex from "@vscode/markdown-it-katex";
import katex from "katex";
import type { Heading, ParsedDocument } from "../types/index.js";
import {
  extractCodePathCandidate,
  type CodePathCandidate,
} from "./code-path.js";
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
const defaultCodeInlineRenderer = md.renderer.rules.code_inline;

/** Markdown 渲染时与当前文档相关的资源解析配置。 */
export interface MarkdownRenderOptions {
  /** 将 Markdown 图片地址转换为 Webview 可访问的地址。 */
  resolveImageUrl?: (source: string) => string;

  /**
   * 解析代码 span 中的文件引用为链接地址。
   *
   * 返回 undefined 表示目标不存在或不可访问，保持纯代码样式。
   * 文件存在性校验由调用方完成（vscode 依赖由调用方注入）。
   */
  resolveCodePathHref?: (
    candidate: CodePathCandidate,
  ) => Promise<string | undefined>;
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

/**
 * 收集需要解析的 code_inline token（跳过显式链接内的，按 token 引用返回）。
 *
 * 链接内的 code span 已有 href，再包一层会造成嵌套链接。
 */
function collectCodePathCandidates(
  tokens: MdToken[],
): Map<MdToken, CodePathCandidate> {
  const candidates = new Map<MdToken, CodePathCandidate>();

  const walk = (list: MdToken[], linkDepth: number): void => {
    let depth = linkDepth;
    for (const token of list) {
      if (token.type === "link_open") {
        depth++;
        continue;
      }
      if (token.type === "link_close") {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (token.type === "code_inline") {
        if (depth === 0) {
          const candidate = extractCodePathCandidate(token.content);
          if (candidate) {
            candidates.set(token, candidate);
          }
        }
        continue;
      }
      if (token.children) {
        walk(token.children, depth);
      }
    }
  };

  walk(tokens, 0);
  return candidates;
}

/** code_inline token → 已解析的文件链接地址。每次解析重新填充，随 token 回收。 */
const codePathHrefByToken = new WeakMap<MdToken, string>();

// 命中文件引用的代码 span 渲染为链接，未命中保持纯代码样式。
md.renderer.rules.code_inline = (tokens, idx, options, env, self): string => {
  const token = tokens[idx];
  const codeHtml = defaultCodeInlineRenderer
    ? defaultCodeInlineRenderer(tokens, idx, options, env, self)
    : `<code>${escapeHtml(token.content)}</code>`;

  const href = codePathHrefByToken.get(token);
  if (!href) {
    return codeHtml;
  }
  return `<a class="code-link" href="${href}">${codeHtml.trimEnd()}</a>\n`;
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

  // 两阶段：先集中解析代码路径候选（含文件存在性校验），再渲染
  if (renderOptions.resolveCodePathHref) {
    const candidates = collectCodePathCandidates(tokens);
    if (candidates.size > 0) {
      const resolver = renderOptions.resolveCodePathHref;
      // 相同内容只解析一次，但结果绑定到每个 token，避免误包装链接内的同名 span
      const contents = new Set<string>();
      for (const token of candidates.keys()) {
        contents.add(token.content);
      }
      const entries = await Promise.all(
        Array.from(
          contents,
          async (content): Promise<[string, string] | null> => {
            const candidate = extractCodePathCandidate(content);
            if (!candidate) {
              return null;
            }
            const href = await resolver(candidate);
            return href ? [content, href] : null;
          },
        ),
      );
      const hrefs = new Map<string, string>();
      for (const entry of entries) {
        if (entry) {
          hrefs.set(entry[0], entry[1]);
        }
      }
      for (const [token] of candidates) {
        const href = hrefs.get(token.content);
        if (href) {
          codePathHrefByToken.set(token, href);
        }
      }
    }
  }

  const html = md.renderer.render(tokens, md.options, renderOptions);

  return { source, html, headings };
}
