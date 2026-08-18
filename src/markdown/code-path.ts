/**
 * 代码 span 中的裸文件路径识别与链接地址构建。
 *
 * 本模块保持纯函数、无 vscode 依赖，便于独立测试；
 * 文件存在性校验和基准目录选择由调用方（ReaderPanel）完成。
 */

/** 代码文件引用中的行列位置，行号和列号均为 1-based。 */
export interface CodePathLocation {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

/** 从代码 span 中提取的文件路径候选。 */
export interface CodePathCandidate {
  /** 文件路径（已剥离行号后缀），保留原始的 ./ 和 ../ 前缀。 */
  path: string;
  /** 行列位置（存在 :12、:12:4 等后缀时）。 */
  location?: CodePathLocation;
}

/** 路径末尾的行列后缀，如 src/main.ts:12:4-20:8。 */
const PATH_LOCATION_PATTERN = /^(.+?):(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/;

/** 候选路径允许的字符白名单：字母、数字、_ . / ~ : 和 -。 */
const CODE_PATH_CHARACTERS = /^[A-Za-z0-9_./~:-]+$/;

/** 路径必须以字母开头的扩展名结尾，排除 v1.2.3、纯目录名等。 */
const EXTENSION_PATTERN = /\.[A-Za-z][A-Za-z0-9]*$/;

/** 候选内容最大长度，超过视为普通文本。 */
const MAX_CANDIDATE_LENGTH = 512;

/**
 * 判断代码 span 内容是否为文件路径候选。
 *
 * 注意：scheme 检查同时排除了 https:、mailto: 和 Windows 盘符（C:）；
 * 字符白名单排除了反斜杠，因此 Windows 反斜杠路径天然不参与。
 */
export function extractCodePathCandidate(
  content: string,
): CodePathCandidate | undefined {
  const text = content.trim();
  if (text.length === 0 || text.length > MAX_CANDIDATE_LENGTH) {
    return undefined;
  }
  if (!CODE_PATH_CHARACTERS.test(text)) {
    return undefined;
  }
  if (hasUriScheme(text) || text.startsWith("//")) {
    return undefined;
  }

  const split = splitPathLocation(text);
  const path = split?.path ?? text;
  if (!EXTENSION_PATTERN.test(path)) {
    return undefined;
  }
  return { path, location: split?.location };
}

/** 提取路径末尾的行列后缀；不匹配时返回 undefined。 */
export function splitPathLocation(
  value: string,
): { path: string; location: CodePathLocation } | undefined {
  const match = value.match(PATH_LOCATION_PATTERN);
  if (!match) {
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

/**
 * 生成相对文档目录的链接地址。
 *
 * 传入的两个路径均为 URI path 形式（/ 分隔、段已百分号编码），
 * 因此计算出的相对路径可直接用作 href，无需二次编码。
 */
export function buildRelativeHref(
  documentDirectoryPath: string,
  targetPath: string,
  location?: CodePathLocation,
): string {
  const relative = computeRelativePath(documentDirectoryPath, targetPath);
  const fragment = formatLocationFragment(location);
  return fragment ? `${relative}#${fragment}` : relative;
}

/** 计算从 fromDirectoryPath 到 targetPath 的相对路径（段已编码）。 */
function computeRelativePath(
  fromDirectoryPath: string,
  targetPath: string,
): string {
  const fromParts = splitPathSegments(fromDirectoryPath);
  const toParts = splitPathSegments(targetPath);

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }

  const parts: string[] = [];
  for (let i = common; i < fromParts.length; i++) {
    parts.push("..");
  }
  const downSegments = toParts.slice(common);
  if (downSegments.length === 0) {
    return parts.length > 0 ? parts.join("/") : ".";
  }
  parts.push(...downSegments);
  return parts.join("/");
}

/** 将 URI path 拆分为目录段（"/a/b" → ["a","b"]，"/" → []）。 */
function splitPathSegments(path: string): string[] {
  if (path === "/" || path === "") {
    return [];
  }
  return path.replace(/^\//, "").split("/");
}

/** 将行列位置格式化为链接 fragment：#L12、#L12-L20 或 #12:4-20:8。 */
function formatLocationFragment(
  location: CodePathLocation | undefined,
): string {
  if (!location?.startLine) {
    return "";
  }

  const hasColumns =
    location.startColumn !== undefined || location.endColumn !== undefined;
  if (hasColumns) {
    // 带列号时使用纯数字冒号形式，与 link-resolver 的解析规则对应。
    const start = `${location.startLine}${
      location.startColumn !== undefined ? `:${location.startColumn}` : ""
    }`;
    if (location.endLine === undefined) {
      return start;
    }
    const end = `${location.endLine}${
      location.endColumn !== undefined ? `:${location.endColumn}` : ""
    }`;
    return `${start}-${end}`;
  }

  if (location.endLine !== undefined) {
    return `L${location.startLine}-L${location.endLine}`;
  }
  return `L${location.startLine}`;
}

/** 判断文本是否以 URI scheme 开头（同时覆盖 Windows 盘符）。 */
function hasUriScheme(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
}
