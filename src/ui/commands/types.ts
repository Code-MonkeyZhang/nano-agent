import type { AgentCore } from '../../agent.js';
import type { ServerState } from '../types.js';

export type CommandResult =
  | { type: 'message'; content: string; messageType: 'info' | 'error' }
  | { type: 'help' }
  | { type: 'about' }
  | { type: 'mcp' }
  | { type: 'skill' }
  | { type: 'server_status'; state: ServerState }
  | { type: 'open_url'; url: string; message: string };

export interface CommandContext {
  agent: AgentCore;
  args: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  action: (context: CommandContext) => Promise<CommandResult> | CommandResult;
}
