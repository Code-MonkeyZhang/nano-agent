/* eslint-disable no-console */
import * as net from 'node:net';
import * as fs from 'node:fs';
import { httpServer, setupOpenAIRoutes } from './http-server.js';
import { initWebSocket, shutdownWebSocket } from './websocket-server.js';
import { startTunnel, stopTunnel } from './tunnel.service.js';
import { Config } from '../config.js';

// ============ Utilities ============

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '0.0.0.0', () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : null;
      server.close(() => resolve(port ?? 3847));
    });
  });
}

// ============ Configuration ============

const configPath = Config.findConfigFile('config.yaml');
const config = Config.fromYaml(configPath!);

// ============ Initialization ============

/**
 * Initialize and start the Nano Agent server
 * @param enableTunnel - Whether to enable Cloudflare tunnel (default: true)
 * @returns {Promise<void>} Resolves when the server is started
 */
export async function startServer(enableTunnel = true): Promise<void> {
  const workspaceDir = process.cwd();

  // Ensure workspace directory exists
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  // Determine port: try config first, fallback to auto
  let port: number;
  const configPort = config.openaiHttpServer?.port;

  if (configPort && (await isPortAvailable(configPort))) {
    port = configPort;
  } else {
    if (configPort) {
      console.log(`Port ${configPort} is in use, selecting available port...`);
    }
    port = await getAvailablePort();
  }

  await setupOpenAIRoutes(config, workspaceDir);

  // Initialize WebSocket server
  initWebSocket();

  // Start HTTP server
  httpServer.listen(port, '0.0.0.0', () => {
    if (enableTunnel) {
      startTunnel(port)
        .then((url) => {
          printUrls(url, port);
        })
        .catch((error) => {
          console.warn('Tunnel failed to start:', error);
          printUrls(null, port);
        });
    } else {
      printUrls(null, port);
    }
  });
}

function printUrls(tunnelUrl: string | null, port: number): void {
  console.log('🟢 Server is running');

  console.log('\n📍 Local URLs:');
  console.log(`   HTTP: http://0.0.0.0:${port}/api/status`);
  console.log(`   WS:   ws://0.0.0.0:${port}/ws`);
  console.log(`   API:  http://0.0.0.0:${port}/v1/chat/completions`);
  console.log(`   Full API URL: http://0.0.0.0:${port}/v1`);

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
export async function cleanup(): Promise<void> {
  console.log('Shutting down Nano Agent Server...');

  await stopTunnel();
  shutdownWebSocket();

  process.exit(0);
}
