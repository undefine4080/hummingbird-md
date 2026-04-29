import mermaid from "mermaid";
import type { Theme } from "../../types/index.js";

/** window.__INITIAL_DATA__ 的类型声明 */
interface InitialData {
  headings: unknown;
  theme: Theme;
}

declare global {
  interface Window {
    __INITIAL_DATA__: InitialData;
  }
}

/** 当前全屏展示的图表索引（-1 表示未展示） */
let currentDiagramIndex = -1;

/** 缓存所有渲染成功的 SVG 内容，索引自增对应 */
const diagramSvgs: string[] = [];

/**
 * 获取当前主题对应的 mermaid 主题名
 */
function getMermaidThemeName(): "dark" | "default" {
  const theme = window.__INITIAL_DATA__?.theme;
  return theme === "dark" ? "dark" : "default";
}

/**
 * 初始化 mermaid 配置
 */
function initMermaidConfig(): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: getMermaidThemeName(),
    securityLevel: "loose",
  });
}

/**
 * 将 SVG 字符串转为 JPG 并触发下载
 */
function downloadSvgAsJpg(svgHtml: string, diagramIndex: number): void {
  // 克隆 SVG 并确保有 xmlns 属性
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgHtml, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) {
    return;
  }

  // 确保 SVG 有 xmlns 属性，否则无法作为图片加载
  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // 获取 SVG 的尺寸
  const width = svgEl.getAttribute("width");
  const height = svgEl.getAttribute("height");
  const viewBox = svgEl.getAttribute("viewBox");

  // 如果没有明确的宽高，从 viewBox 推算
  let svgWidth = 800;
  let svgHeight = 600;
  if (width && height) {
    svgWidth = parseFloat(width);
    svgHeight = parseFloat(height);
  } else if (viewBox) {
    const parts = viewBox.split(/[\s,]+/);
    if (parts.length >= 4) {
      svgWidth = parseFloat(parts[2]);
      svgHeight = parseFloat(parts[3]);
    }
  }

  // 设置明确的宽高属性
  svgEl.setAttribute("width", String(svgWidth));
  svgEl.setAttribute("height", String(svgHeight));

  // 序列化 SVG 并构造 data URL
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  // 通过 Image 加载 SVG 后绘制到 Canvas
  const img = new Image();
  img.onload = (): void => {
    const scale = 2; // 2x 分辨率，提升清晰度
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }

    // 白色背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    // 导出为 JPG 并触发下载
    canvas.toBlob((blob: Blob | null): void => {
      if (!blob) {
        URL.revokeObjectURL(url);
        return;
      }
      const jpgUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = jpgUrl;
      link.download = `mermaid-diagram-${diagramIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(jpgUrl);
      URL.revokeObjectURL(url);
    }, "image/jpeg", 0.95);
  };

  img.onerror = (): void => {
    URL.revokeObjectURL(url);
  };

  img.src = url;
}

/**
 * 显示 mermaid 全屏 overlay
 */
function showFullscreen(diagramIndex: number): void {
  const overlay = document.getElementById("mermaid-fullscreen-overlay");
  const content = document.getElementById("mermaid-fullscreen-content");
  const title = document.getElementById("mf-title");

  if (!overlay || !content || !title) {
    return;
  }

  currentDiagramIndex = diagramIndex;
  title.textContent = `Mermaid 图表 #${diagramIndex + 1}`;

  // 将缓存的 SVG 插入全屏容器
  content.innerHTML = diagramSvgs[diagramIndex] ?? "";
  overlay.classList.add("active");
}

/**
 * 关闭 mermaid 全屏 overlay
 */
function closeFullscreen(): void {
  const overlay = document.getElementById("mermaid-fullscreen-overlay");
  const content = document.getElementById("mermaid-fullscreen-content");

  if (overlay) {
    overlay.classList.remove("active");
  }
  if (content) {
    content.innerHTML = "";
  }
  currentDiagramIndex = -1;
}

/**
 * 绑定全屏 overlay 的交互事件（关闭、下载）
 */
function bindOverlayEvents(): void {
  const closeBtn = document.getElementById("mf-close");
  const downloadBtn = document.getElementById("mf-download");

  if (closeBtn) {
    closeBtn.addEventListener("click", (): void => {
      closeFullscreen();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", (): void => {
      if (currentDiagramIndex >= 0 && diagramSvgs[currentDiagramIndex]) {
        downloadSvgAsJpg(diagramSvgs[currentDiagramIndex], currentDiagramIndex);
      }
    });
  }

  // Esc 关闭
  document.addEventListener("keydown", (e: KeyboardEvent): void => {
    if (e.key === "Escape" && currentDiagramIndex >= 0) {
      closeFullscreen();
    }
  });
}

/**
 * 创建 mermaid 渲染失败的错误展示元素
 */
function createErrorElement(source: string, errorMessage: string): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "mermaid-container mermaid-error";

  // 错误标题
  const titleEl = document.createElement("div");
  titleEl.className = "mermaid-error-title";
  titleEl.textContent = "Mermaid 语法解析失败";
  container.appendChild(titleEl);

  // 详细错误信息
  const errorEl = document.createElement("div");
  errorEl.style.cssText = "color: #e74c3c; font-size: 13px; margin-bottom: 12px;";
  errorEl.textContent = errorMessage;
  container.appendChild(errorEl);

  // 折叠展示原始代码
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "查看原始代码";
  summary.style.cssText = "cursor: pointer; font-size: 13px; color: #e74c3c; margin-bottom: 8px;";
  details.appendChild(summary);

  const pre = document.createElement("pre");
  pre.textContent = source;
  details.appendChild(pre);

  container.appendChild(details);
  return container;
}

/**
 * 渲染单个 mermaid 图表
 */
async function renderSingleDiagram(
  el: HTMLElement,
  index: number,
): Promise<void> {
  if (!el.parentNode) {
    return;
  }

  const source = el.textContent ?? "";
  const diagramId = `mermaid-diagram-${index}`;

  try {
    const result = await mermaid.render(diagramId, source);

    diagramSvgs[index] = result.svg;

    const container = document.createElement("div");
    container.className = "mermaid-container";
    container.id = diagramId;
    container.innerHTML = result.svg;

    el.parentNode.replaceChild(container, el);

    if (result.bindFunctions) {
      result.bindFunctions(container);
    }

    container.addEventListener("click", (): void => {
      showFullscreen(index);
    });
  } catch (error: unknown) {
    const err = error as { message?: string; str?: string };
    const errorMessage = err?.message ?? err?.str ?? String(error);

    diagramSvgs[index] = "";

    const errorContainer = createErrorElement(source, errorMessage);
    errorContainer.id = diagramId;

    el.parentNode.replaceChild(errorContainer, el);
  }
}

/**
 * 渲染页面中的所有 mermaid 图表
 *
 * 顺序执行渲染，避免 mermaid 内部全局状态冲突
 */
async function renderMermaidBlocks(): Promise<void> {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(".mermaid"));
  if (elements.length === 0) {
    return;
  }

  for (let i = 0; i < elements.length; i++) {
    await renderSingleDiagram(elements[i], i);
  }
}

/**
 * 初始化 Mermaid 渲染器
 *
 * 1. 配置 mermaid 主题
 * 2. 渲染页面中的 mermaid 代码块
 * 3. 绑定全屏 overlay 交互事件
 */
export async function initMermaidRenderer(): Promise<void> {
  initMermaidConfig();
  bindOverlayEvents();
  await renderMermaidBlocks();
}
