/**
 * 图片查看器组件
 *
 * 提供缩放、平移、旋转、翻页等专业图片浏览功能。
 * HTML 结构由 html-generator.ts 中的 #image-viewer-overlay 提供。
 */

/** 查看器内部状态 */
interface ViewerState {
  /** 当前图片集合 */
  images: HTMLImageElement[];
  /** 当前显示的图片索引 */
  currentIndex: number;
  /** 缩放比例 */
  scale: number;
  /** 平移 X 偏移 */
  translateX: number;
  /** 平移 Y 偏移 */
  translateY: number;
  /** 旋转角度 */
  rotation: number;
  /** 是否处于拖拽中 */
  isDragging: boolean;
  /** 拖拽起始鼠标位置 */
  dragStartX: number;
  /** 拖拽起始鼠标位置 */
  dragStartY: number;
  /** 拖拽起始时的平移偏移 */
  dragStartTranslateX: number;
  /** 拖拽起始时的平移偏移 */
  dragStartTranslateY: number;
  /** 是否正在缩放动画中（pinch） */
  isPinching: boolean;
  /** pinch 起始距离 */
  pinchStartDistance: number;
  /** pinch 起始缩放 */
  pinchStartScale: number;
}

/** 最小缩放比例 */
const MIN_SCALE = 0.1;
/** 最大缩放比例 */
const MAX_SCALE = 20;
/** 每次按钮缩放的步进倍率 */
const ZOOM_STEP = 1.25;

/** 获取 DOM 元素，不存在时返回 null */
function querySelector<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

/** 创建并返回初始查看器状态 */
function createState(): ViewerState {
  return {
    images: [],
    currentIndex: 0,
    scale: 1,
    translateX: 0,
    translateY: 0,
    rotation: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartTranslateX: 0,
    dragStartTranslateY: 0,
    isPinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
  };
}

/**
 * 初始化图片查看器
 *
 * 收集页面中所有图片，绑定工具栏按钮、键盘快捷键、
 * 滚轮缩放、鼠标拖拽、触摸手势等交互。
 */
export function initImageViewer(): void {
  const overlay = querySelector<HTMLElement>("#image-viewer-overlay");
  const canvas = querySelector<HTMLElement>("#image-viewer-canvas");
  const img = querySelector<HTMLImageElement>("#iv-image");
  const counter = querySelector<HTMLElement>("#iv-counter");

  if (!overlay || !canvas || !img || !counter) {
    return;
  }

  const state = createState();
  bindToolbarButtons(state, overlay, img, counter);
  bindImageClicks(state, overlay, img, counter);
  bindCanvasInteraction(state, canvas, img);
  bindKeyboard(state, overlay, img, counter);
  bindTouchGesture(state, canvas, img);
}

/** 收集阅读器内容区域中的所有图片元素 */
function collectImages(): HTMLImageElement[] {
  const container = querySelector<HTMLElement>("#reader-content");
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLImageElement>("img"));
}

/** 绑定工具栏按钮事件 */
function bindToolbarButtons(
  state: ViewerState,
  overlay: HTMLElement,
  img: HTMLImageElement,
  counter: HTMLElement,
): void {
  const zoomIn = querySelector<HTMLButtonElement>("#iv-zoom-in");
  const zoomOut = querySelector<HTMLButtonElement>("#iv-zoom-out");
  const zoomFit = querySelector<HTMLButtonElement>("#iv-zoom-fit");
  const zoomOriginal = querySelector<HTMLButtonElement>("#iv-zoom-original");
  const rotateLeft = querySelector<HTMLButtonElement>("#iv-rotate-left");
  const rotateRight = querySelector<HTMLButtonElement>("#iv-rotate-right");
  const prev = querySelector<HTMLButtonElement>("#iv-prev");
  const next = querySelector<HTMLButtonElement>("#iv-next");
  const close = querySelector<HTMLButtonElement>("#iv-close");

  if (zoomIn) {
    zoomIn.addEventListener("click", (e): void => {
      e.stopPropagation();
      zoomBy(state, img, ZOOM_STEP);
    });
  }

  if (zoomOut) {
    zoomOut.addEventListener("click", (e): void => {
      e.stopPropagation();
      zoomBy(state, img, 1 / ZOOM_STEP);
    });
  }

  if (zoomFit) {
    zoomFit.addEventListener("click", (e): void => {
      e.stopPropagation();
      fitToViewport(state, img);
    });
  }

  if (zoomOriginal) {
    zoomOriginal.addEventListener("click", (e): void => {
      e.stopPropagation();
      resetToOriginal(state, img);
    });
  }

  if (rotateLeft) {
    rotateLeft.addEventListener("click", (e): void => {
      e.stopPropagation();
      state.rotation -= 90;
      applyTransform(state, img);
    });
  }

  if (rotateRight) {
    rotateRight.addEventListener("click", (e): void => {
      e.stopPropagation();
      state.rotation += 90;
      applyTransform(state, img);
    });
  }

  if (prev) {
    prev.addEventListener("click", (e): void => {
      e.stopPropagation();
      navigateImage(state, overlay, img, counter, -1);
    });
  }

  if (next) {
    next.addEventListener("click", (e): void => {
      e.stopPropagation();
      navigateImage(state, overlay, img, counter, 1);
    });
  }

  if (close) {
    close.addEventListener("click", (e): void => {
      e.stopPropagation();
      hideViewer(overlay);
    });
  }

  // 点击 overlay 背景区域（非图片）关闭查看器
  overlay.addEventListener("click", (e): void => {
    if (e.target === overlay || e.target === overlay.querySelector(".image-viewer-canvas")) {
      hideViewer(overlay);
    }
  });
}

/** 绑定内容区域图片的点击打开事件 */
function bindImageClicks(
  state: ViewerState,
  overlay: HTMLElement,
  img: HTMLImageElement,
  counter: HTMLElement,
): void {
  const container = querySelector<HTMLElement>("#reader-content");
  if (!container) {
    return;
  }

  container.addEventListener("click", (e): void => {
    const target = e.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    // 收集当前页面所有图片（每次点击时动态收集，支持动态内容）
    const allImages = collectImages();
    const clickedIndex = allImages.indexOf(target);
    if (clickedIndex === -1) {
      return;
    }

    state.images = allImages;
    state.currentIndex = clickedIndex;
    openViewer(state, overlay, img, counter);
  });
}

/** 绑定画布区域的鼠标拖拽和滚轮缩放 */
function bindCanvasInteraction(
  state: ViewerState,
  canvas: HTMLElement,
  img: HTMLImageElement,
): void {
  // 鼠标按下：开始拖拽
  canvas.addEventListener("mousedown", (e): void => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    state.isDragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragStartTranslateX = state.translateX;
    state.dragStartTranslateY = state.translateY;
  });

  // 鼠标移动：拖拽平移
  window.addEventListener("mousemove", (e): void => {
    if (!state.isDragging) {
      return;
    }
    e.preventDefault();
    state.translateX = state.dragStartTranslateX + (e.clientX - state.dragStartX);
    state.translateY = state.dragStartTranslateY + (e.clientY - state.dragStartY);
    applyTransform(state, img);
  });

  // 鼠标松开：停止拖拽
  window.addEventListener("mouseup", (): void => {
    state.isDragging = false;
  });

  // 滚轮缩放（以鼠标位置为中心）
  canvas.addEventListener("wheel", (e): void => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    // 鼠标相对于画布中心的位置
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // 缩放因子：向上放大，向下缩小
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newScale = clampScale(state.scale * factor);

    // 以鼠标位置为中心缩放：调整平移偏移使鼠标指向的图片点保持不变
    const scaleRatio = newScale / state.scale;
    state.translateX = mouseX - scaleRatio * (mouseX - state.translateX);
    state.translateY = mouseY - scaleRatio * (mouseY - state.translateY);
    state.scale = newScale;

    applyTransform(state, img);
  }, { passive: false });
}

/** 绑定触摸手势（pinch 缩放） */
function bindTouchGesture(
  state: ViewerState,
  canvas: HTMLElement,
  img: HTMLImageElement,
): void {
  canvas.addEventListener("touchstart", (e): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      state.isPinching = true;
      state.pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
      state.pinchStartScale = state.scale;
    } else if (e.touches.length === 1) {
      // 单指拖拽
      state.isDragging = true;
      state.dragStartX = e.touches[0].clientX;
      state.dragStartY = e.touches[0].clientY;
      state.dragStartTranslateX = state.translateX;
      state.dragStartTranslateY = state.translateY;
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e): void => {
    if (state.isPinching && e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const ratio = currentDistance / state.pinchStartDistance;
      state.scale = clampScale(state.pinchStartScale * ratio);
      applyTransform(state, img);
    } else if (state.isDragging && e.touches.length === 1) {
      e.preventDefault();
      state.translateX = state.dragStartTranslateX + (e.touches[0].clientX - state.dragStartX);
      state.translateY = state.dragStartTranslateY + (e.touches[0].clientY - state.dragStartY);
      applyTransform(state, img);
    }
  }, { passive: false });

  const endTouch = (): void => {
    state.isPinching = false;
    state.isDragging = false;
  };

  canvas.addEventListener("touchend", endTouch);
  canvas.addEventListener("touchcancel", endTouch);
}

/** 绑定键盘快捷键 */
function bindKeyboard(
  state: ViewerState,
  overlay: HTMLElement,
  img: HTMLImageElement,
  counter: HTMLElement,
): void {
  document.addEventListener("keydown", (e): void => {
    // 查看器未打开时不响应
    if (!overlay.classList.contains("active")) {
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        hideViewer(overlay);
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateImage(state, overlay, img, counter, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateImage(state, overlay, img, counter, 1);
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomBy(state, img, ZOOM_STEP);
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomBy(state, img, 1 / ZOOM_STEP);
        break;
      default:
        break;
    }
  });
}

/** 打开查看器并显示当前索引的图片 */
function openViewer(
  state: ViewerState,
  overlay: HTMLElement,
  img: HTMLImageElement,
  counter: HTMLElement,
): void {
  const current = state.images[state.currentIndex];
  if (!current) {
    return;
  }

  img.src = current.src;
  img.alt = current.alt || "";

  // 重置变换状态
  state.scale = 1;
  state.translateX = 0;
  state.translateY = 0;
  state.rotation = 0;

  overlay.classList.add("active");

  // 图片加载后自适应
  img.onload = (): void => {
    fitToViewport(state, img);
  };

  updateCounter(state, counter);
}

/** 关闭查看器 */
function hideViewer(overlay: HTMLElement): void {
  overlay.classList.remove("active");
}

/** 翻页：direction 为 -1（上一张）或 1（下一张） */
function navigateImage(
  state: ViewerState,
  overlay: HTMLElement,
  img: HTMLImageElement,
  counter: HTMLElement,
  direction: number,
): void {
  if (state.images.length === 0) {
    return;
  }

  state.currentIndex += direction;
  // 循环翻页
  if (state.currentIndex < 0) {
    state.currentIndex = state.images.length - 1;
  } else if (state.currentIndex >= state.images.length) {
    state.currentIndex = 0;
  }

  const current = state.images[state.currentIndex];
  img.src = current.src;
  img.alt = current.alt || "";

  // 重置变换
  state.scale = 1;
  state.translateX = 0;
  state.translateY = 0;
  state.rotation = 0;

  img.onload = (): void => {
    fitToViewport(state, img);
  };

  updateCounter(state, counter);
}

/** 更新计数器显示 */
function updateCounter(state: ViewerState, counter: HTMLElement): void {
  counter.textContent = `${state.currentIndex + 1} / ${state.images.length}`;
}

/** 按给定倍率缩放 */
function zoomBy(state: ViewerState, img: HTMLImageElement, factor: number): void {
  state.scale = clampScale(state.scale * factor);
  applyTransform(state, img);
}

/** 适应视口：图片完整显示在画布内 */
function fitToViewport(state: ViewerState, img: HTMLImageElement): void {
  const canvas = querySelector<HTMLElement>("#image-viewer-canvas");
  if (!canvas) {
    return;
  }

  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  if (naturalWidth === 0 || naturalHeight === 0) {
    return;
  }

  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  // 留 5% 内边距
  const padding = 0.95;
  const scaleX = (canvasWidth * padding) / naturalWidth;
  const scaleY = (canvasHeight * padding) / naturalHeight;
  state.scale = Math.min(scaleX, scaleY, 1);
  state.translateX = 0;
  state.translateY = 0;
  // 适应视口时不改变旋转角度
  applyTransform(state, img);
}

/** 恢复 1:1 原始尺寸 */
function resetToOriginal(state: ViewerState, img: HTMLImageElement): void {
  state.scale = 1;
  state.translateX = 0;
  state.translateY = 0;
  applyTransform(state, img);
}

/** 将 CSS transform 应用到图片元素 */
function applyTransform(state: ViewerState, img: HTMLImageElement): void {
  img.style.transform =
    `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale}) rotate(${state.rotation}deg)`;
}

/** 将缩放值限制在允许范围内 */
function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** 计算两个触摸点之间的距离 */
function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
