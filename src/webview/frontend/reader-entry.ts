/**
 * 阅读器前端入口文件（esbuild 入口）
 *
 * 初始化阅读器、图片查看器和 Mermaid 渲染器，
 * 所有组件就绪后向插件主进程发送 ready 消息。
 */

import { initReader } from "./reader.js";
import { initImageViewer } from "./image-viewer.js";
import { initMermaidRenderer } from "./mermaid.js";
import { onReady, postMessage } from "./messaging.js";

onReady((): void => {
  initReader();
  initImageViewer();
  void initMermaidRenderer();
  postMessage({ type: "ready" });
});
