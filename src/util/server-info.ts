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
 * Read the current server.json content, or return null if it doesn't exist.
 */
export function readServerInfo(): ServerInfo | null {
  const filePath = getServerJsonPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as ServerInfo;
}

/**
 * Write the tunnel URL into server.json so Desktop clients can discover it.
 */
export function updateTunnelUrl(url: string): void {
  const info = readServerInfo();
  if (!info) return;
  info.tunnelUrl = url;
  fs.writeFileSync(getServerJsonPath(), JSON.stringify(info, null, 2));
}

/**
 * Clear the tunnel URL from server.json.
 */
export function clearTunnelUrl(): void {
  const info = readServerInfo();
  if (!info) return;
  info.tunnelUrl = null;
  fs.writeFileSync(getServerJsonPath(), JSON.stringify(info, null, 2));
}

/**
 * Delete server.json file.
 */
export function deleteServerInfo(): void {
  const filePath = getServerJsonPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Setup exit handlers to clean up server.json on process termination.
 * Also stops the tunnel subprocess to prevent orphan processes.
 */
export function setupExitHandlers(): void {
  const cleanup = (): void => {
    Logger.log('SERVER', 'Server shutting down');
    void import('../server/tunnel-service.js')
      .then(({ stopTunnel }) => stopTunnel())
      .catch(() => {});
    deleteServerInfo();
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}
