import MarkdownIt from "markdown-it";
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
});

// 保存原始 fence 渲染器，用于 Shiki 未初始化或语言不支持时回退
const defaultFenceRenderer = md.renderer.rules.fence;

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
    if (token.type === "fence" && token.info.trim() !== "mermaid") {
      const lang = token.info.trim();
      if (lang) langs.push(lang);
    }
  }
  return langs;
}

/** 解析 Markdown 文本，返回渲染 HTML 和目录树 */
export async function parseMarkdown(source: string): Promise<ParsedDocument> {
  const tokens = md.parse(source, {});

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
  const html = md.renderer.render(tokens, md.options, {});

  return { source, html, headings };
}
