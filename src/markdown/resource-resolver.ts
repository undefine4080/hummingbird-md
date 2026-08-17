import * as vscode from "vscode";

/** 将 Markdown 资源地址解析为当前文档对应的本地 URI。 */
export function resolveDocumentResource(
  documentUri: vscode.Uri,
  source: string,
): vscode.Uri | null {
  const trimmedSource = source.trim();
  if (trimmedSource.length === 0 || isRemoteResource(trimmedSource)) {
    return null;
  }

  const parsed = vscode.Uri.parse(trimmedSource);
  if (parsed.scheme && parsed.scheme !== "file") {
    return null;
  }

  if (parsed.scheme === "file") {
    return parsed;
  }

  const documentDirectory = getDocumentDirectoryUri(documentUri);
  const resourceUri = parsed.path.startsWith("/")
    ? documentUri.with({ path: parsed.path })
    : vscode.Uri.joinPath(documentDirectory, parsed.path);

  return resourceUri.with({
    query: parsed.query,
    fragment: parsed.fragment,
  });
}

/** 创建 Webview 图片地址解析器。 */
export function createImageUrlResolver(
  documentUri: vscode.Uri,
  webview: vscode.Webview,
): (source: string) => string {
  return (source: string): string => {
    const resourceUri = resolveDocumentResource(documentUri, source);
    if (!resourceUri) {
      return source;
    }
    return webview.asWebviewUri(resourceUri).toString();
  };
}

/** 获取文档所在目录，同时保留远程工作区的 URI scheme 和 authority。 */
export function getDocumentDirectoryUri(documentUri: vscode.Uri): vscode.Uri {
  const lastSlash = documentUri.path.lastIndexOf("/");
  const directoryPath = lastSlash >= 0 ? documentUri.path.slice(0, lastSlash) || "/" : "/";
  return documentUri.with({ path: directoryPath, query: "", fragment: "" });
}

/** 获取 Webview 允许访问的本地资源根目录。 */
export function getDocumentResourceRoots(
  documentUri: vscode.Uri,
  extensionUri: vscode.Uri,
): vscode.Uri[] {
  const roots = [extensionUri, getDocumentDirectoryUri(documentUri)];
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (workspaceFolder) {
    roots.push(workspaceFolder.uri);
  }
  return roots;
}

/** 判断是否应当交给浏览器直接加载的资源地址。 */
function isRemoteResource(source: string): boolean {
  return /^(?:https?:|data:|blob:|\/\/|#)/i.test(source);
}
