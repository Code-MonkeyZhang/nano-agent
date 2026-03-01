import type { SlashCommand, CommandResult } from '../types.js';
import { CommandKind } from '../types.js';

export const aboutCommand: SlashCommand = {
  name: 'about',
  description: 'Show version and configuration info',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (): CommandResult => {
    return { type: 'about' };
  },
};
