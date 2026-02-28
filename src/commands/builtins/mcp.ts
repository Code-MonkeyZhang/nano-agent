import type { SlashCommand, CommandResult } from '../types.js';
import { CommandKind } from '../types.js';

export const mcpCommand: SlashCommand = {
  name: 'mcp',
  description: 'List all MCP servers and their connection status',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (): CommandResult => {
    return { type: 'mcp' };
  },
};
