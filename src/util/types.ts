/**
 * @fileoverview Type definitions for nano-agent server.
 */

/**
 * Server information stored in server.json for discovery.
 */
export interface ServerInfo {
  port: number;
  pid: number;
  url: string;
  tunnelUrl?: string | null;
}
