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

  if (hasUriScheme(trimmedSource) && !isWindowsAbsolutePath(trimmedSource)) {
    const parsed = vscode.Uri.parse(trimmedSource);
    return parsed.scheme === "file" ? parsed : null;
  }

  const relative = splitResourceSource(trimmedSource);
  const resourcePath = decodeUriComponentSafely(relative.path);
  if (isWindowsAbsolutePath(resourcePath)) {
    return vscode.Uri.file(resourcePath);
  }

  const documentDirectory = getDocumentDirectoryUri(documentUri);
  const resourceUri = resourcePath.startsWith("/")
    ? documentUri.with({ path: resourcePath })
    : vscode.Uri.joinPath(documentDirectory, resourcePath);

  return resourceUri.with({
    query: relative.query,
    fragment: relative.fragment,
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
  const directoryPath =
    lastSlash >= 0 ? documentUri.path.slice(0, lastSlash) || "/" : "/";
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

/** 判断是否为显式 URI scheme。 */
function hasUriScheme(source: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(source);
}

/** 判断是否为 Windows 盘符或 UNC 形式的绝对路径。 */
function isWindowsAbsolutePath(source: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(source) || source.startsWith("\\\\");
}

/** 拆分本地资源路径中的 query 和 fragment。 */
function splitResourceSource(source: string): {
  path: string;
  query: string;
  fragment: string;
} {
  const hashIndex = source.indexOf("#");
  const fragmentStart = hashIndex >= 0 ? hashIndex : source.length;
  const queryIndex = source.indexOf("?");
  const queryStart =
    queryIndex >= 0 && queryIndex < fragmentStart ? queryIndex : fragmentStart;
  return {
    path: source.slice(0, queryStart),
    query:
      queryStart < fragmentStart
        ? source.slice(queryStart + 1, fragmentStart)
        : "",
    fragment: hashIndex >= 0 ? source.slice(hashIndex + 1) : "",
  };
}

/** 解码 URI 组件，遇到非法编码时保留原始文本。 */
function decodeUriComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
