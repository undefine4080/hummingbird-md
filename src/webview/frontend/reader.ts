/**
 * 阅读器主逻辑
 *
 * 负责：滚动检测（Intersection Observer）、字体配置、主题切换、Heading 高亮。
 */

import type { FontConfig, MessageProtocol, ReadingStyleConfig, Theme } from "../../types/index.js";
import { onMessage, postMessage } from "./messaging.js";

type ToWebview = MessageProtocol.ToWebview;

/** 当前被高亮的 heading ID */
let activeHeadingId = "";

/** 程序化滚动期间抑制 headingChanged 消息 */
let suppressHeadingChange = false;

/** Intersection Observer 实例 */
let headingObserver: IntersectionObserver | null = null;

/** 消息监听器卸载函数（预留给后续销毁场景使用） */
let _detachMessageListener: (() => void) | null = null;

/**
 * 初始化阅读器
 *
 * 设置滚动检测、字体配置监听、主题切换监听和 heading 高亮监听。
 */
export function initReader(): void {
  setupHeadingObserver();
  setupMessageListeners();
  initCodeBlockCopy();

  // 应用保存的阅读样式配置
  const data = window.__INITIAL_DATA__;
  if (data?.readingStyle) {
    applyReadingStyle(data.readingStyle);
  }
}

/** 使用 Intersection Observer 检测当前可见的 heading */
function setupHeadingObserver(): void {
  const headings = getVisibleHeadings();
  if (headings.length === 0) {
    return;
  }

  headingObserver = new IntersectionObserver(
    (entries): void => {
      // 找到当前可见区域中位于最上方的 heading
      let topId = "";
      let topY = Infinity;

      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        const rect = entry.boundingClientRect;
        // 选 y 值最小的（最靠近顶部的）
        if (rect.top < topY) {
          topY = rect.top;
          const target = entry.target;
          if (target instanceof HTMLElement && target.id) {
            topId = target.id;
          }
        }
      }

      if (topId && topId !== activeHeadingId && !suppressHeadingChange) {
        activeHeadingId = topId;
        postMessage({ type: "headingChanged", data: { id: topId } });
      }
    },
    {
      // 在视口顶部附近建立检测区域
      rootMargin: "-10% 0px -80% 0px",
      threshold: 0,
    },
  );

  for (const heading of headings) {
    headingObserver.observe(heading);
  }
}

/** 获取页面中所有带有 id 的 heading 元素 */
function getVisibleHeadings(): HTMLElement[] {
  const container = document.querySelector<HTMLElement>("#reader-content");
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"));
}

/** 监听来自插件主进程的消息 */
function setupMessageListeners(): void {
  _detachMessageListener = onMessage(handleMessage);
}

/** 处理插件主进程发来的消息 */
function handleMessage(message: ToWebview): void {
  switch (message.type) {
    case "updateTheme":
      break;
    case "updateStyle":
      applyReadingStyle(message.data);
      break;
    case "updateThemeName":
      document.documentElement.dataset.themeName = message.data.themeName;
      break;
    case "highlightHeading":
      scrollToHeading(message.data.id);
      break;
    case "requestScrollPosition":
      postMessage({ type: "scrollPosition", data: { scrollY: window.scrollY } });
      break;
    case "restoreScrollPosition":
      window.scrollTo({ top: message.data.scrollY, behavior: "instant" as ScrollBehavior });
      break;
    case "init":
      break;
    default:
      break;
  }
}

/** 应用主题（切换 data-theme 属性，CSS 变量自动响应） */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** 监听字体配置变化（由 postMessage 的 fontChanged 类型触发） */
export function applyFontConfig(config: FontConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--hb-font-family", config.fontFamily);
  root.style.setProperty("--hb-font-size", `${config.fontSize}px`);
  root.style.setProperty("--hb-font-weight", `${config.fontWeight}`);
}

/** 应用阅读样式配置 */
export function applyReadingStyle(config: ReadingStyleConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--hb-font-family", config.fontFamily);
  root.style.setProperty("--hb-font-size", `${config.fontSize}px`);
  root.style.setProperty("--hb-font-weight", `${config.fontWeight}`);
  root.style.setProperty("--hb-line-height", String(config.lineHeight));
  root.style.setProperty("--hb-paragraph-spacing", `${config.paragraphSpacing}em`);
}

/**
 * 滚动到指定 heading 并高亮
 *
 * @param id - heading 的 DOM id
 */
function scrollToHeading(id: string): void {
  const target = document.getElementById(id);
  if (!target) {
    return;
  }

  // 立即更新高亮 ID，防止 Observer 重复触发
  activeHeadingId = id;

  // 抑制滚动过程中的 headingChanged 消息
  suppressHeadingChange = true;

  // 平滑滚动到目标位置
  target.scrollIntoView({ behavior: "smooth", block: "start" });

  // 滚动结束后恢复
  setTimeout((): void => {
    suppressHeadingChange = false;
  }, 1000);

  // 添加短暂高亮动画
  target.classList.add("heading-highlight");
  setTimeout((): void => {
    target.classList.remove("heading-highlight");
  }, 2000);
}

/** 复制图标 SVG */
const COPY_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11V3a1.5 1.5 0 0 1 1.5-1.5H11"/></svg>';

/** 成功图标 SVG */
const CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg>';

/** 全屏图标 SVG */
const FULLSCREEN_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>';

/** 为所有代码块添加复制和全屏按钮 */
function initCodeBlockCopy(): void {
  const blocks = document.querySelectorAll<HTMLElement>("#reader-content pre");
  blocks.forEach((pre: HTMLElement): void => {
    if (pre.classList.contains("mermaid")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.title = "复制代码";
    copyBtn.innerHTML = COPY_ICON;

    copyBtn.addEventListener("click", (): void => {
      const code = pre.querySelector("code");
      const text = code?.textContent ?? pre.textContent ?? "";
      void navigator.clipboard.writeText(text).then((): void => {
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.classList.add("copied");
        setTimeout((): void => {
          copyBtn.innerHTML = COPY_ICON;
          copyBtn.classList.remove("copied");
        }, 1500);
      });
    });

    wrapper.appendChild(copyBtn);

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.className = "code-copy-btn";
    fullscreenBtn.title = "全屏查看";
    fullscreenBtn.innerHTML = FULLSCREEN_ICON;
    fullscreenBtn.style.right = "36px";

    fullscreenBtn.addEventListener("click", (): void => {
      showCodeFullscreen(pre);
    });

    wrapper.appendChild(fullscreenBtn);
  });

  bindCodeFullscreenEvents();
}

/** 显示代码全屏 overlay */
function showCodeFullscreen(pre: HTMLElement): void {
  const overlay = document.getElementById("code-fullscreen-overlay");
  const content = document.getElementById("code-fullscreen-content");
  if (!overlay || !content) {
    return;
  }

  const clone = pre.cloneNode(true) as HTMLElement;
  content.innerHTML = "";
  content.appendChild(clone);
  overlay.classList.add("active");
}

/** 关闭代码全屏 overlay */
function closeCodeFullscreen(): void {
  const overlay = document.getElementById("code-fullscreen-overlay");
  const content = document.getElementById("code-fullscreen-content");
  if (overlay) {
    overlay.classList.remove("active");
  }
  if (content) {
    content.innerHTML = "";
  }
}

/** 绑定代码全屏 overlay 事件 */
function bindCodeFullscreenEvents(): void {
  document.getElementById("cf-close")?.addEventListener("click", (): void => {
    closeCodeFullscreen();
  });

  const overlay = document.getElementById("code-fullscreen-overlay");
  overlay?.addEventListener("click", (e): void => {
    if (e.target === overlay) {
      closeCodeFullscreen();
    }
  });

  document.addEventListener("keydown", (e: KeyboardEvent): void => {
    if (e.key === "Escape" && overlay?.classList.contains("active")) {
      e.preventDefault();
      closeCodeFullscreen();
    }
  });
}
