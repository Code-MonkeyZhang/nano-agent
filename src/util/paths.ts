/**
 * @fileoverview Application path utilities for nano-agent.
 *
 * Directory structure:
 * ~/.nano-agent/
 * ├── config/
 * │   └── config.yaml
 * ├── data/
 * │   ├── auth.json
 * │   ├── skills/
 * │   ├── agents/
 * │   └── mcp/
 * │       ├── mcp.json
 * │       └── servers/
 * ├── agent-space/
 * └── logs/
 */

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
export const getAuthPath = () => path.join(getDataDir(), 'auth.json');
export const getMcpConfigPath = () => path.join(getMcpDir(), 'mcp.json');
export const getServerJsonPath = () => path.join(getConfigDir(), 'server.json');
export const getBinDir = () => path.join(APP_DIR, 'bin');
export const getCloudflaredBinPath = () =>
  path.join(getBinDir(), 'cloudflared');
