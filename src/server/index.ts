/* eslint-disable no-console */
import * as fs from 'node:fs';
import { httpServer, setupOpenAIRoutes } from './http-server.js';
import { initWebSocket, shutdownWebSocket } from './websocket-server.js';
import { startTunnel, stopTunnel } from './tunnel.service.js';
import { Config } from '../config.js';

// ============ Configuration ============

// Load configuration
const configPath = Config.findConfigFile('config.yaml');
const config = Config.fromYaml(configPath!);

// Determine Port
const PORT =
  config.openaiHttpServer?.port || parseInt(process.env['PORT'] || '3847', 10);

// ============ Initialization ============

function resolveWorkspace(): string {
  const workspaceDir = process.cwd();

  // Ensure workspace directory exists
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  return workspaceDir;
}

async function initServer() {
  const workspaceDir = resolveWorkspace();
  await setupOpenAIRoutes(config, workspaceDir);

  // Initialize WebSocket server
  initWebSocket();

  // Start HTTP server
  httpServer.listen(PORT, '0.0.0.0', () => {
    if (process.env['NO_TUNNEL']) {
      console.log('[Tunnel] Skipped (NO_TUNNEL env var set)');
      printUrls(null);
      return;
    }

    startTunnel(PORT)
      .then((url) => {
        printUrls(url);
      })
      .catch((error) => {
        console.warn('Tunnel failed to start:', error);
        printUrls(null);
      });
  });
}

void initServer();

function printUrls(tunnelUrl: string | null): void {
  console.log('🟢 Server is running');

  console.log('\n📍 Local URLs:');
  console.log(`   HTTP: http://0.0.0.0:${PORT}/api/status`);
  console.log(`   WS:   ws://0.0.0.0:${PORT}/ws`);
  console.log(`   API:  http://0.0.0.0:${PORT}/v1/chat/completions`);
  console.log(`   Full API URL: http://0.0.0.0:${PORT}/v1`);

  if (tunnelUrl) {
    console.log('\n🌐 Public URLs:');
    console.log(`   HTTP: ${tunnelUrl}/api/status`);
    console.log(
      `   WS:   ${tunnelUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')}/ws`
    );
    console.log(`   API: ${tunnelUrl}/v1/chat/completions`);
    console.log(`   Full API URL: ${tunnelUrl}/v1`);
  }

  console.log();
}

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
