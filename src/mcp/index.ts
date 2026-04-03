/**
 * @fileoverview MCP module public API.
 */

export {
  initMcpPool,
  listMcpServers,
  getMcpServer,
  getMcpToolsForServers,
  getMcpPromptInfo,
} from './pool.js';
export type { McpServerEntry } from './types.js';
