import type { SlashCommand, CommandResult } from '../types.js';
import { CommandKind } from '../types.js';

export const skillCommand: SlashCommand = {
  name: 'skill',
  description: 'List all available skills',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (): CommandResult => {
    return { type: 'skill' };
  },
};
