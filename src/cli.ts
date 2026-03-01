import { Config } from './config.js';
import { Logger } from './util/logger.js';
import { AgentCore } from './agent.js';
import { runInteractiveUI } from './ui/index.js';
import { cleanupMcpConnections } from './tools/index.js';

export async function run(): Promise<void> {
  const workspaceDir = process.cwd();

  const configPath = Config.findConfigFile('config.yaml');
  if (!configPath) {
    throw new Error('Configuration file not found. Please run setup.');
  }
  const config = Config.fromYaml(configPath);

  if (config.logging.enableLogging) {
    Logger.initialize(undefined, 'agent');
  }

  Logger.log('STARTUP', 'Configuration loaded', {
    configPath,
    workspace: workspaceDir,
    model: config.llm.model,
    provider: config.llm.provider,
  });

  const agent = new AgentCore(config, workspaceDir);
  await agent.initialize();

  const onSigint = (): void => {
    void cleanupMcpConnections();
    process.exit(0);
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigint);

  try {
    await runInteractiveUI(agent);
  } finally {
    await cleanupMcpConnections();
  }
}
