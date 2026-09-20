import type { EditorInitData, EditorMessageProtocol } from "../../types/index.js";

/**
 * 编辑器 Webview 前端（Spike）。
 *
 * Vditor 以脚本标签方式从本地 vendor 资源加载（不打包进 bundle，
 * 与 vscode-office 的离线方案一致），此处仅声明所需的最小类型面。
 */
interface VditorInstance {
  setValue: (value: string) => void;
  getValue: () => string;
  destroy: () => void;
}

interface VditorInitOptions {
  cdn: string;
  mode: "ir";
  value: string;
  lang: string;
  theme: "classic" | "dark";
  height: string;
  cache: { enable: boolean };
  undoDelay: number;
  toolbar: string[];
  preview: { math: { engine: string } };
  input: (value: string) => void;
  after: () => void;
}

declare const Vditor: new (
  element: HTMLElement,
  options: VditorInitOptions,
) => VditorInstance;

declare global {
  interface Window {
    __HMD_EDITOR_DATA__: EditorInitData;
  }
}

/** 缓存 acquireVsCodeApi（每个 webview 会话只允许调用一次） */
const vscodeApi = acquireVsCodeApi();

function postMessage(message: EditorMessageProtocol.ToExtension): void {
  vscodeApi.postMessage(message);
}

/** 输入防抖：减少连续击键产生的回写频次（provider 侧另有写入合并兜底） */
const EDIT_DEBOUNCE_MS = 200;
let pendingEditValue: string | null = null;
let editTimer: number | undefined;

function flushPendingEdit(): void {
  if (editTimer !== undefined) {
    window.clearTimeout(editTimer);
    editTimer = undefined;
  }
  if (pendingEditValue !== null) {
    postMessage({ type: "edit", data: { text: pendingEditValue } });
    pendingEditValue = null;
  }
}

function main(): void {
  const data = window.__HMD_EDITOR_DATA__;
  const container = document.querySelector("#editor");
  if (!(container instanceof HTMLElement)) {
    return;
  }

  // 外部文档变更注入期间抑制 input 回传（双保险：provider 侧另有回环防护）
  let applyingExternal = false;
  let editor: VditorInstance | null = null;

  editor = new Vditor(container, {
    cdn: data.cdn,
    mode: "ir",
    value: data.text,
    lang: "zh_CN",
    theme: data.dark ? "dark" : "classic",
    height: "100%",
    cache: { enable: false },
    undoDelay: 200,
    toolbar: [],
    preview: { math: { engine: "KaTeX" } },
    input: (value: string): void => {
      if (applyingExternal) {
        return;
      }
      pendingEditValue = value;
      if (editTimer === undefined) {
        editTimer = window.setTimeout((): void => {
          editTimer = undefined;
          flushPendingEdit();
        }, EDIT_DEBOUNCE_MS);
      }
    },
    after: (): void => {
      postMessage({ type: "ready" });
    },
  });

  // 失焦与销毁前冲刷待写内容，避免最后一次编辑丢失
  window.addEventListener("beforeunload", flushPendingEdit);
  window.addEventListener("blur", flushPendingEdit);

  window.addEventListener("message", (event: MessageEvent) => {
    const message = event.data as EditorMessageProtocol.ToWebview | undefined;
    // 消息来自受信的扩展主进程，按类型分发即可
    if (message?.type !== "docChanged") {
      return;
    }
    applyingExternal = true;
    try {
      editor?.setValue(message.data.text);
    } finally {
      applyingExternal = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
