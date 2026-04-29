/** VSCode Webview 环境中的全局 API 类型声明 */
declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};
