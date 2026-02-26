/* eslint-disable no-console */
import { Config } from './config.js';
import { Logger } from './util/logger.js';
import { AgentCore } from './agent.js';
import { runInteractiveUI } from './ui/index.js';
import { cleanupMcpConnections } from './tools/index.js';
import { startServer, cleanup as cleanupServer } from './server/index.js';

async function runAgent(): Promise<void> {
  const workspaceDir = process.cwd();

  const configPath = Config.findConfigFile('config.yaml');
  if (!configPath) {
    console.error('❌ Configuration file not found. Please run setup.');
    process.exit(1);
  }
  const config = Config.fromYaml(configPath);
  console.log(`Config loaded from: ${configPath}`);
  console.log(`Workspace: ${workspaceDir}`);

  if (config.logging.enableLogging) {
    Logger.initialize(undefined, 'agent');
  }

  console.log(`Model: ${config.llm.model}`);
  console.log(`Provider: ${config.llm.provider}`);
  console.log('Starting Ink UI...');

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

async function runServer(enableTunnel: boolean): Promise<void> {
  const onSigint = async (): Promise<void> => {
    await cleanupServer();
  };

  process.once('SIGINT', () => {
    void onSigint();
  });
  process.once('SIGTERM', () => {
    void cleanupServer();
  });

  try {
    await startServer(enableTunnel);
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

export async function run(
  mode: 'interactive' | 'server',
  enableTunnel = true
): Promise<void> {
  if (mode === 'server') {
    await runServer(enableTunnel);
  } else {
    await runAgent();
  }
}
