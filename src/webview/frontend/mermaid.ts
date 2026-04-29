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

/** 最小/最大缩放比例 */
const MIN_SCALE = 0.1;
const MAX_SCALE = 20;
/** 每次按钮缩放的步进倍率 */
const ZOOM_STEP = 1.25;

/** 全屏查看器状态 */
interface ViewerState {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartTranslateX: number;
  dragStartTranslateY: number;
  isPinching: boolean;
  pinchStartDistance: number;
  pinchStartScale: number;
}

/** 当前全屏展示的图表索引（-1 表示未展示） */
let currentDiagramIndex = -1;

/** 缓存所有渲染成功的 SVG 内容 */
const diagramSvgs: string[] = [];

/** 缓存所有图表的原始 mermaid 源码，用于主题切换时重新渲染 */
const diagramSources: string[] = [];
/** 全屏查看器状态实例 */
const vs: ViewerState = {
  scale: 1, translateX: 0, translateY: 0, rotation: 0,
  isDragging: false, dragStartX: 0, dragStartY: 0,
  dragStartTranslateX: 0, dragStartTranslateY: 0,
  isPinching: false, pinchStartDistance: 0, pinchStartScale: 1,
};
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

  content.innerHTML = diagramSvgs[diagramIndex] ?? "";
  overlay.classList.add("active");

  // 重置变换状态
  vs.scale = 1;
  vs.translateX = 0;
  vs.translateY = 0;
  vs.rotation = 0;

  // 等 DOM 渲染后自适应
  requestAnimationFrame((): void => {
    fitToViewport();
  });
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

/** 获取全屏内容区域的 SVG 元素 */
function getFullscreenSvg(): SVGSVGElement | null {
  const content = document.getElementById("mermaid-fullscreen-content");
  return content?.querySelector("svg") ?? null;
}

/** 将 CSS transform 应用到全屏 SVG 元素 */
function applyTransform(): void {
  const svg = getFullscreenSvg();
  if (!svg) {
    return;
  }
  svg.style.transform =
    `translate(${vs.translateX}px, ${vs.translateY}px) scale(${vs.scale}) rotate(${vs.rotation}deg)`;
}

/** 将缩放值限制在允许范围内 */
function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** 按给定倍率缩放 */
function zoomBy(factor: number): void {
  vs.scale = clampScale(vs.scale * factor);
  applyTransform();
}

/** 适应视口：SVG 完整显示在画布内 */
function fitToViewport(): void {
  const svg = getFullscreenSvg();
  const content = document.getElementById("mermaid-fullscreen-content");
  if (!svg || !content) {
    return;
  }

  const vb = svg.viewBox?.baseVal;
  const svgW = vb?.width ?? svg.clientWidth ?? 800;
  const svgH = vb?.height ?? svg.clientHeight ?? 600;
  if (svgW === 0 || svgH === 0) {
    return;
  }

  const cw = content.clientWidth;
  const ch = content.clientHeight;
  const padding = 0.9;
  const scaleX = (cw * padding) / svgW;
  const scaleY = (ch * padding) / svgH;
  vs.scale = Math.min(scaleX, scaleY, 1);
  vs.translateX = 0;
  vs.translateY = 0;
  applyTransform();
}

/** 恢复 1:1 原始尺寸 */
function resetToOriginal(): void {
  vs.scale = 1;
  vs.translateX = 0;
  vs.translateY = 0;
  applyTransform();
}

/** 计算两个触摸点之间的距离 */
function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 绑定全屏 overlay 的所有交互事件
 */
function bindOverlayEvents(): void {
  const content = document.getElementById("mermaid-fullscreen-content");

  // --- 工具栏按钮 ---
  document.getElementById("mf-zoom-in")?.addEventListener("click", (e): void => {
    e.stopPropagation();
    zoomBy(ZOOM_STEP);
  });
  document.getElementById("mf-zoom-out")?.addEventListener("click", (e): void => {
    e.stopPropagation();
    zoomBy(1 / ZOOM_STEP);
  });
  document.getElementById("mf-zoom-fit")?.addEventListener("click", (e): void => {
    e.stopPropagation();
    fitToViewport();
  });
  document.getElementById("mf-zoom-original")?.addEventListener("click", (e): void => {
    e.stopPropagation();
    resetToOriginal();
  });
  document.getElementById("mf-rotate-left")?.addEventListener("click", (e): void => {
    e.stopPropagation();
    vs.rotation -= 90;
    applyTransform();
  });
  document.getElementById("mf-rotate-right")?.addEventListener("click", (e): void => {
    e.stopPropagation();
    vs.rotation += 90;
    applyTransform();
  });
  document.getElementById("mf-close")?.addEventListener("click", (): void => {
    closeFullscreen();
  });
  document.getElementById("mf-download")?.addEventListener("click", (): void => {
    if (currentDiagramIndex >= 0 && diagramSvgs[currentDiagramIndex]) {
      downloadSvgAsJpg(diagramSvgs[currentDiagramIndex], currentDiagramIndex);
    }
  });

  if (!content) {
    return;
  }

  // --- 鼠标拖拽平移 ---
  content.addEventListener("mousedown", (e): void => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    vs.isDragging = true;
    vs.dragStartX = e.clientX;
    vs.dragStartY = e.clientY;
    vs.dragStartTranslateX = vs.translateX;
    vs.dragStartTranslateY = vs.translateY;
  });
  window.addEventListener("mousemove", (e): void => {
    if (!vs.isDragging) {
      return;
    }
    e.preventDefault();
    vs.translateX = vs.dragStartTranslateX + (e.clientX - vs.dragStartX);
    vs.translateY = vs.dragStartTranslateY + (e.clientY - vs.dragStartY);
    applyTransform();
  });
  window.addEventListener("mouseup", (): void => {
    vs.isDragging = false;
  });

  // --- 滚轮缩放（以鼠标位置为中心） ---
  content.addEventListener("wheel", (e): void => {
    e.preventDefault();
    const rect = content.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newScale = clampScale(vs.scale * factor);
    const ratio = newScale / vs.scale;
    vs.translateX = mouseX - ratio * (mouseX - vs.translateX);
    vs.translateY = mouseY - ratio * (mouseY - vs.translateY);
    vs.scale = newScale;
    applyTransform();
  }, { passive: false });

  // --- 触摸手势 ---
  content.addEventListener("touchstart", (e): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      vs.isPinching = true;
      vs.pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
      vs.pinchStartScale = vs.scale;
    } else if (e.touches.length === 1) {
      vs.isDragging = true;
      vs.dragStartX = e.touches[0].clientX;
      vs.dragStartY = e.touches[0].clientY;
      vs.dragStartTranslateX = vs.translateX;
      vs.dragStartTranslateY = vs.translateY;
    }
  }, { passive: false });
  content.addEventListener("touchmove", (e): void => {
    if (vs.isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      vs.scale = clampScale(vs.pinchStartScale * (dist / vs.pinchStartDistance));
      applyTransform();
    } else if (vs.isDragging && e.touches.length === 1) {
      e.preventDefault();
      vs.translateX = vs.dragStartTranslateX + (e.touches[0].clientX - vs.dragStartX);
      vs.translateY = vs.dragStartTranslateY + (e.touches[0].clientY - vs.dragStartY);
      applyTransform();
    }
  }, { passive: false });
  const endTouch = (): void => {
    vs.isPinching = false;
    vs.isDragging = false;
  };
  content.addEventListener("touchend", endTouch);
  content.addEventListener("touchcancel", endTouch);

  // --- 键盘快捷键 ---
  document.addEventListener("keydown", (e: KeyboardEvent): void => {
    if (currentDiagramIndex < 0) {
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeFullscreen();
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomBy(ZOOM_STEP);
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
        break;
      default:
        break;
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
  diagramSources[index] = source;

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

/**
 * 切换主题后重新渲染所有 mermaid 图表
 */
export async function rerenderAllDiagrams(theme: "dark" | "default"): Promise<void> {
  if (diagramSources.length === 0) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: "loose",
  });

  for (let i = 0; i < diagramSources.length; i++) {
    const source = diagramSources[i];
    if (!source) {
      continue;
    }

    const containerId = `mermaid-diagram-${i}`;
    const container = document.getElementById(containerId);
    if (!container) {
      continue;
    }

    try {
      const result = await mermaid.render(`mermaid-rerender-${Date.now()}-${i}`, source);
      diagramSvgs[i] = result.svg;
      container.innerHTML = result.svg;

      if (result.bindFunctions) {
        result.bindFunctions(container);
      }
    } catch {
      // 重新渲染失败时保持原状
    }
  }
}
