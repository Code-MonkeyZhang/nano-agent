/**
 * @fileoverview MCP Connection Pool - global singleton for managing MCP server connections.
 *
 
 */

import { Logger } from '../util/logger.js';
import { loadMcpConfig } from './config.js';
import { connectAllServers } from './loader.js';
import type { McpServerEntry } from './types.js';
import type { Tool } from '../tools/base.js';

const serverEntries: Map<string, McpServerEntry> = new Map();
const connections: Map<
  string,
  { name: string; tools: Tool[]; disconnect: () => Promise<void> }
> = new Map();
let initialized = false;

/**
 * Initialize the MCP connection pool.
 * Reads config, then connects to all servers in parallel.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export async function initMcpPool(): Promise<void> {
  if (initialized) {
    return;
  }

  const serverConfigs = loadMcpConfig();
  if (serverConfigs.size === 0) {
    Logger.log('MCP', 'No MCP servers to connect');
    initialized = true;
    return;
  }

  for (const [name, config] of serverConfigs) {
    serverEntries.set(name, {
      name,
      config,
      status: 'connecting',
      tools: [],
    });
  }

  initialized = true;

  const results = await connectAllServers(serverConfigs);

  for (const result of results) {
    const entry = serverEntries.get(result.name);
    if (!entry) continue;

    if (result.connection) {
      connections.set(result.name, result.connection);
      entry.status = 'connected';
      entry.tools = result.tools;
      entry.error = undefined;
    } else {
      entry.status = 'disconnected';
      entry.error = result.error ?? 'Unknown error';
    }
  }
}

/**
 * List all MCP server entries with their status and tools.
 */
export function listMcpServers(): McpServerEntry[] {
  return Array.from(serverEntries.values());
}

/**
 * Get a specific MCP server entry by name.
 */
export function getMcpServer(name: string): McpServerEntry | undefined {
  return serverEntries.get(name);
}

/**
 * Get all tools from the specified MCP servers.
 * Only returns tools from servers that are currently connected.
 * Disconnected or unknown servers are skipped.
 *
 * @param serverNames - List of MCP server names
 * @returns Array of Tool instances from connected servers
 */
export function getMcpToolsForServers(serverNames: string[]): Tool[] {
  const allTools: Tool[] = [];

  for (const name of serverNames) {
    const entry = serverEntries.get(name);
    if (!entry || entry.status !== 'connected') {
      if (entry) {
        Logger.log(
          'MCP',
          `Server '${name}' is ${entry.status}, skipping its tools`
        );
      } else {
        Logger.log('MCP', `Server '${name}' not found, skipping`);
      }
      continue;
    }

    const connection = connections.get(name);
    if (connection) {
      allTools.push(...connection.tools);
    }
  }

  return allTools;
}

/**
 * Get MCP server status info for system prompt generation.
 * Returns server name -> status mapping for the specified names.
 *
 * @param serverNames - List of MCP server names
 * @returns Array of { name, status } for prompt inclusion
 */
export function getMcpPromptInfo(
  serverNames: string[]
): Array<{ name: string; status: string }> {
  return serverNames.map((name) => {
    const entry = serverEntries.get(name);
    return {
      name,
      status: entry?.status ?? 'unknown',
    };
  });
}
