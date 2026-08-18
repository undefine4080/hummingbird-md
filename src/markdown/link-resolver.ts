import * as vscode from "vscode";
import { getDocumentDirectoryUri } from "./resource-resolver.js";

/** 文件链接中的行列范围。行号和列号均采用 Markdown 中常见的 1-based 表示。 */
export interface LinkLocation {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

/** 解析后的 Markdown 链接目标。 */
export interface LinkTarget {
  kind: "anchor" | "external" | "file" | "unsupported";
  uri?: vscode.Uri;
  fragment?: string;
  location?: LinkLocation;
}

/** 将 Markdown 链接解析为内部锚点、外部 URI 或本地文件目标。 */
export function resolveLinkTarget(
  documentUri: vscode.Uri,
  href: string,
): LinkTarget {
  const trimmedHref = href.trim();
  if (trimmedHref.length === 0) {
    return { kind: "unsupported" };
  }

  if (trimmedHref.startsWith("#")) {
    return {
      kind: "anchor",
      fragment: decodeUriComponentSafely(trimmedHref.slice(1)),
    };
  }

  if (trimmedHref.startsWith("//")) {
    return { kind: "external", uri: vscode.Uri.parse(`https:${trimmedHref}`) };
  }

  if (!hasUriScheme(trimmedHref) || isWindowsAbsolutePath(trimmedHref)) {
    const relative = parseRelativeHref(trimmedHref);
    const pathLocation = parsePathLocation(relative.path);
    const location =
      parseLinkLocation(relative.fragment) ?? pathLocation?.location;
    const resourcePath = pathLocation?.path ?? relative.path;
    const uri = isWindowsAbsolutePath(trimmedHref)
      ? vscode.Uri.file(decodeUriComponentSafely(resourcePath))
      : resolveRelativeFileUri(documentUri, resourcePath);
    return {
      kind: "file",
      uri,
      fragment: location
        ? undefined
        : decodeUriComponentSafely(relative.fragment) || undefined,
      location,
    };
  }

  const parsed = vscode.Uri.parse(trimmedHref);
  if (isExternalScheme(parsed.scheme)) {
    return { kind: "external", uri: parsed };
  }

  if (parsed.scheme !== "file" && parsed.scheme !== "vscode") {
    return { kind: "unsupported" };
  }

  const decodedFragment = decodeUriComponentSafely(parsed.fragment);
  const location = parseLinkLocation(decodedFragment);
  const fragment = location ? undefined : decodedFragment || undefined;
  const filePath =
    parsed.scheme === "vscode" && parsed.authority === "file"
      ? parsed.path
      : parsed.fsPath;
  const uri = vscode.Uri.file(filePath);

  return { kind: "file", uri, fragment, location };
}

/** 解析文件链接中的行号和列号标记。 */
export function parseLinkLocation(fragment: string): LinkLocation | undefined {
  const decodedFragment = decodeUriComponentSafely(fragment);
  const lineRange = decodedFragment.match(/^L(\d+)(?:-L?(\d+))?$/i);
  if (lineRange) {
    return {
      startLine: Number(lineRange[1]),
      endLine: lineRange[2] ? Number(lineRange[2]) : undefined,
    };
  }

  const colonLocation = decodedFragment.match(
    /^(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/,
  );
  if (colonLocation) {
    return {
      startLine: Number(colonLocation[1]),
      startColumn: colonLocation[2] ? Number(colonLocation[2]) : undefined,
      endLine: colonLocation[3] ? Number(colonLocation[3]) : undefined,
      endColumn: colonLocation[4] ? Number(colonLocation[4]) : undefined,
    };
  }

  return undefined;
}

/** 从相对文件路径末尾提取 file.ts:12:4 形式的位置标记。 */
function parsePathLocation(
  path: string,
): { path: string; location: LinkLocation } | undefined {
  const match = path.match(/^(.+?):(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/);
  if (!match || (!/[\\/]/.test(match[1]) && !/\.[^/\\:]+$/.test(match[1]))) {
    return undefined;
  }

  return {
    path: match[1],
    location: {
      startLine: Number(match[2]),
      startColumn: match[3] ? Number(match[3]) : undefined,
      endLine: match[4] ? Number(match[4]) : undefined,
      endColumn: match[5] ? Number(match[5]) : undefined,
    },
  };
}

/** 判断是否应当交给系统默认应用打开的 URI scheme。 */
function isExternalScheme(scheme: string): boolean {
  return (
    scheme === "http" ||
    scheme === "https" ||
    scheme === "mailto" ||
    scheme === "ftp"
  );
}

/** 将不带 scheme 的相对路径解析到当前 Markdown 文档所在目录。 */
function resolveRelativeFileUri(
  documentUri: vscode.Uri,
  resourcePath: string,
): vscode.Uri {
  const documentDirectory = getDocumentDirectoryUri(documentUri);
  if (resourcePath.startsWith("/")) {
    return documentUri.with({ path: resourcePath, query: "", fragment: "" });
  }
  return vscode.Uri.joinPath(documentDirectory, resourcePath);
}

/** 判断链接是否显式包含 URI scheme。 */
function hasUriScheme(href: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href);
}

/** 拆分无 scheme 的相对链接。 */
function parseRelativeHref(href: string): {
  path: string;
  query: string;
  fragment: string;
} {
  const hashIndex = href.indexOf("#");
  const fragmentStart = hashIndex >= 0 ? hashIndex : href.length;
  const queryIndex = href.indexOf("?");
  const queryStart =
    queryIndex >= 0 && queryIndex < fragmentStart ? queryIndex : fragmentStart;
  return {
    path: decodeUriComponentSafely(href.slice(0, queryStart)),
    query:
      queryStart < fragmentStart
        ? href.slice(queryStart + 1, fragmentStart)
        : "",
    fragment: hashIndex >= 0 ? href.slice(hashIndex + 1) : "",
  };
}

/** 判断是否为 Windows 盘符或 UNC 形式的绝对路径。 */
function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

/** 解码 URI 片段，遇到非法编码时保留原始文本。 */
function decodeUriComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
