import * as path from 'node:path';
import * as os from 'node:os';

const APP_NAME = '.nano-agent';

function getUserHomeDir(): string {
  return os.homedir();
}

export function getConfigDir(): string {
  return path.join(getUserHomeDir(), APP_NAME, 'config');
}

export function getDataDir(): string {
  return path.join(getUserHomeDir(), APP_NAME, 'data');
}

export function getWorkspaceDir(): string {
  return path.join(getUserHomeDir(), APP_NAME, 'agent-space');
}

export function getLogsDir(): string {
  return path.join(getUserHomeDir(), APP_NAME, 'logs');
}
