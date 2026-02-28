import type { AgentCore } from '../agent.js';

export enum CommandKind {
  BUILT_IN = 'built-in',
  FILE = 'file',
}

export type CommandResult =
  | { type: 'message'; content: string; messageType: 'info' | 'error' }
  | { type: 'help' }
  | { type: 'about' }
  | { type: 'open_url'; url: string; message: string };

export interface CommandContext {
  agent: AgentCore;
  args: string;
}

export interface SlashCommand {
  name: string;
  altNames?: string[];
  description: string;
  hidden?: boolean;
  kind: CommandKind;
  autoExecute?: boolean;
  action: (context: CommandContext) => Promise<CommandResult> | CommandResult;
  completion?: (partialArg: string) => string[];
  subCommands?: SlashCommand[];
}
