/**
 * @fileoverview Server info management for discovery and cleanup.
 */

import * as fs from 'node:fs';
import { getServerJsonPath } from './paths.js';
import type { ServerInfo } from './types.js';
import { Logger } from './logger.js';

/**
 * Write server info to server.json for discovery by frontend clients.
 */
export function writeServerInfo(port: number): void {
  const info: ServerInfo = {
    port,
    pid: process.pid,
    url: `http://localhost:${port}`,
  };
  fs.writeFileSync(getServerJsonPath(), JSON.stringify(info, null, 2));
}

/**
 * Delete server.json file.
 */
export function deleteServerInfo(): void {
  const path = getServerJsonPath();
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

/**
 * Setup exit handlers to clean up server.json on process termination.
 */
export function setupExitHandlers(): void {
  const cleanup = (): void => {
    Logger.log('SERVER', 'Server shutting down');
    deleteServerInfo();
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}
