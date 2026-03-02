import type { SlashCommand, CommandResult } from '../types.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show available commands',
  action: (): CommandResult => {
    return { type: 'help' };
  },
};
