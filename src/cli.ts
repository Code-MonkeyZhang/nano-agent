/* eslint-disable no-console */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Config } from './config.js';
import { Logger } from './util/logger.js';
import { AgentCore } from './agent.js';
import { renderConsoleEvents } from './ui/console.js';
import { cleanupMcpConnections } from './tools/index.js';

// ============ Utilities ============

function getProjectVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.resolve(here, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printBanner(): void {
  const BOX_WIDTH = 58;
  const bannerText = '🤖 Nano Agent - Multi-turn Interactive Session';

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

function parseArgs(): { workspace: string | undefined } {
  const program = new Command();

  program
    .description('Nano Agent - AI assistant with file tools and MCP support')
    .version(getProjectVersion(), '-v, --version')
    .addHelpText(
      'after',
      `
Examples:
  nano-agent                              # Use current directory as workspace
  nano-agent --workspace /path/to/dir     # Use specific workspace directory
      `
    );

  program.option(
    '-w, --workspace <dir>',
    'Workspace directory (default: current directory)'
  );

  program.parse(process.argv);
  const options = program.opts();

  return {
    workspace: options['workspace'] as string | undefined,
  };
}

function resolveWorkspace(args: { workspace: string | undefined }): string {
  let workspaceDir: string;

  if (args.workspace) {
    workspaceDir = path.resolve(args.workspace);
  } else {
    workspaceDir = process.cwd();
  }

  // Ensure the workspace directory exists
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  return workspaceDir;
}

// ============ Main Startup Logic ============

/**
 * Initializes and runs the interactive agent session.
 *
 * The interactive loop handles user input, executes the agent, and
 * handles errors. Cleanup is performed on exit.
 *
 * @param {string} workspaceDir - The absolute path to the workspace directory for the session
 * @returns {Promise<void>} Resolves when the user exits the session (via 'exit', 'quit', 'q', or SIGINT)
 */
async function runAgent(workspaceDir: string): Promise<void> {
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
    Logger.initialize();
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

export async function run(): Promise<void> {
  const args = parseArgs();

  let workspaceDir: string;
  try {
    workspaceDir = resolveWorkspace(args);
  } catch (error) {
    console.error(`❌ Error creating workspace directory: ${error}`);
    process.exit(1);
  }

  await runAgent(workspaceDir);
}
