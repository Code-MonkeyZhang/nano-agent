import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { Tool, ToolResult } from "./base.js";

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
 * Resolve file paths relative to the workspace directory.
 */
function resolvePath(workspaceDir: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(workspaceDir, targetPath);
}

/**
 * Truncate long content with a head/tail strategy based on a token estimate.
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
  const charsPerHalf = Math.max(
    1,
    Math.floor((maxTokens / 2 / ratio) * 0.95)
  );

  let headPart = text.slice(0, charsPerHalf);
  const lastNewlineHead = headPart.lastIndexOf("\n");
  if (lastNewlineHead > 0) {
    headPart = headPart.slice(0, lastNewlineHead);
  }

  let tailPart = text.slice(-charsPerHalf);
  const firstNewlineTail = tailPart.indexOf("\n");
  if (firstNewlineTail > 0) {
    tailPart = tailPart.slice(firstNewlineTail + 1);
  }

  const truncationNote = `\n\n... [Content truncated: ~${estimatedTokens} tokens -> ~${maxTokens} tokens limit] ...\n\n`;
  return headPart + truncationNote + tailPart;
}

export class ReadTool implements Tool<ReadFileInput> {
  public name = "read_file";
  public description =
    "Read file contents from the filesystem. Output always includes line numbers " +
    "in format 'LINE_NUMBER|LINE_CONTENT' (1-indexed). Supports reading partial content " +
    "by specifying line offset and limit for large files. " +
    "You can call this tool multiple times in parallel to read different files simultaneously.";
  public parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute or relative path to the file",
      },
      offset: {
        type: "integer",
        description:
          "Starting line number (1-indexed). Use for large files to read from specific line",
      },
      limit: {
        type: "integer",
        description:
          "Number of lines to read. Use with offset for large files to read in chunks",
      },
    },
    required: ["path"],
  };

  constructor(private workspaceDir: string = ".") {}

  /**
   * Read file content with optional line slicing and numbering.
   */
  async execute(params: ReadFileInput): Promise<ToolResult> {
    const targetPath = resolvePath(this.workspaceDir, params.path);
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        content: "",
        error: `File not found: ${params.path}`,
      };
    }

    try {
      const raw = await fs.readFile(targetPath, "utf8");
      const lines = raw.split("\n");

      const offset =
        typeof params.offset === "number" && Number.isFinite(params.offset)
          ? Math.floor(params.offset)
          : undefined;
      const limit =
        typeof params.limit === "number" && Number.isFinite(params.limit)
          ? Math.floor(params.limit)
          : undefined;

      let start = offset ? offset - 1 : 0;
      let end = limit ? start + limit : lines.length;
      if (start < 0) start = 0;
      if (end > lines.length) end = lines.length;

      const selected = lines.slice(start, end);
      const numberedLines = selected.map((line, index) => {
        const lineNumber = String(start + index + 1).padStart(6, " ");
        return `${lineNumber}|${line}`;
      });

      const content = truncateTextByTokens(numberedLines.join("\n"), 32000);
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        content: "",
        error: (error as Error).message || String(error),
      };
    }
  }
}

export class WriteTool implements Tool<WriteFileInput> {
  public name = "write_file";
  public description =
    "Write content to a file. Will overwrite existing files completely. " +
    "For existing files, you should read the file first using read_file. " +
    "Prefer editing existing files over creating new ones unless explicitly needed.";
  public parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute or relative path to the file",
      },
      content: {
        type: "string",
        description: "Complete content to write (will replace existing content)",
      },
    },
    required: ["path", "content"],
  };

  constructor(private workspaceDir: string = ".") {}

  /**
   * Write full content to a file, creating parent directories if needed.
   */
  async execute(params: WriteFileInput): Promise<ToolResult> {
    const targetPath = resolvePath(this.workspaceDir, params.path);
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, params.content ?? "", "utf8");
      return {
        success: true,
        content: `Successfully wrote to ${targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        content: "",
        error: (error as Error).message || String(error),
      };
    }
  }
}

export class EditTool implements Tool<EditFileInput> {
  public name = "edit_file";
  public description =
    "Perform exact string replacement in a file. The old_str must match exactly " +
    "and appear uniquely in the file, otherwise the operation will fail. " +
    "You must read the file first before editing. Preserve exact indentation from the source.";
  public parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute or relative path to the file",
      },
      old_str: {
        type: "string",
        description: "Exact string to find and replace (must be unique in file)",
      },
      new_str: {
        type: "string",
        description: "Replacement string (use for refactoring, renaming, etc.)",
      },
    },
    required: ["path", "old_str", "new_str"],
  };

  constructor(private workspaceDir: string = ".") {}

  /**
   * Replace occurrences of old_str with new_str in the target file.
   */
  async execute(params: EditFileInput): Promise<ToolResult> {
    const targetPath = resolvePath(this.workspaceDir, params.path);
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        content: "",
        error: `File not found: ${params.path}`,
      };
    }

    try {
      const content = await fs.readFile(targetPath, "utf8");

      if (!content.includes(params.old_str)) {
        return {
          success: false,
          content: "",
          error: `Text not found in file: ${params.old_str}`,
        };
      }

      const newContent = content.split(params.old_str).join(params.new_str);
      await fs.writeFile(targetPath, newContent, "utf8");

      return {
        success: true,
        content: `Successfully edited ${targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        content: "",
        error: (error as Error).message || String(error),
      };
    }
  }
}
