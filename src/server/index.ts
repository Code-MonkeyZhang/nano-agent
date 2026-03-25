/**
 * @fileoverview Server entry point for nano-agent.
 */

import { httpServer } from './http-server.js';

/**
 * Start the HTTP server and wait for it to be ready.
 * @param port - Port to listen on
 */
export function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, () => {
      console.log(`Nano Agent Server running at http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Status: http://localhost:${port}/api/status`);
      resolve();
    });
  });
}
