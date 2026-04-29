/**
 * 阅读器前端入口文件（esbuild 入口）
 */

import { initReader } from "./reader.js";
import { initImageViewer } from "./image-viewer.js";
import { initMermaidRenderer, rerenderAllDiagrams } from "./mermaid.js";
import { onReady, postMessage, onMessage } from "./messaging.js";
import type { Theme } from "../../types/index.js";

onReady((): void => {
  initReader();
  initImageViewer();
  void initMermaidRenderer();
  postMessage({ type: "ready" });

  // 监听主题变更：切换 data-theme 并重新渲染 mermaid
  onMessage((message): void => {
    if (message.type === "updateTheme") {
      const theme: Theme = message.data.theme;
      document.documentElement.setAttribute("data-theme", theme);
      void rerenderAllDiagrams(theme === "dark" ? "dark" : "default");
    }
  });
});
