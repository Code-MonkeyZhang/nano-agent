import { Logger } from '../util/logger.js';
import { MCPServerConnection } from '../tools/mcp/connection.js';
import type { McpServerConfig, ConnectionType } from '../tools/mcp/types.js';
import type { McpConnection, McpToolMeta } from './types.js';

/**
 * Determine the connection type from server config.
 */
function determineConnectionType(config: McpServerConfig): ConnectionType {
  const explicitType = config.type?.toLowerCase();

  switch (explicitType) {
    case 'stdio':
    case 'sse':
    case 'http':
    case 'streamable_http':
      return explicitType;
    default:
      if (config.url) {
        return 'streamable_http';
      }
      return 'stdio';
  }
}

/**
 * Connect to an MCP server and retrieve its tools.
 *
 * @param name - The server name
 * @param config - The server configuration
 * @returns A promise resolving to McpConnection on success, or error message on failure
 */
export async function connectMcpServer(
  name: string,
  config: McpServerConfig
): Promise<{
  connection?: McpConnection;
  tools: McpToolMeta[];
  error?: string;
}> {
  const connectionType = determineConnectionType(config);
  const serverConn = new MCPServerConnection({
    name,
    connectionType,
    command: config.command,
    args: config.args,
    cwd: config.cwd,
    env: config.env,
    url: config.url,
    headers: config.headers,
    connectTimeoutSec: config.connect_timeout,
    executeTimeoutSec: config.execute_timeout,
    sseReadTimeoutSec: config.sse_read_timeout,
  });

  try {
    const success = await serverConn.connect();
    if (!success) {
      return { tools: [], error: 'Connection failed' };
    }

    const tools: McpToolMeta[] = serverConn.tools.map((tool) => ({
      id: `mcp:${name}:${tool.name}`,
      name: tool.name,
      description: tool.description,
    }));

    const connection: McpConnection = {
      name,
      tools: serverConn.tools,
      disconnect: () => serverConn.disconnect(),
    };

    return { connection, tools };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.log('ERROR', `Failed to connect MCP server '${name}': ${message}`);
    return { tools: [], error: message };
  }
}
