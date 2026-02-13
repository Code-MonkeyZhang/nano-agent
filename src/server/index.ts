import * as fs from 'node:fs';
import * as path from 'node:path';

import { httpServer, setupOpenAIRoutes } from './http-server.js';
import { initWebSocket, shutdownWebSocket } from './websocket-server.js';
import { startTunnel, stopTunnel } from './tunnel.service.js';
import { Config } from '../config.js';
import { LLMClient } from '../llm-client/llm-client.js';

// ============ Configuration ============

// Load configuration with priority: CWD > Home > Package Root
const configPath = Config.findConfigFile('config.yaml');
const config = configPath ? Config.fromYaml(configPath) : null;

// Determine Port: Config > Environment > Default (3847)
const PORT =
  config?.openaiHttpServer?.port || parseInt(process.env['PORT'] || '3847', 10);

// ============ Initialization ============

if (config) {
  // Initialize LLM Client
  const llmClient = new LLMClient(
    config.llm.apiKey,
    config.llm.apiBase,
    config.llm.provider,
    config.llm.model,
    config.llm.retry
  );

  // Load and Build System Prompt
  const promptPath = configPath
    ? path.join(path.dirname(configPath), config.agent.systemPromptPath)
    : 'system_prompt.md';

  let systemPrompt = 'You are a helpful AI assistant.';
  try {
    const rawSystemPrompt = fs.readFileSync(promptPath, 'utf8');
    systemPrompt = rawSystemPrompt.includes('Current Workspace')
      ? rawSystemPrompt
      : `${rawSystemPrompt}

## Current Workspace
You are currently working in: \`${process.cwd()}\`
All relative paths will be resolved relative to this directory.`;
  } catch (error) {
    console.warn(
      `[Config] Failed to load system prompt from ${promptPath}:`,
      error
    );
  }

  // Setup OpenAI Routes if enabled
  if (config.openaiHttpServer?.enabled) {
    setupOpenAIRoutes(llmClient, systemPrompt);
  }
} else {
  console.warn(
    'No configuration file found. OpenAI routes will not be enabled.'
  );
}

function printUrls(tunnelUrl: string | null): void {
  console.log('🟢 Server is running');

  console.log('\n📍 Local URLs:');
  console.log(`   HTTP: http://0.0.0.0:${PORT}/api/status`);
  console.log(`   WS:   ws://0.0.0.0:${PORT}/ws`);
  if (config?.openaiHttpServer?.enabled) {
    console.log(`   API:  http://0.0.0.0:${PORT}/v1/chat/completions`);
    console.log(`   Full API URL: http://0.0.0.0:${PORT}/v1`);
  }

  if (tunnelUrl) {
    console.log('\n🌐 Public URLs:');
    console.log(`   HTTP: ${tunnelUrl}/api/status`);
    console.log(
      `   WS:   ${tunnelUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')}/ws`
    );
    if (config?.openaiHttpServer?.enabled) {
      console.log(`   API: ${tunnelUrl}/v1/chat/completions`);
      console.log(`   Full API URL: ${tunnelUrl}/v1`);
    }
  }

  console.log();
}

// Initialize WebSocket server
initWebSocket();

// Start HTTP server
httpServer.listen(PORT, '0.0.0.0', () => {
  if (process.env['NO_TUNNEL']) {
    console.log('[Tunnel] Skipped (NO_TUNNEL env var set)');
    printUrls(null);
    return;
  }

  // Start Cloudflare Tunnel automatically
  startTunnel(PORT)
    .then((url) => {
      printUrls(url);
    })
    .catch((error) => {
      console.warn('Tunnel failed to start:', error);
      printUrls(null);
    });
});

/**
 * Graceful shutdown handler
 * Stops the tunnel and WebSocket server before exiting
 */
const cleanup = async () => {
  console.log('Shutting down Nano Agent Server...');

  await stopTunnel();
  shutdownWebSocket();

  process.exit(0);
};

process.on('SIGINT', () => {
  void cleanup();
});
process.on('SIGTERM', () => {
  void cleanup();
});
