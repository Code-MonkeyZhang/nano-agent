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

// 需要创建的文件以及文件目录
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
 * 初始化所有必需的目录和配置文件。
 *
 * 此函数具有幂等性：已存在的目录不会重复创建，已存在的配置文件不会被覆盖。
 * 这样可以保证用户修改过的配置不会被重置，同时也能在配置文件被误删后自动恢复。
 */
function initAllDirsAndFiles(): void {
  // 遍历需要的文件夹, 开始创建
  for (const getDir of REQUIRED_DIRS) {
    const dir = getDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  //遍历需要的文件 然后创建
  for (const file of REQUIRED_FILES) {
    const filePath = file.getPath();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.getContent());
    }
  }
}

initAllDirsAndFiles();
Logger.initialize(getLogsDir(), false);
startServer(3000);

console.log('Nano Agent initialized');
