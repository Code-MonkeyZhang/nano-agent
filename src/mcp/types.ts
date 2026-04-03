/**
 * @fileoverview Type definitions for the MCP module.
 */

import type { JsonSchema } from '../tools/base.js';
import type { Tool } from '../tools/base.js';

export type ConnectionType = 'stdio' | 'sse' | 'streamable_http';

export type McpServerStatus = 'disconnected' | 'connecting' | 'connected';

export interface McpCallToolResult {
  content?: unknown;
  isError?: boolean;
  is_error?: boolean;
}

export interface McpListToolsResult {
  tools: McpToolDefinition[];
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
  input_schema?: JsonSchema;
}

export type McpClient = {
  connect: (transport: unknown) => Promise<void>;
  listTools: () => Promise<McpListToolsResult>;
  callTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<McpCallToolResult>;
  close?: () => Promise<void>;
};

export type Closable = {
  close?: () => Promise<void> | void;
};

export type ClientConstructor = new (options: {
  name: string;
  version: string;
}) => McpClient;

export type TransportConstructor = new (
  options: Record<string, unknown>
) => Closable;

export interface McpServerConfig {
  description?: string;
  type?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
  connect_timeout?: number;
  execute_timeout?: number;
  sse_read_timeout?: number;
}

export interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig>;
}

export interface McpToolMeta {
  id: string;
  name: string;
  description: string;
}

export interface McpServerEntry {
  name: string;
  config: McpServerConfig;
  status: McpServerStatus;
  tools: McpToolMeta[];
  error?: string;
}

export interface McpConnection {
  name: string;
  tools: Tool[];
  disconnect: () => Promise<void>;
}
