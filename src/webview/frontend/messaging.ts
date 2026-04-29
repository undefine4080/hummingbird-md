import type { MessageProtocol } from "../../types/index.js";

type ToExtension = MessageProtocol.ToExtension;
type ToWebview = MessageProtocol.ToWebview;

/** 缓存 acquireVsCodeApi 返回值（官方要求每个 webview 会话只调用一次） */
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;

/** 获取 VSCode API 实例（延迟初始化，仅调用一次 acquireVsCodeApi） */
function getVsCodeApi(): ReturnType<typeof acquireVsCodeApi> {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

/** 向插件主进程发送消息 */
export function postMessage(message: ToExtension): void {
  getVsCodeApi().postMessage(message);
}

/** 监听来自插件主进程的消息 */
export function onMessage(handler: (message: ToWebview) => void): () => void {
  const listener = (event: MessageEvent): void => {
    const message = event.data as ToWebview;
    if (message && typeof message === "object" && "type" in message) {
      handler(message);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/** 等待 DOM 就绪后执行回调 */
export function onReady(callback: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
  } else {
    callback();
  }
}
