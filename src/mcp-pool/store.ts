import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../util/logger.js';
import type { McpConfigFile, McpServerConfig } from '../tools/mcp/types.js';
import type { Tool } from '../tools/base.js';
import { isRecord } from '../tools/mcp/utils.js';
import { connectMcpServer } from './loader.js';
import type {
  McpServerEntry,
  McpToolMeta,
  McpToolId,
  McpConnection,
  ParsedMcpToolId,
} from './types.js';

const serverConfigs: Map<string, McpServerConfig> = new Map();
const serverEntries: Map<string, McpServerEntry> = new Map();
const connections: Map<string, McpConnection> = new Map();
const connectingPromises: Map<
  string,
  Promise<McpConnection | null>
> = new Map();

/**
 * Initialize the MCP pool by reading config file.
 * Does NOT connect to any servers - uses lazy loading.
 *
 * @param configPath - Path to MCP config JSON file (default: "config/mcp.json")
 */
export async function initMcpPool(
  configPath: string = 'config/mcp.json'
): Promise<void> {
  const resolvedPath = path.resolve(configPath);
  if (!fs.existsSync(resolvedPath)) {
    Logger.log('MCP', `Config not found: ${resolvedPath}`);
    return;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const config = JSON.parse(raw) as McpConfigFile;
    const servers = config.mcpServers ?? {};

    if (!isRecord(servers) || Object.keys(servers).length === 0) {
      Logger.log('MCP', 'No MCP servers configured');
      return;
    }

    serverConfigs.clear();
    serverEntries.clear();
    connections.clear();
    connectingPromises.clear();

    for (const [name, serverConfigValue] of Object.entries(servers)) {
      if (!isRecord(serverConfigValue)) {
        Logger.log('MCP', `Skipping invalid server config: ${name}`);
        continue;
      }

      const serverConfig = serverConfigValue as McpServerConfig;
      if (serverConfig.disabled) {
        Logger.log('MCP', `Skipping disabled server: ${name}`);
        continue;
      }

      serverConfigs.set(name, serverConfig);
      serverEntries.set(name, {
        name,
        config: serverConfig,
        status: 'disconnected',
        tools: [],
      });
    }

    Logger.log('MCP', `Loaded ${serverConfigs.size} MCP server configs`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.log('ERROR', `Failed to load MCP config: ${message}`);
  }
}

/**
 * List all MCP servers with their status and tools.
 */
export function listMcpServers(): McpServerEntry[] {
  return Array.from(serverEntries.values());
}

/**
 * Get a specific MCP server by name.
 */
export function getMcpServer(name: string): McpServerEntry | undefined {
  return serverEntries.get(name);
}

/**
 * Connect to an MCP server and load its tools.
 * Uses a promise cache to prevent concurrent connection attempts.
 *
 * @param name - The server name
 * @returns The list of tools on the server, or throws on error
 */
export async function connectMcpServerByName(
  name: string
): Promise<McpToolMeta[]> {
  const entry = serverEntries.get(name);
  if (!entry) {
    throw new Error(`MCP server '${name}' not found`);
  }

  if (entry.status === 'connected') {
    return entry.tools;
  }

  const existingPromise = connectingPromises.get(name);
  if (existingPromise) {
    await existingPromise;
    return serverEntries.get(name)?.tools ?? [];
  }

  entry.status = 'connecting';

  const connectionPromise = (async (): Promise<McpConnection | null> => {
    const config = serverConfigs.get(name);
    if (!config) {
      entry.status = 'error';
      entry.error = 'Configuration not found';
      return null;
    }

    const result = await connectMcpServer(name, config);

    if (result.error || !result.connection) {
      entry.status = 'error';
      entry.error = result.error ?? 'Unknown error';
      return null;
    }

    connections.set(name, result.connection);
    entry.status = 'connected';
    entry.tools = result.tools;
    entry.error = undefined;

    Logger.log(
      'MCP',
      `Connected to '${name}' - loaded ${result.tools.length} tools`
    );
    return result.connection;
  })();

  connectingPromises.set(name, connectionPromise);

  try {
    await connectionPromise;
    return serverEntries.get(name)?.tools ?? [];
  } finally {
    connectingPromises.delete(name);
  }
}

/**
 * Get an MCP tool instance by its full ID.
 * Triggers lazy loading if the server is not yet connected.
 *
 * @param toolId - The tool ID (e.g., "mcp:ticktick:get_tasks")
 * @returns The Tool instance, or undefined if not found
 */
export async function getMcpTool(toolId: McpToolId): Promise<Tool | undefined> {
  const parsed = parseMcpToolId(toolId);
  if (!parsed) {
    return undefined;
  }

  const { serverName, toolName } = parsed;
  const entry = serverEntries.get(serverName);
  if (!entry) {
    return undefined;
  }

  if (entry.status !== 'connected') {
    await connectMcpServerByName(serverName);
  }

  const connection = connections.get(serverName);
  if (!connection) {
    return undefined;
  }

  return connection.tools.find((t) => t.name === toolName);
}

/**
 * List all tools for a specific MCP server.
 * Triggers lazy loading if the server is not yet connected.
 */
export async function listMcpTools(serverName: string): Promise<McpToolMeta[]> {
  const entry = serverEntries.get(serverName);
  if (!entry) {
    return [];
  }

  if (entry.status !== 'connected') {
    await connectMcpServerByName(serverName);
  }

  return entry.tools;
}

/**
 * Parse an MCP tool ID into server name and tool name.
 */
export function parseMcpToolId(toolId: string): ParsedMcpToolId | null {
  if (!toolId.startsWith('mcp:')) {
    return null;
  }

  const parts = toolId.split(':');
  if (parts.length < 3) {
    return null;
  }

  return {
    serverName: parts[1],
    toolName: parts.slice(2).join(':'),
  };
}

/**
 * Check if a tool ID belongs to the MCP pool.
 */
export function isMcpToolId(toolId: string): toolId is McpToolId {
  return toolId.startsWith('mcp:');
}

/**
 * Get all tool instances from connected MCP servers.
 * Used by AgentFactory when creating an agent.
 *
 * @param serverNames - List of server names to get tools from
 */
export async function getMcpToolsForServers(
  serverNames: string[]
): Promise<Tool[]> {
  const allTools: Tool[] = [];

  for (const name of serverNames) {
    const entry = serverEntries.get(name);
    if (!entry) {
      continue;
    }

    if (entry.status !== 'connected') {
      await connectMcpServerByName(name);
    }

    const connection = connections.get(name);
    if (connection) {
      allTools.push(...connection.tools);
    }
  }

  return allTools;
}

/**
 * Disconnect all MCP servers and clear the pool.
 */
export async function cleanupMcpPool(): Promise<void> {
  for (const connection of connections.values()) {
    await connection.disconnect();
  }
  connections.clear();
  connectingPromises.clear();
  serverConfigs.clear();
  serverEntries.clear();
}
