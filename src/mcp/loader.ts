/**
 * @fileoverview Parallel MCP server loader.
 *
 * Connects to all configured MCP servers concurrently at startup.
 * Each connection is independent - a single failure does not affect others.
 */

import { Logger } from '../util/logger.js';
import { MCPServerConnection, determineConnectionType } from './connection.js';
import type { McpServerConfig } from './types.js';
import type { McpConnection, McpToolMeta } from './types.js';

/**
 * Connect to a single MCP server and return its connection result.
 */
async function connectOne(
  name: string,
  config: McpServerConfig
): Promise<{
  name: string;
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
      return { name, tools: [], error: 'Connection failed' };
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

    return { name, connection, tools };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.log('ERROR', `Failed to connect MCP server '${name}': ${message}`);
    return { name, tools: [], error: message };
  }
}

/**
 * Connect to all configured MCP servers in parallel.
 *
 * @param serverConfigs - Map of server name -> config
 * @returns Array of connection results (one per server)
 */
export async function connectAllServers(
  serverConfigs: Map<string, McpServerConfig>
): Promise<
  Array<{
    name: string;
    connection?: McpConnection;
    tools: McpToolMeta[];
    error?: string;
  }>
> {
  if (serverConfigs.size === 0) {
    return [];
  }

  Logger.log('MCP', `Connecting to ${serverConfigs.size} MCP servers...`);

  const entries = Array.from(serverConfigs.entries());
  const results = await Promise.all(
    entries.map(([name, config]) => connectOne(name, config))
  );

  const connectedCount = results.filter((r) => r.connection).length;
  const failedCount = results.length - connectedCount;

  Logger.log(
    'MCP',
    `MCP connection complete: ${connectedCount} connected, ${failedCount} failed`
  );

  return results;
}
