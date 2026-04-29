import { onReady, postMessage } from "./messaging.js";
import { initToc } from "./toc.js";

onReady(() => {
  initToc();
  postMessage({ type: "ready" });
});
