import type { Tool } from '../tools/base.js';

/**
 * Built-in tool identifier format: "builtin:{toolName}"
 * Examples: "builtin:read", "builtin:write", "builtin:bash"
 */
export type BuiltinToolId = `builtin:${string}`;

/**
 * Metadata for a built-in tool.
 * Contains display information without the actual Tool instance.
 */
export interface BuiltinToolMeta {
  id: BuiltinToolId;
  name: string;
  description: string;
}

/**
 * Internal representation of a registered built-in tool.
 */
export interface BuiltinToolEntry {
  id: BuiltinToolId;
  tool: Tool;
}

/**
 * Factory function type for creating built-in tools.
 * Each built-in tool may require workspace directory for path resolution.
 */
export type BuiltinToolFactory = (workspaceDir: string) => Tool;
