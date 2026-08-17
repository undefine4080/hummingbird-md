/**
 * 阅读器前端入口文件（esbuild 入口）
 */

import { initReader } from "./reader.js";
import { initImageViewer } from "./image-viewer.js";
import {
  initMermaidRenderer,
  updateMermaidTheme,
  updateMermaidThemePreset,
} from "./mermaid.js";
import { onReady, postMessage, onMessage } from "./messaging.js";
import type { Theme } from "../../types/index.js";

onReady((): void => {
  initReader();
  initImageViewer();
  void initMermaidRenderer();
  postMessage({ type: "ready" });

  // 监听主题变更：切换 data-theme 并重新渲染 mermaid
  onMessage((message): void => {
    switch (message.type) {
      case "updateTheme": {
        const theme: Theme = message.data.theme;
        document.documentElement.setAttribute("data-theme", theme);
        void updateMermaidTheme(theme);
        break;
      }
      case "updateThemeName":
        document.documentElement.dataset.themeName = message.data.themeName;
        void updateMermaidTheme(
          document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        );
        break;
      case "updateMermaidTheme":
        void updateMermaidThemePreset(message.data.preset);
        break;
      case "init":
      case "highlightHeading":
      case "updateStyle":
      case "requestScrollPosition":
      case "restoreScrollPosition":
        break;
    }
  });
});
