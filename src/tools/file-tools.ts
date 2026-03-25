/**
 * @fileoverview 用于读取、写入和编辑文件的文件系统工具。
 *
 * 提供三个文件操作工具：
 * - ReadTool: 读取文件内容，支持可选的offset/limit
 * - WriteTool: 创建或覆盖文件
 * - EditTool: 在文件中执行精确的字符串替换
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Tool, ToolResult } from './base.js';

type ReadFileInput = {
  path: string;
  offset?: number;
  limit?: number;
};

type WriteFileInput = {
  path: string;
  content: string;
};

type EditFileInput = {
  path: string;
  old_str: string;
  new_str: string;
};

/**
 * 相对于工作区目录解析文件路径。
 *
 * @param workspaceDir - 相对路径的基础目录
 * @param targetPath - 要解析的路径（绝对或相对）
 * @returns 绝对路径
 */
function resolvePath(workspaceDir: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(workspaceDir, targetPath);
}

/**
 * 基于token估算，使用头部/尾部策略截断长内容。
 * 保留大约一半的内容从头和尾开始。
 *
 * @param text - 可能需要截断的文本内容
 * @param maxTokens - 允许的最大估算token数
 * @returns 如果在限制内则返回原文本，否则返回带说明的截断文本
 */
function truncateTextByTokens(text: string, maxTokens: number): string {
  if (!text) {
    return text;
  }

  const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  const ratio = estimatedTokens / text.length;
  const charsPerHalf = Math.max(1, Math.floor((maxTokens / 2 / ratio) * 0.95));

  let headPart = text.slice(0, charsPerHalf);
  const lastNewlineHead = headPart.lastIndexOf('\n');
  if (lastNewlineHead > 0) {
    headPart = headPart.slice(0, lastNewlineHead);
  }

  let tailPart = text.slice(-charsPerHalf);
  const firstNewlineTail = tailPart.indexOf('\n');
  if (firstNewlineTail > 0) {
    tailPart = tailPart.slice(firstNewlineTail + 1);
  }

  const truncationNote = `\n\n... [Content truncated: ~${estimatedTokens} tokens -> ~${maxTokens} tokens limit] ...\n\n`;
  return headPart + truncationNote + tailPart;
}

/**
 * 从文件系统读取文件内容的工具。
 *
 * 输出包含行号，格式为 'LINE_NUMBER|LINE_CONTENT'。
 * 支持通过指定行offset和limit来读取部分内容。
 */
export class ReadTool implements Tool<ReadFileInput> {
  public name = 'read_file';
  public description =
    "Read file contents from the filesystem. Output includes line numbers in format 'LINE_NUMBER|LINE_CONTENT'. " +
    'Supports reading partial content by specifying line offset and limit for large files.';
  public parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file',
      },
      offset: {
        type: 'integer',
        description:
          'Starting line number (1-indexed). Use for large files to read from specific line',
      },
      limit: {
        type: 'integer',
        description:
          'Number of lines to read. Use with offset for large files to read in chunks',
      },
    },
    required: ['path'],
  };

  /**
   * 创建一个新的ReadTool实例。
   *
   * @param workspaceDir - 用于解析相对路径的基础目录
   */
  constructor(private workspaceDir: string = '.') { }

  /**
   * 执行读取文件操作。
   *
   * @param params - 输入参数，包括path、offset和limit
   * @returns 包含文件内容或错误消息的ToolResult
   */
  async execute(params: ReadFileInput): Promise<ToolResult> {
    const targetPath = resolvePath(this.workspaceDir, params.path);
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        content: '',
        error: `File not found: ${params.path}`,
      };
    }

    try {
      const raw = await fs.readFile(targetPath, 'utf8');
      const lines = raw.split('\n');

      const offset =
        typeof params.offset === 'number' && Number.isFinite(params.offset)
          ? Math.floor(params.offset)
          : undefined;
      const limit =
        typeof params.limit === 'number' && Number.isFinite(params.limit)
          ? Math.floor(params.limit)
          : undefined;

      let start = offset ? offset - 1 : 0;
      let end = limit ? start + limit : lines.length;
      if (start < 0) start = 0;
      if (end > lines.length) end = lines.length;

      const selected = lines.slice(start, end);
      const numberedLines = selected.map((line, index) => {
        const lineNumber = String(start + index + 1).padStart(6, ' ');
        return `${lineNumber}|${line}`;
      });

      const content = truncateTextByTokens(numberedLines.join('\n'), 32000);
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: (error as Error).message || String(error),
      };
    }
  }
}

/**
 * 向文件写入内容的工具。
 *
 * 将完全覆盖现有文件。
 * 对于现有文件，应先使用read_file读取。
 */
export class WriteTool implements Tool<WriteFileInput> {
  public name = 'write_file';
  public description =
    'Write content to a file. Will overwrite existing files completely. ' +
    'For existing files, you should read the file first using read_file.';
  public parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file',
      },
      content: {
        type: 'string',
        description:
          'Complete content to write (will replace existing content)',
      },
    },
    required: ['path', 'content'],
  };

  /**
   * 创建一个新的WriteTool实例。
   *
   * @param workspaceDir - 用于解析相对路径的基础目录
   */
  constructor(private workspaceDir: string = '.') { }

  /**
   * 执行写入文件操作。
   *
   * @param params - 输入参数，包括path和content
   * @returns 包含成功消息或错误的ToolResult
   */
  async execute(params: WriteFileInput): Promise<ToolResult> {
    const targetPath = resolvePath(this.workspaceDir, params.path);
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, params.content ?? '', 'utf8');
      return {
        success: true,
        content: `Successfully wrote to ${targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: (error as Error).message || String(error),
      };
    }
  }
}

/**
 * 在文件中执行精确字符串替换的工具。
 *
 * old_str必须完全匹配且在文件中唯一出现。
 * 编辑前必须先读取文件。
 */
export class EditTool implements Tool<EditFileInput> {
  public name = 'edit_file';
  public description =
    'Perform exact string replacement in a file. The old_str must match exactly ' +
    'and appear uniquely in the file. You must read the file first before editing.';
  public parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file',
      },
      old_str: {
        type: 'string',
        description:
          'Exact string to find and replace (must be unique in file)',
      },
      new_str: {
        type: 'string',
        description: 'Replacement string',
      },
    },
    required: ['path', 'old_str', 'new_str'],
  };

  /**
   * 创建一个新的EditTool实例。
   *
   * @param workspaceDir - 用于解析相对路径的基础目录
   */
  constructor(private workspaceDir: string = '.') { }

  /**
   * 执行编辑文件操作。
   *
   * @param params - 输入参数，包括path、old_str和new_str
   * @returns 包含成功消息或错误的ToolResult
   */
  async execute(params: EditFileInput): Promise<ToolResult> {
    const targetPath = resolvePath(this.workspaceDir, params.path);
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        content: '',
        error: `File not found: ${params.path}`,
      };
    }

    try {
      const content = await fs.readFile(targetPath, 'utf8');

      if (!content.includes(params.old_str)) {
        return {
          success: false,
          content: '',
          error: `Text not found in file: ${params.old_str}`,
        };
      }

      const newContent = content.split(params.old_str).join(params.new_str);
      await fs.writeFile(targetPath, newContent, 'utf8');

      return {
        success: true,
        content: `Successfully edited ${targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: (error as Error).message || String(error),
      };
    }
  }
}
