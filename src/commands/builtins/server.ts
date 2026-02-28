import type { SlashCommand, CommandResult } from '../types.js';
import { CommandKind } from '../types.js';
import { getServerManager } from '../../server/index.js';
import type { ServerState } from '../../ui/types.js';

export const serverStartCommand: SlashCommand = {
  name: 'server-start',
  altNames: ['server'],
  description: 'Start HTTP server with Cloudflare tunnel',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (): Promise<CommandResult> => {
    const manager = getServerManager();

    // 如果已经开启server 返回 status
    if (manager.isRunning()) {
      const state = manager.getState();
      return { type: 'server_status', state };
    }

    // 正式开启http server
    const result = await manager.start({ enableTunnel: true });

    if (result.success) {
      const state = manager.getState();
      return { type: 'server_status', state };
    } else {
      const state: ServerState = {
        status: 'error',
        error: result.error,
      };
      return { type: 'server_status', state };
    }
  },
};

export const serverLocalCommand: SlashCommand = {
  name: 'server-local',
  description: 'Start HTTP server (local only, no tunnel)',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (): Promise<CommandResult> => {
    const manager = getServerManager();

    if (manager.isRunning()) {
      const state = manager.getState();
      return { type: 'server_status', state };
    }

    const result = await manager.start({ enableTunnel: false });

    if (result.success) {
      const state = manager.getState();
      return { type: 'server_status', state };
    } else {
      const state: ServerState = {
        status: 'error',
        error: result.error,
      };
      return { type: 'server_status', state };
    }
  },
};

export const serverStatusCommand: SlashCommand = {
  name: 'server-status',
  description: 'Show server status and URLs',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (): CommandResult => {
    const manager = getServerManager();
    const state = manager.getState();
    return { type: 'server_status', state };
  },
};

export const serverStopCommand: SlashCommand = {
  name: 'server-stop',
  description: 'Stop the HTTP server',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (): Promise<CommandResult> => {
    const manager = getServerManager();

    if (!manager.isRunning()) {
      const state: ServerState = {
        status: 'stopped',
        error: 'Server is not running',
      };
      return { type: 'server_status', state };
    }

    await manager.stop();
    const state = manager.getState();
    return { type: 'server_status', state };
  },
};

export const serverCommands: SlashCommand[] = [
  serverStartCommand,
  serverLocalCommand,
  serverStatusCommand,
  serverStopCommand,
];
