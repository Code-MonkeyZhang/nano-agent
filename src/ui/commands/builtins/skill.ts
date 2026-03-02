import type { SlashCommand, CommandResult } from '../types.js';

export const skillCommand: SlashCommand = {
  name: 'skill',
  description: 'List all available skills',
  action: (): CommandResult => {
    return { type: 'skill' };
  },
};
