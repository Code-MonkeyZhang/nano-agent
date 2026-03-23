/**
 * @fileoverview Server startup entry point.
 *
 * Initialization sequence:
 * 1. Create required directories and config files
 * 2. Initialize logging system
 * 3. Initialize auth pool
 * 4. Start HTTP server
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
} from './util/paths.js';
import { getDefaultConfigYaml } from './config/index.js';
import { startServer } from './server/index.js';
import { Logger } from './util/logger.js';
import { initAuthPool } from './auth/index.js';

// Required directories to create
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

// Required files to create with default content
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
 *
 * This function is idempotent: existing directories won't be recreated,
 * existing config files won't be overwritten. This preserves user
 * modifications while allowing recovery from accidentally deleted files.
 */
function initAllDirsAndFiles(): void {
  // Create required directories
  for (const getDir of REQUIRED_DIRS) {
    const dir = getDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create required files with default content
  for (const file of REQUIRED_FILES) {
    const filePath = file.getPath();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.getContent());
    }
  }
}

// Application startup sequence
initAllDirsAndFiles();
Logger.initialize(getLogsDir(), false);
initAuthPool(getAuthPath());
startServer(3000);

console.log('Nano Agent initialized');
