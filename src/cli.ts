/**
 * Nano-Agent CLI 入口文件
 */

import { Config } from './config.js';
import { Logger } from './util/logger.js';
import { runInteractiveUI } from './ui/index.js';
import { cleanupMcpConnections } from './tools/index.js';

/**
 * CLI 主入口函数
 * 程序启动的入口点
 */
export async function run(): Promise<void> {
  // 使用当前工作目录
  const workspaceDir = process.cwd();

  // 查找 config.yaml 配置文件
  const configPath = Config.findConfigFile('config.yaml');
  if (!configPath) {
    throw new Error('Configuration file not found. Please run setup.');
  }
  const config = Config.fromYaml(configPath);

  // 启动日志
  if (config.logging.enableLogging) {
    Logger.initialize(undefined, 'agent');
  }

  // 记录启动日志
  Logger.log('STARTUP', 'Configuration loaded', {
    configPath,
    workspace: workspaceDir,
    model: config.llm.model,
    provider: config.llm.provider,
  });

  const onSigint = (): void => {
    void cleanupMcpConnections();
    process.exit(0);
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigint);

  try {
    await runInteractiveUI(config, workspaceDir);
  } finally {
    // 程序结束时确保 MCP 连接被正确关闭
    await cleanupMcpConnections();
  }
}
