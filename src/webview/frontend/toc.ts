import type { Heading } from "../../types/index.js";
import { onMessage, postMessage } from "./messaging.js";

/** window.__INITIAL_DATA__ 的类型定义 */
interface InitialData {
  headings: Heading[];
  theme: "light" | "dark";
}

declare const __INITIAL_DATA__: InitialData;

/** 当前高亮的 heading ID */
let _activeId: string | null = null;

/** 将嵌套的 heading 树扁平化为一维数组 */
function flattenHeadings(headings: Heading[]): Heading[] {
  const result: Heading[] = [];
  for (const heading of headings) {
    result.push(heading);
    if (heading.children.length > 0) {
      result.push(...flattenHeadings(heading.children));
    }
  }
  return result;
}

/** 创建单个 TOC 项元素 */
function createTocItem(heading: Heading): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "toc-item";
  item.dataset.level = String(heading.level);
  item.dataset.id = heading.id;
  item.textContent = heading.text;
  return item;
}

/** 渲染目录列表到容器中 */
function renderToc(container: HTMLElement, headings: Heading[]): void {
  // 清空现有内容
  container.innerHTML = "";

  if (headings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "toc-empty";
    empty.textContent = "此文档没有标题";
    container.appendChild(empty);
    return;
  }

  const flat = flattenHeadings(headings);
  const fragment = document.createDocumentFragment();
  for (const heading of flat) {
    fragment.appendChild(createTocItem(heading));
  }
  container.appendChild(fragment);

  // 使用事件委托：在容器上统一监听 click
  container.addEventListener("click", (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const tocItem = target.closest<HTMLElement>(".toc-item");
    if (tocItem?.dataset.id) {
      handleTocItemClick(tocItem.dataset.id);
    }
  });
}

/** 处理 TOC 项点击事件 */
function handleTocItemClick(id: string): void {
  // 先发消息，再做 UI 更新，避免 UI 操作异常阻断消息发送
  postMessage({ type: "headingChanged", data: { id } });
  setActiveItem(id);
}

/** 设置当前高亮的 TOC 项 */
function setActiveItem(id: string): void {
  // 移除旧的高亮
  const prev = document.querySelector(".toc-item.active");
  if (prev) {
    prev.classList.remove("active");
  }

  // 添加新的高亮
  const target = document.querySelector<HTMLElement>(`.toc-item[data-id="${id}"]`);
  if (target) {
    target.classList.add("active");
    // 如果目标不在可视区域，滚动到可视区域
    if (!isElementInViewport(target)) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  _activeId = id;
}

/** 检查元素是否在可视区域内 */
function isElementInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/** 更新主题 */
function updateTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
}

/** 监听来自插件主进程的消息 */
function setupMessageListeners(): void {
  onMessage((message) => {
    switch (message.type) {
      case "highlightHeading":
        setActiveItem(message.data.id);
        break;
      case "updateTheme":
        updateTheme(message.data.theme);
        break;
      case "init":
        // TOC 侧边栏不处理 init 消息
        break;
    }
  });
}

/** 初始化 TOC 组件 */
export function initToc(): void {
  const container = document.getElementById("toc-root");
  if (!container) {
    return;
  }

  const data = (window as unknown as { __INITIAL_DATA__: InitialData }).__INITIAL_DATA__;
  if (!data) {
    return;
  }

  // 渲染目录
  renderToc(container, data.headings);

  // 应用初始主题
  updateTheme(data.theme);

  // 注册消息监听
  setupMessageListeners();
}
