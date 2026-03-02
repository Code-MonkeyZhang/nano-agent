import type { SlashCommand, CommandResult } from '../types.js';

export const mcpCommand: SlashCommand = {
  name: 'mcp',
  description: 'List all MCP servers and their connection status',
  action: (): CommandResult => {
    return { type: 'mcp' };
  },
};
