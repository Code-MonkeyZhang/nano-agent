/**
 * @fileoverview MCP server connection and tool wrapper.
 *
 * MCPServerConnection manages a single MCP server connection (stdio/sse/streamable_http).
 * MCPTool wraps a remote MCP tool into the local Tool interface.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Logger } from '../util/logger.js';
import type { Tool, ToolInput, ToolResult, JsonSchema } from '../tools/base.js';
import type {
  Closable,
  ConnectionType,
  McpClient,
  McpServerConfig,
} from './types.js';

const DEFAULT_TIMEOUTS = {
  connectTimeout: 10,
  executeTimeout: 60,
  sseReadTimeout: 120,
};

export class MCPTool implements Tool {
  public name: string;
  public description: string;
  public parameters: JsonSchema;

  private session: McpClient;
  private executeTimeoutMs: number;

  constructor(options: {
    name: string;
    description: string;
    parameters: JsonSchema;
    session: McpClient;
    executeTimeoutSec: number;
  }) {
    this.name = options.name;
    this.description = options.description;
    this.parameters = options.parameters;
    this.session = options.session;
    this.executeTimeoutMs = options.executeTimeoutSec * 1000;
  }

  async execute(params: ToolInput): Promise<ToolResult> {
    try {
      const result = await withTimeout(
        this.session.callTool({
          name: this.name,
          arguments: params,
        }),
        this.executeTimeoutMs,
        `MCP tool '${this.name}' execution timed out after ${this.executeTimeoutMs / 1000}s`
      );

      const content = normalizeContent(result.content);
      const isError = Boolean(result.isError ?? result.is_error ?? false);

      return {
        success: !isError,
        content,
        error: isError ? 'Tool returned error' : null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: '',
        error: `MCP tool execution failed: ${message}`,
      };
    }
  }
}

export class MCPServerConnection {
  public name: string;
  public connectionType: ConnectionType;
  public command?: string;
  public args: string[];
  public cwd?: string;
  public env: Record<string, string>;
  public url?: string;
  public headers: Record<string, string>;
  public connectTimeoutSec?: number;
  public executeTimeoutSec?: number;
  public sseReadTimeoutSec?: number;

  public tools: MCPTool[] = [];

  private session: McpClient | null = null;
  private transport: Closable | null = null;

  constructor(options: {
    name: string;
    connectionType: ConnectionType;
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    connectTimeoutSec?: number;
    executeTimeoutSec?: number;
    sseReadTimeoutSec?: number;
  }) {
    this.name = options.name;
    this.connectionType = options.connectionType;
    this.command = options.command;
    this.args = options.args ?? [];
    this.cwd = options.cwd;
    this.env = options.env ?? {};
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.connectTimeoutSec = options.connectTimeoutSec;
    this.executeTimeoutSec = options.executeTimeoutSec;
    this.sseReadTimeoutSec = options.sseReadTimeoutSec;
  }

  private getConnectTimeoutSec(): number {
    return this.connectTimeoutSec ?? DEFAULT_TIMEOUTS.connectTimeout;
  }

  private getExecuteTimeoutSec(): number {
    return this.executeTimeoutSec ?? DEFAULT_TIMEOUTS.executeTimeout;
  }

  /**
   * Create the appropriate transport based on connection type.
   * Supports stdio, sse, and streamable_http transports.
   */
  private createTransport(): Closable {
    if (this.connectionType === 'stdio') {
      if (!this.command) {
        throw new Error('Missing command for stdio transport');
      }
      return new StdioClientTransport({
        command: this.command,
        args: this.args,
        cwd: this.cwd,
        env: Object.keys(this.env).length > 0 ? this.env : undefined,
        stderr: 'pipe',
      });
    }

    if (!this.url) {
      throw new Error('Missing url for remote transport');
    }

    if (this.connectionType === 'sse') {
      return new SSEClientTransport(new URL(this.url), {
        requestInit: {
          headers:
            Object.keys(this.headers).length > 0 ? this.headers : undefined,
        },
      });
    }

    // streamable_http (default for URL-based connections)
    return new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: {
        headers:
          Object.keys(this.headers).length > 0 ? this.headers : undefined,
      },
    });
  }

  /**
   * Connect to the MCP server, discover available tools, and populate this.tools.
   * Returns true on success, false on failure. On failure, resources are cleaned up.
   */
  async connect(): Promise<boolean> {
    const connectTimeoutMs = this.getConnectTimeoutSec() * 1000;
    try {
      const transport = this.createTransport();
      const client = new Client({
        name: 'nano-agent',
        version: '1.0.0',
      }) as unknown as McpClient;

      const toolsList = await withTimeout(
        (async () => {
          await client.connect(transport);
          return await client.listTools();
        })(),
        connectTimeoutMs,
        `Connection to MCP server '${this.name}' timed out after ${this.getConnectTimeoutSec()}s`
      );

      this.session = client;
      this.transport = transport;

      const executeTimeout = this.getExecuteTimeoutSec();
      for (const tool of toolsList.tools ?? []) {
        const rawParameters = tool.inputSchema ?? tool.input_schema ?? {};
        const normalizedParameters = normalizeToolSchema(rawParameters);
        const normalizedDescription = normalizeToolDescription(
          tool.description ?? ''
        );

        this.tools.push(
          new MCPTool({
            name: tool.name,
            description: normalizedDescription,
            parameters: normalizedParameters,
            session: client,
            executeTimeoutSec: executeTimeout,
          })
        );
      }

      Logger.log(
        'MCP',
        `Connected to '${this.name}' (${this.connectionType}) - loaded ${this.tools.length} tools`
      );
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.log(
        'ERROR',
        `Failed to connect MCP server '${this.name}': ${message}`
      );
      await this.disconnect();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    const session = this.session;
    const transport = this.transport;
    this.session = null;
    this.transport = null;

    if (session?.close) {
      await session.close();
    }
    if (transport?.close) {
      await transport.close();
    }
  }
}

/**
 * Determine the connection type from server config.
 * Normalizes 'http' to 'streamable_http' since both use the same transport.
 * Defaults to 'streamable_http' for URL-based configs, 'stdio' otherwise.
 */
export function determineConnectionType(
  config: McpServerConfig
): ConnectionType {
  const explicitType = config.type?.toLowerCase();

  switch (explicitType) {
    case 'stdio':
      return 'stdio';
    case 'sse':
      return 'sse';
    case 'http':
    case 'streamable_http':
      return 'streamable_http';
    default:
      if (config.url) {
        return 'streamable_http';
      }
      return 'stdio';
  }
}

/**
 * Wrap a promise with a timeout. If timeoutMs <= 0 or not finite,
 * the promise is returned as-is without a timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalize MCP tool result content to a plain string.
 * Handles string, array of content blocks (text extraction), and fallback JSON serialization.
 */
function normalizeContent(content: unknown): string {
  if (content === undefined || content === null) {
    return '';
  }
  const items = Array.isArray(content) ? content : [content];
  const parts: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      parts.push(item);
      continue;
    }
    if (isRecord(item) && typeof item['text'] === 'string') {
      parts.push(item['text']);
      continue;
    }
    try {
      parts.push(JSON.stringify(item));
    } catch {
      parts.push(String(item));
    }
  }
  return parts.join('\n');
}

/**
 * Normalize an MCP tool input schema into a simplified JSON Schema format.
 * Handles anyOf unwrapping (strips null variants), title-to-description conversion,
 * and preserves type, items, default, enum, required fields.
 */
function normalizeToolSchema(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }

  const normalized: JsonSchema = {
    type: (schema['type'] as string) || 'object',
  };

  if (schema['properties'] && isRecord(schema['properties'])) {
    const normalizedProps: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema['properties'])) {
      if (!isRecord(value)) continue;

      const prop = value;
      const normalizedProp: Record<string, unknown> = {};

      if (prop['anyOf'] && Array.isArray(prop['anyOf'])) {
        const nonNullType = prop['anyOf'].find(
          (t: unknown) => isRecord(t) && t['type'] !== 'null'
        );
        if (nonNullType && isRecord(nonNullType)) {
          const typeObj = nonNullType;
          normalizedProp['type'] = typeObj['type'];
          if (typeObj['items']) {
            normalizedProp['items'] = typeObj['items'];
          }
        }
      } else if (prop['type']) {
        normalizedProp['type'] = prop['type'];
        if (prop['items']) {
          normalizedProp['items'] = prop['items'];
        }
      }

      if (prop['description']) {
        normalizedProp['description'] = prop['description'];
      } else if (prop['title'] && typeof prop['title'] === 'string') {
        normalizedProp['description'] = prop['title']
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .toLowerCase();
      }

      if (prop['default'] !== undefined) {
        normalizedProp['default'] = prop['default'];
      }

      if (prop['enum']) {
        normalizedProp['enum'] = prop['enum'];
      }

      normalizedProps[key] = normalizedProp;
    }

    normalized['properties'] = normalizedProps;
  }

  if (schema['required'] && Array.isArray(schema['required'])) {
    normalized['required'] = schema['required'];
  }

  return normalized;
}

/** Collapse excessive whitespace and newlines in tool descriptions. */
function normalizeToolDescription(description: string): string {
  if (!description) return '';
  return description
    .replace(/\n\s+/g, '\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}
