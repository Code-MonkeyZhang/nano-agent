/**
 * @fileoverview Server startup entry point.
 */

import { initAllDirsAndFiles, Logger } from './util/index.js';
import { getLogsDir, getConfigPath } from './util/paths.js';
import { loadConfig } from './config/index.js';
import { startServer } from './server/index.js';
import { writeServerInfo, setupExitHandlers } from './util/server-info.js';

/**
 * 主函数：初始化配置、启动服务器
 */
async function main(): Promise<void> {
  // 从命令行参数获取端口号
  const portStr = process.argv[2];
  if (!portStr) {
    throw new Error('Port argument is required');
  }
  const port = parseInt(portStr, 10);

  initAllDirsAndFiles();
  const config = loadConfig(getConfigPath());
  Logger.initialize(getLogsDir(), config.enableLogging);

  // 启动服务器
  await startServer(port);
  writeServerInfo(port);
  setupExitHandlers();
}

// 捕获主函数中的错误并优雅退出
main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
