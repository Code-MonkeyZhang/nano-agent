import type { McpServerConfig } from '../tools/mcp/types.js';
import type { Tool } from '../tools/base.js';

/**
 * MCP tool identifier format: "mcp:{serverName}:{toolName}"
 * Examples: "mcp:ticktick:get_tasks", "mcp:notion:create_page"
 */
export type McpToolId = `mcp:${string}:${string}`;

/**
 * Connection status of an MCP server.
 */
export type McpServerStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Metadata for an MCP tool.
 * Contains display information without the actual Tool instance.
 */
export interface McpToolMeta {
  id: McpToolId;
  name: string;
  description: string;
}

/**
 * MCP server entry in the pool.
 * Tracks configuration, connection status, and loaded tools.
 */
export interface McpServerEntry {
  name: string;
  config: McpServerConfig;
  status: McpServerStatus;
  tools: McpToolMeta[];
  error?: string;
}

/**
 * Internal representation of a connected MCP server.
 */
export interface McpConnection {
  name: string;
  tools: Tool[];
  disconnect: () => Promise<void>;
}

/**
 * Parsed MCP tool ID components.
 */
export interface ParsedMcpToolId {
  serverName: string;
  toolName: string;
}
