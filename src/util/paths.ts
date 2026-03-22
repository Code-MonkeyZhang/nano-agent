import * as os from 'node:os';
import * as path from 'node:path';

const APP_NAME = '.nano-agent';
const APP_DIR = path.join(os.homedir(), APP_NAME);

export const getConfigDir = () => path.join(APP_DIR, 'config');
export const getDataDir = () => path.join(APP_DIR, 'data');
export const getWorkspaceDir = () => path.join(APP_DIR, 'agent-space');
export const getLogsDir = () => path.join(APP_DIR, 'logs');
export const getSkillsDir = () => path.join(getDataDir(), 'skills');
export const getMcpDir = () => path.join(getDataDir(), 'mcp');
export const getMcpServersDir = () => path.join(getMcpDir(), 'servers');
export const getAgentsDir = () => path.join(getDataDir(), 'agents');
export const getConfigPath = () => path.join(getConfigDir(), 'config.yaml');
export const getCredentialsPath = () =>
  path.join(getDataDir(), 'credentials.json');
export const getMcpConfigPath = () => path.join(getMcpDir(), 'mcp.json');
