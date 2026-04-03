/**
 * @fileoverview Application path utilities for nano-agent.
 *
 * Directory structure:
 * ~/.nano-agent/
 * ├── config/
 * │   ├── config.yaml
 * │   ├── server.json
 * │   └── auth.json
 * ├── agents/
 * │   └── {agentId}/
 * │       ├── config.json
 * │       ├── assets/
 * │       │   ├── avatar.png
 * │       │   ├── voice.aac
 * │       │   ├── body/
 * │       │   └── backgrounds/
 * │       ├── sessions/
 * │       │   ├── index.json
 * │       │   └── {sessionId}.json
 * │       └── memory/
 * ├── skills/
 * │   └── {skillName}/
 * │       └── SKILL.md
 * ├── mcp/
 * │   ├── mcp.json
 * │   └── servers/
 * ├── workspace/
 * └── logs/
 */

import * as os from 'node:os';
import * as path from 'node:path';

const APP_NAME = '.nano-agent';
const APP_DIR = path.join(os.homedir(), APP_NAME);

// --- Top-level directories ---

export const getConfigDir = () => path.join(APP_DIR, 'config');
export const getAgentsDir = () => path.join(APP_DIR, 'agents');
export const getSkillsDir = () => path.join(APP_DIR, 'skills');
export const getMcpDir = () => path.join(APP_DIR, 'mcp');
export const getMcpServersDir = () => path.join(getMcpDir(), 'servers');
export const getWorkspaceDir = () => path.join(APP_DIR, 'workspace');
export const getLogsDir = () => path.join(APP_DIR, 'logs');
export const getBinDir = () => path.join(APP_DIR, 'bin');

// --- Config files ---

export const getConfigPath = () => path.join(getConfigDir(), 'config.yaml');
export const getServerJsonPath = () => path.join(getConfigDir(), 'server.json');
export const getAuthPath = () => path.join(getConfigDir(), 'auth.json');
export const getMcpConfigPath = () => path.join(getMcpDir(), 'mcp.json');
export const getCloudflaredBinPath = () =>
  path.join(getBinDir(), 'cloudflared');

// --- Per-agent paths ---

export function getAgentDir(agentId: string): string {
  return path.join(getAgentsDir(), agentId);
}

export function getAgentConfigPath(agentId: string): string {
  return path.join(getAgentDir(agentId), 'config.json');
}

export function getAgentSessionsDir(agentId: string): string {
  return path.join(getAgentDir(agentId), 'sessions');
}

export function getAgentSessionIndexPath(agentId: string): string {
  return path.join(getAgentSessionsDir(agentId), 'index.json');
}

export function getAgentAssetsDir(agentId: string): string {
  return path.join(getAgentDir(agentId), 'assets');
}

export function getAgentAssetsBodyDir(agentId: string): string {
  return path.join(getAgentAssetsDir(agentId), 'body');
}

export function getAgentAssetsBackgroundsDir(agentId: string): string {
  return path.join(getAgentAssetsDir(agentId), 'backgrounds');
}

export function getAgentMemoryDir(agentId: string): string {
  return path.join(getAgentDir(agentId), 'memory');
}
