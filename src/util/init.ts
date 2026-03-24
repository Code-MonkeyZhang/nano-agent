/**
 * @fileoverview Application initialization utilities.
 * Creates required directories and config files on first run.
 *
 * Initialized Folder Structure (~/.nano-agent/):
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

import * as fs from 'node:fs';
import {
  getAgentsDir,
  getConfigDir,
  getConfigPath,
  getAuthPath,
  getDataDir,
  getLogsDir,
  getMcpConfigPath,
  getMcpDir,
  getMcpServersDir,
  getSkillsDir,
  getWorkspaceDir,
} from './paths.js';
import { getDefaultConfigYaml } from '../config/index.js';

const REQUIRED_DIRS = [
  getConfigDir,
  getDataDir,
  getAgentsDir,
  getWorkspaceDir,
  getLogsDir,
  getSkillsDir,
  getMcpDir,
  getMcpServersDir,
];

const REQUIRED_FILES: Array<{
  getPath: () => string;
  getContent: () => string;
}> = [
  { getPath: getConfigPath, getContent: getDefaultConfigYaml },
  { getPath: getAuthPath, getContent: () => '{}\n' },
  { getPath: getMcpConfigPath, getContent: () => '{\n  "mcpServers": {}\n}\n' },
];

/**
 * Initialize all required directories and config files.
 * Idempotent: existing items won't be overwritten.
 */
export function initAllDirsAndFiles(): void {
  for (const getDir of REQUIRED_DIRS) {
    const dir = getDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  for (const file of REQUIRED_FILES) {
    const filePath = file.getPath();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.getContent());
    }
  }
}
