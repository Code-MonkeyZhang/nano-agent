/**
 * @fileoverview Server entry point for nano-agent.
 */

import { httpServer } from './http-server.js';

const DEFAULT_PORT = 3000;

export function startServer(port: number = DEFAULT_PORT): void {
  httpServer.listen(port, () => {
    console.log(`Nano Agent Server running at http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Status: http://localhost:${port}/api/status`);
  });
}
