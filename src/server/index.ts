import { httpServer } from './http-server.js';
import { initWebSocket, shutdownWebSocket } from './websocket-server.js';
import {
  startTunnel,
  stopTunnel,
  onTunnelStatusChange,
} from './tunnel.service.js';

const PORT = parseInt(process.env['PORT'] || '3847', 10);

/**
 * Print local connection URLs for SwiftChat
 */
function printLocalUrls(): void {
  console.log('📱 Local URLs for SwiftChat:');
  console.log(`   HTTP:  http://0.0.0.0:${PORT}/api/status`);
  console.log(`   WS:   ws://0.0.0.0:${PORT}/ws`);
  console.log();
}

// Initialize WebSocket server
initWebSocket();

// Start HTTP server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Server listening on port ${PORT}`);
  console.log(`[HTTP] Status endpoint: http://0.0.0.0:${PORT}/api/status`);
  console.log(`[HTTP] WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
  console.log();
});

// Subscribe to tunnel status changes
onTunnelStatusChange((tunnelStatus) => {
  if (tunnelStatus.url) {
    console.log(`[Tunnel] Public URL: ${tunnelStatus.url}`);
    console.log(
      `[Tunnel] WebSocket URL: ${tunnelStatus.url.replace('https://', 'wss://').replace('http://', 'ws://')}/ws`
    );
  }
  if (tunnelStatus.error) {
    console.log(`[Tunnel] Error: ${tunnelStatus.error}`);
  }
});

// Start Cloudflare Tunnel automatically
console.log('[Tunnel] Starting Cloudflare Tunnel...');
startTunnel(PORT)
  .then((url) => {
    console.log();
    printLocalUrls();
    console.log('🌐 Public URLs (via Cloudflare Tunnel):');
    console.log(`   HTTP:  ${url}/api/status`);
    console.log(
      `   WS:   ${url.replace('https://', 'wss://').replace('http://', 'ws://')}/ws`
    );
    console.log();
    console.log('💡 Use the public URL to connect from SwiftChat');
    console.log();
  })
  .catch((error) => {
    console.error('[Tunnel] Failed to start:', error);
    printLocalUrls();
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
