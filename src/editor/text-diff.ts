/**
 * 计算旧文本到新文本的最小单区间替换。
 *
 * 采用公共前缀/后缀修剪：输入法打字、局部编辑等常见场景只会改动
 * 文档的一小段，用最小区间替换（替代全文替换）可以让 VS Code 的
 * undo 记录与脏区计算都只涉及被改动的部分。
 *
 * 返回 null 表示两段文本相同，无需写回。
 */
export interface MinimalTextEdit {
  /** 旧文本中被替换区间的起始偏移（字符） */
  start: number;
  /** 旧文本中被替换区间的结束偏移（字符，不含） */
  end: number;
  /** 替换后的新内容 */
  insert: string;
}

export function computeMinimalEdit(
  oldText: string,
  newText: string,
): MinimalTextEdit | null {
  if (oldText === newText) {
    return null;
  }

  // 公共前缀
  const minLen = Math.min(oldText.length, newText.length);
  let prefix = 0;
  while (prefix < minLen && oldText[prefix] === newText[prefix]) {
    prefix++;
  }

  // 公共后缀（不与前缀重叠）
  let suffix = 0;
  const maxSuffix = minLen - prefix;
  while (
    suffix < maxSuffix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix++;
  }

  return {
    start: prefix,
    end: oldText.length - suffix,
    insert: newText.slice(prefix, newText.length - suffix),
  };
}
