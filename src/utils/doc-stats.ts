import type { DocumentStats } from "../types/index.js";

/** 计算文档统计信息 */
export function computeDocStats(
  source: string,
  fileSize: number,
  createdTime: number,
  modifiedTime: number,
  filePath: string,
): DocumentStats {
  const chineseChars = (source.match(/[一-鿿]/g) ?? []).length;
  const englishWords = (source.match(/[a-zA-Z]+/g) ?? []).length;

  return {
    wordCount: chineseChars + englishWords,
    charCount: source.length,
    paragraphCount: source.split(/\n\s*\n/).filter((p): boolean => p.trim().length > 0).length,
    fileSize: formatFileSize(fileSize),
    filePath,
    createdDate: formatDate(createdTime),
    modifiedDate: formatDate(modifiedTime),
  };
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 格式化时间戳为日期字符串 */
function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
