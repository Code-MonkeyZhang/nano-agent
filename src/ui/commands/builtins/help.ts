import type { SlashCommand, CommandResult } from '../types.js';
import { CommandKind } from '../types.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  altNames: ['h', '?'],
  description: 'Show available commands',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (): CommandResult => {
    return { type: 'help' };
  },
};
