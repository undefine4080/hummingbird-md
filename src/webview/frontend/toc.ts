import type { DocumentStats, Heading, ReadingStyleConfig, ThemeName } from "../../types/index.js";
import { onMessage, postMessage } from "./messaging.js";

/** 字体选项（与 html-generator.ts 中 FontOption 对应） */
interface FontOption {
  value: string;
  label: string;
  detectName: string;
}

/** 字体分组（与 html-generator.ts 中 FontGroup 对应） */
interface FontGroup {
  label: string;
  fonts: FontOption[];
}

/** TOC 专用的 window.__INITIAL_DATA__ 类型 */
interface TocInitialData {
  headings: Heading[];
  theme: "light" | "dark";
  stats: DocumentStats | null;
  readingStyle: ReadingStyleConfig | null;
  themeName: ThemeName;
  fontGroups: FontGroup[];
}

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
    empty.textContent = "当前文档无标题";
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
      case "updateStyle":
        break;
      case "updateThemeName":
        break;
      case "requestScrollPosition":
      case "restoreScrollPosition":
        break;
      case "init":
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

  const data = (window as unknown as { __INITIAL_DATA__: TocInitialData }).__INITIAL_DATA__;
  if (!data) {
    return;
  }

  // 渲染目录
  renderToc(container, data.headings);

  // 应用初始主题
  updateTheme(data.theme);

  // 初始化设置面板
  initSettingsPanel(data.theme);

  // 初始化主题风格选择
  initThemeCards(data.themeName);

  // 初始化阅读样式控件
  initStyleControls(data.readingStyle, data.fontGroups);

  // 初始化文档信息面板
  if (data.stats) {
    initDocStatsPanel(data.stats);
  }

  // 注册消息监听
  setupMessageListeners();
}

/** 初始化设置面板 */
function initSettingsPanel(currentTheme: string): void {
  const toggle = document.getElementById("settings-toggle");
  const arrow = document.getElementById("settings-arrow");
  const body = document.getElementById("settings-body");
  const lightBtn = document.getElementById("theme-btn-light");
  const darkBtn = document.getElementById("theme-btn-dark");

  // 折叠/展开
  toggle?.addEventListener("click", (): void => {
    const isOpen = body?.classList.toggle("open");
    arrow?.classList.toggle("open", isOpen);
  });

  // 主题切换按钮
  const setActiveThemeBtn = (theme: string): void => {
    lightBtn?.classList.toggle("active", theme === "light");
    darkBtn?.classList.toggle("active", theme === "dark");
  };

  setActiveThemeBtn(currentTheme);

  lightBtn?.addEventListener("click", (): void => {
    setActiveThemeBtn("light");
    postMessage({ type: "themeChanged", data: { theme: "light" } });
  });

  darkBtn?.addEventListener("click", (): void => {
    setActiveThemeBtn("dark");
    postMessage({ type: "themeChanged", data: { theme: "dark" } });
  });
}

/** 初始化主题风格卡片选择 */
function initThemeCards(_currentThemeName: ThemeName): void {
  const group = document.getElementById("theme-card-group");
  if (!group) {
    return;
  }

  group.addEventListener("click", (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>(".theme-card");
    if (!card?.dataset.themeName) {
      return;
    }
    const name = card.dataset.themeName as ThemeName;

    // 更新 UI 高亮
    group.querySelectorAll(".theme-card").forEach((el): void => {
      el.classList.toggle("active", el === card);
    });

    // 更新当前页面主题变量
    document.documentElement.dataset.themeName = name;

    // 发送消息
    postMessage({ type: "themeNameChanged", data: { themeName: name } });
  });
}

/** 默认阅读样式 */
const DEFAULT_STYLE: ReadingStyleConfig = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.8,
  paragraphSpacing: 1.0,
};

/** 用 Canvas measureText 检测字体是否已安装 */
function isFontAvailable(fontName: string): boolean {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) { return false; }

  const text = "mmmmmmmmmmlli1IWwO0@#&%测试字体";
  const baselines = ["serif", "sans-serif", "monospace"];

  for (const baseline of baselines) {
    context.font = `72px ${baseline}`;
    const baseWidth = context.measureText(text).width;
    context.font = `72px '${fontName}', ${baseline}`;
    const testWidth = context.measureText(text).width;
    if (testWidth !== baseWidth) { return true; }
  }
  return false;
}

/** 根据候选字体分组和已保存的字体值，动态渲染字体选择器 */
function renderFontSelect(
  select: HTMLSelectElement,
  fontGroups: FontGroup[],
  savedFontFamily: string,
  customInput: HTMLInputElement | null,
): void {
  // 用 Canvas 验证每个字体是否可用，过滤不可用的
  const verifiedGroups: Array<{ label: string; fonts: FontOption[] }> = [];
  for (const group of fontGroups) {
    const available = group.fonts.filter((f): boolean => isFontAvailable(f.detectName));
    if (available.length > 0) {
      verifiedGroups.push({ label: group.label, fonts: available });
    }
  }

  // 合并同名分组（多个 platform 分组可能有相同 label）
  const merged = new Map<string, FontOption[]>();
  for (const g of verifiedGroups) {
    const existing = merged.get(g.label);
    if (existing) {
      existing.push(...g.fonts);
    } else {
      merged.set(g.label, [...g.fonts]);
    }
  }

  // 构建 <option> 元素
  select.innerHTML = "";
  const allValues = new Set<string>();

  for (const [label, fonts] of merged) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    for (const font of fonts) {
      // 去重（同一 value 可能出现在不同平台分组中）
      if (allValues.has(font.value)) { continue; }
      allValues.add(font.value);
      const option = document.createElement("option");
      option.value = font.value;
      option.textContent = font.label;
      optgroup.appendChild(option);
    }
    if (optgroup.childElementCount > 0) {
      select.appendChild(optgroup);
    }
  }

  // 添加自定义选项
  const otherGroup = document.createElement("optgroup");
  otherGroup.label = "其他";
  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "自定义...";
  otherGroup.appendChild(customOption);
  select.appendChild(otherGroup);

  // 设置当前值
  if (allValues.has(savedFontFamily)) {
    select.value = savedFontFamily;
  } else {
    select.value = "__custom__";
    if (customInput) {
      customInput.value = savedFontFamily;
      customInput.style.display = "block";
    }
  }
}

/** 初始化阅读样式控件 */
function initStyleControls(savedStyle: ReadingStyleConfig | null, fontGroups: FontGroup[]): void {
  const style = savedStyle ?? DEFAULT_STYLE;

  const fontSize = document.getElementById("style-font-size") as HTMLInputElement | null;
  const fontSizeVal = document.getElementById("style-font-size-val");
  const fontFamily = document.getElementById("style-font-family") as HTMLSelectElement | null;
  const fontFamilyCustom = document.getElementById("style-font-family-custom") as HTMLInputElement | null;
  const fontWeight = document.getElementById("style-font-weight") as HTMLInputElement | null;
  const fontWeightVal = document.getElementById("style-font-weight-val");
  const lineHeight = document.getElementById("style-line-height") as HTMLInputElement | null;
  const lineHeightVal = document.getElementById("style-line-height-val");
  const paragraphSpacing = document.getElementById("style-paragraph-spacing") as HTMLInputElement | null;
  const paragraphSpacingVal = document.getElementById("style-paragraph-spacing-val");

  // 动态渲染字体选择器
  if (fontFamily) {
    renderFontSelect(fontFamily, fontGroups, style.fontFamily, fontFamilyCustom);
  }

  // 设置初始值
  if (fontSize) { fontSize.value = String(style.fontSize); }
  if (fontSizeVal) { fontSizeVal.textContent = String(style.fontSize); }
  if (fontWeight) { fontWeight.value = String(style.fontWeight); }
  if (fontWeightVal) { fontWeightVal.textContent = String(style.fontWeight); }
  if (lineHeight) { lineHeight.value = String(style.lineHeight); }
  if (lineHeightVal) { lineHeightVal.textContent = String(style.lineHeight); }
  if (paragraphSpacing) { paragraphSpacing.value = String(style.paragraphSpacing); }
  if (paragraphSpacingVal) { paragraphSpacingVal.textContent = String(style.paragraphSpacing); }

  /** 获取当前生效的字体值 */
  const getCurrentFontFamily = (): string => {
    if (fontFamily?.value === "__custom__") {
      return fontFamilyCustom?.value.trim() || DEFAULT_STYLE.fontFamily;
    }
    return fontFamily?.value ?? DEFAULT_STYLE.fontFamily;
  };

  /** 收集当前样式配置并发送消息 */
  const emitStyleChange = (): void => {
    postMessage({
      type: "styleChanged",
      data: {
        fontFamily: getCurrentFontFamily(),
        fontSize: Number(fontSize?.value ?? DEFAULT_STYLE.fontSize),
        fontWeight: Number(fontWeight?.value ?? DEFAULT_STYLE.fontWeight),
        lineHeight: Number(lineHeight?.value ?? DEFAULT_STYLE.lineHeight),
        paragraphSpacing: Number(paragraphSpacing?.value ?? DEFAULT_STYLE.paragraphSpacing),
      },
    });
  };

  // 绑定滑块事件
  fontSize?.addEventListener("input", (): void => {
    if (fontSizeVal) { fontSizeVal.textContent = fontSize.value; }
    emitStyleChange();
  });
  fontFamily?.addEventListener("change", (): void => {
    if (fontFamily.value === "__custom__") {
      if (fontFamilyCustom) {
        fontFamilyCustom.style.display = "block";
        fontFamilyCustom.focus();
      }
    } else {
      if (fontFamilyCustom) { fontFamilyCustom.style.display = "none"; }
      emitStyleChange();
    }
  });
  fontFamilyCustom?.addEventListener("input", (): void => {
    emitStyleChange();
  });
  fontWeight?.addEventListener("input", (): void => {
    if (fontWeightVal) { fontWeightVal.textContent = fontWeight.value; }
    emitStyleChange();
  });
  lineHeight?.addEventListener("input", (): void => {
    if (lineHeightVal) { lineHeightVal.textContent = lineHeight.value; }
    emitStyleChange();
  });
  paragraphSpacing?.addEventListener("input", (): void => {
    if (paragraphSpacingVal) { paragraphSpacingVal.textContent = paragraphSpacing.value; }
    emitStyleChange();
  });
}

/** 初始化文档信息面板 */
function initDocStatsPanel(stats: DocumentStats): void {
  const toggle = document.getElementById("doc-stats-toggle");
  const arrow = document.getElementById("doc-stats-arrow");
  const body = document.getElementById("doc-stats-body");
  const grid = document.getElementById("doc-stats-grid");

  if (!toggle || !arrow || !body || !grid) {
    return;
  }

  // 折叠/展开
  toggle.addEventListener("click", (): void => {
    const isOpen = body.classList.toggle("open");
    arrow.classList.toggle("open", isOpen);
  });

  // 渲染统计项
  const items: Array<{ label: string; value: string; full?: boolean; copyable?: boolean }> = [
    { label: "字数", value: String(stats.wordCount) },
    { label: "字符数", value: String(stats.charCount) },
    { label: "段落数", value: String(stats.paragraphCount) },
    { label: "文件大小", value: stats.fileSize },
    { label: "文件路径", value: stats.filePath, full: true, copyable: true },
    { label: "创建日期", value: stats.createdDate },
    { label: "修改日期", value: stats.modifiedDate },
  ];

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const el = document.createElement("div");
    el.className = "stat-item" + (item.full ? " stat-item-full" : "");
    el.innerHTML = `<span class="stat-label">${item.label}</span><span class="stat-value${item.copyable ? " stat-path" : ""}" title="${item.copyable ? "点击复制" : item.value}">${item.value}</span>`;

    if (item.copyable) {
      const valueEl = el.querySelector<HTMLElement>(".stat-value");
      valueEl?.addEventListener("click", (): void => {
        void navigator.clipboard.writeText(item.value).then((): void => {
          if (valueEl) {
            valueEl.classList.add("copied");
            const orig = valueEl.textContent ?? "";
            valueEl.textContent = "已复制";
            setTimeout((): void => {
              valueEl.classList.remove("copied");
              valueEl.textContent = orig;
            }, 1500);
          }
        });
      });
    }

    fragment.appendChild(el);
  }
  grid.appendChild(fragment);
}
