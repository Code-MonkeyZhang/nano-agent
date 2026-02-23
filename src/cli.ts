/* eslint-disable no-console */
import { createInterface } from 'node:readline/promises';
import { Config } from './config.js';
import { Logger } from './util/logger.js';
import { AgentCore } from './agent.js';
import { renderConsoleEvents } from './ui/console.js';
import { cleanupMcpConnections } from './tools/index.js';
import { startServer, cleanup as cleanupServer } from './server/index.js';

function printBanner(): void {
  const BOX_WIDTH = 58;
  const bannerText = '🤖 Nano Agent - Personal LLM Agent';

  const bannerWidth = bannerText.length;
  const totalPadding = BOX_WIDTH - bannerWidth;
  const leftPaddingCount = Math.floor(totalPadding / 2);
  const rightPaddingCount = totalPadding - leftPaddingCount;

  const leftPadding = ' '.repeat(Math.max(0, leftPaddingCount));
  const rightPadding = ' '.repeat(Math.max(0, rightPaddingCount));
  const horizontalLine = '═'.repeat(BOX_WIDTH);

  console.log();
  console.log(`╔${horizontalLine}╗`);
  console.log(`║${leftPadding}${bannerText}${rightPadding}║`);
  console.log(`╚${horizontalLine}╝`);
  console.log();
}

// ============ Main Startup Logic ============

/**
 * Initializes and runs the interactive agent session.
 *
 * The interactive loop handles user input, executes the agent, and
 * handles errors. Cleanup is performed on exit.
 *
 * @returns {Promise<void>} Resolves when the user exits the session (via 'exit', 'quit', 'q', or SIGINT)
 */
async function runAgent(): Promise<void> {
  const workspaceDir = process.cwd();

  // Load Config
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

  printBanner();
  console.log(`Model: ${config.llm.model}`);
  console.log(`Provider: ${config.llm.provider}`);
  console.log(`Base URL: ${config.llm.apiBase}`);
  console.log(`Type 'exit' to quit\n`);

  // Initialize AgentCore
  const agent = new AgentCore(config, workspaceDir);
  await agent.initialize();

  const readlineInterface = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 1000,
    removeHistoryDuplicates: true,
  });

  let interrupted = false;
  const onSigint = (): void => {
    interrupted = true;
    readlineInterface.close();
  };
  process.once('SIGINT', onSigint);

  try {
    while (true) {
      // Receive user Input
      let userRawInput: string;
      try {
        userRawInput = await readlineInterface.question('You > ');
      } catch (error) {
        if (interrupted) break;
        throw error;
      }
      const userInput = userRawInput.trim();
      if (!userInput) continue;
      if (userInput === 'exit' || userInput === 'quit' || userInput === 'q')
        break;

      // Append UserInput to AgentMessage
      agent.addUserMessage(userInput);

      try {
        await renderConsoleEvents(agent.runStream());
      } catch (error) {
        if (error instanceof Error) {
          console.log(`\n❌ Error: ${error.message}`);
          console.log('   Please check your API key and configuration.\n');
        } else {
          console.log(`\n❌ Unexpected error: ${String(error)}`);
        }

        // abort unused user message
        agent.messages.pop();
        continue;
      }

      console.log(`\n${'─'.repeat(60)}\n`);
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    readlineInterface.close();
    await cleanupMcpConnections();
  }
}

/**
 * Runs the Nano Agent server mode.
 *
 * The server mode starts an HTTP/WebSocket server that provides
 * an OpenAI-compatible API for the agent.
 *
 * @param {boolean} enableTunnel - Whether to enable Cloudflare tunnel for public access
 * @returns {Promise<void>} Resolves when the server is shut down
 */
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
