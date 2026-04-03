/**
 * @fileoverview MCP configuration file loader.
 *
 * Reads mcp.json from ~/.nano-agent/mcp/mcp.json and returns
 * the parsed server configurations.
 */

import * as fs from 'node:fs';
import { Logger } from '../util/logger.js';
import { getMcpConfigPath } from '../util/paths.js';
import type { McpConfigFile, McpServerConfig } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Load and parse the MCP configuration file.
 *
 * @param configPath - Optional custom path to mcp.json (default: ~/.nano-agent/mcp/mcp.json)
 * @returns A map of server name -> server config, or an empty map if file doesn't exist
 */
export function loadMcpConfig(
  configPath?: string
): Map<string, McpServerConfig> {
  const resolvedPath = configPath ?? getMcpConfigPath();
  const result = new Map<string, McpServerConfig>();

  if (!fs.existsSync(resolvedPath)) {
    Logger.log('MCP', `Config not found: ${resolvedPath}`);
    return result;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const config = JSON.parse(raw) as McpConfigFile;
    const servers = config.mcpServers ?? {};

    if (!isRecord(servers) || Object.keys(servers).length === 0) {
      Logger.log('MCP', 'No MCP servers configured');
      return result;
    }

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

      result.set(name, serverConfig);
    }

    Logger.log('MCP', `Loaded ${result.size} MCP server configs`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.log('ERROR', `Failed to load MCP config: ${message}`);
  }

  return result;
}
