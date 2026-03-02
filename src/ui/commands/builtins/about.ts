import type { SlashCommand, CommandResult } from '../types.js';

export const aboutCommand: SlashCommand = {
  name: 'about',
  description: 'Show version and configuration info',
  action: (): CommandResult => {
    return { type: 'about' };
  },
};
