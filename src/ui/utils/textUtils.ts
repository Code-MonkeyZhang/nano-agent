/**
 * Unicode 文本工具函数
 *
 * 这些函数在 code point 级别操作字符串，而不是 UTF-16 code unit 级别。
 * 这对于正确处理 Unicode 字符非常重要，例如：
 * - 中文字符（每个字符是 1 个 code point）
 * - Emoji（可能由多个 code point 组成，如 👨‍👩‍👧‍👦）
 * - 带音标的字符（基础字符 + 组合音标）
 *
 * 注意：JavaScript 的 String.length 返回的是 UTF-16 code unit 数量，
 * 而不是 code point 数量。例如 "😀".length === 2。
 */

/**
 * 检查字符串是否只包含 ASCII 字符
 */
export function isAscii(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      return false;
    }
  }
  return true;
}

/**
 * 将字符串转换为 code point 数组
 *
 * @example
 * toCodePoints('abc')  // ['a', 'b', 'c']
 * toCodePoints('中文') // ['中', '文']
 * toCodePoints('😀')   // ['😀']
 */
export function toCodePoints(str: string): string[] {
  // ASCII 快速路径
  if (isAscii(str)) {
    return str.split('');
  }
  // Array.from 会正确处理 surrogate pairs
  return Array.from(str);
}

/**
 * 获取字符串的 code point 长度
 *
 * @example
 * cpLen('abc')  // 3
 * cpLen('中文') // 2
 * cpLen('😀')   // 1 (而不是 "😀".length === 2)
 */
export function cpLen(str: string): number {
  if (isAscii(str)) {
    return str.length;
  }
  return toCodePoints(str).length;
}

/**
 * 按 code point 索引切片字符串
 *
 * @param str - 要切的字符串
 * @param start - 从第几个字符开始（从 0 数，包含这个）
 * @param end - 到第几个字符结束（不包含这个）
 *
 * @example
 *   索引:    0   1   2   3   4
 *   字符:    h   e   l   l   o
 *
 * cpSlice("hello", 0, 2)  结果是 "he"  （取索引 0,1，不包含 2）
 * cpSlice("hello", 2, 3)  结果是 "l"   （取索引 2）
 * cpSlice("hello", 3)     结果是 "lo"  （从索引 3 切到最后）
 */
export function cpSlice(str: string, start: number, end?: number): string {
  if (isAscii(str)) {
    return str.slice(start, end);
  }
  const codePoints = toCodePoints(str);
  return codePoints.slice(start, end).join('');
}
