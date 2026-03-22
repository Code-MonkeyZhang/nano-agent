/**
 * @fileoverview Server entry point for nano-agent.
 *
 * Provides server lifecycle management:
 * - startServer: Initialize WebSocket and start HTTP server
 * - stopServer: Shutdown WebSocket and close HTTP server
 */

import { httpServer } from './http-server.js';
import { Logger } from '../util/logger.js';

const DEFAULT_PORT = 3000;

export function startServer(port: number = DEFAULT_PORT): void {
  httpServer.listen(port, () => {
    console.log(`Nano Agent Server running at http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Status: http://localhost:${port}/api/status`);
  });
}

export function stopServer(): void {
  httpServer.close(() => {
    Logger.log('SERVER', 'Server stopped');
  });
}

export { httpServer } from './http-server.js';
