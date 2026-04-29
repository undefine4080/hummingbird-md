import MarkdownIt from "markdown-it";
import type { Heading, ParsedDocument } from "../types/index.js";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

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
function extractAndApplyHeadingIds(tokens: MarkdownIt.Token[]): Heading[] {
  const headings: Heading[] = [];
  const stack: Heading[] = [];
  const usedIds = new Set<string>();
  const flatHeadings: Heading[] = [];

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
      flatHeadings.push(heading);

      // 直接在 token 上设置 id 属性，渲染器会自动输出到 HTML
      token.attrSet("id", id);
    }
  }

  return headings;
}

/** 解析 Markdown 文本，返回渲染 HTML 和目录树 */
export function parseMarkdown(source: string): ParsedDocument {
  const tokens = md.parse(source, {});
  const headings = extractAndApplyHeadingIds(tokens);
  // 直接用已修改的 token 渲染，ID 已在 token 上设置，无需后处理
  const html = md.renderer.render(tokens, md.options, {});

  return { source, html, headings };
}
