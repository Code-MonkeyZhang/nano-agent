/**
 * @fileoverview Logger utility for nano-agent.
 *
 * Provides file-based logging with category, message, and optional data support.
 * Automatically enriches logs with human-readable names when agentId/sessionId
 * are present in the data object.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { format } from 'date-fns';
import type { SessionManager } from '../session/session-manager.js';
import { getAgentConfig } from '../agent/agent-config-store.js';

type SessionManagersMap = Map<string, SessionManager>;

interface LogData {
  agentId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Static logger class for writing logs to file.
 */
export class Logger {
  private static logFile: string | null = null;
  private static enabled = false;
  private static sessionManagers: SessionManagersMap | null = null;

  /**
   * Initialize the logger.
   * @param logDir - Log directory path (caller ensures it exists)
   * @param enabled - Whether logging is enabled (default: false)
   * @returns The path to the created log file
   */
  static initialize(logDir: string, enabled?: boolean): string {
    this.enabled = enabled ?? false;
    const now = new Date();
    const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
    this.logFile = path.join(logDir, `agent-${timestamp}.log`);

    return this.logFile;
  }

  /**
   * Enable or disable logging at runtime.
   * @param enabled - Whether logging should be enabled
   */
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Inject session managers reference for name lookup.
   * Called after sessionManagers are initialized in http-server.ts.
   * @param sessionManagers - Map of agentId to SessionManager
   */
  static setSessionManagers(sessionManagers: SessionManagersMap): void {
    this.sessionManagers = sessionManagers;
  }

  /**
   * Write a log entry to the log file.
   * @param category - Log category (e.g., 'HTTP', 'SERVER', 'LLM')
   * @param message - Log message
   * @param data - Optional additional data to log. If contains agentId or sessionId,
   *               will auto-enrich with agent name and session title.
   */
  static log(category: string, message: string, data?: unknown): void {
    if (!this.enabled) return;

    const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    const enrichedData = this.enrichData(data);

    let formattedData = '';
    if (enrichedData !== undefined && enrichedData !== null) {
      if (typeof enrichedData === 'string') {
        formattedData = `\n${enrichedData
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}`;
      } else {
        formattedData = `\n${JSON.stringify(enrichedData, null, 2)}`;
      }
    }

    const fileEntry = `[${timestamp}] [${category}] ${message}${formattedData}\n`;

    if (this.logFile) {
      fs.appendFileSync(this.logFile, fileEntry);
    }
  }

  /**
   * Enrich log data with human-readable names for agentId and sessionId.
   * @param data - Original log data
   * @returns Enriched data with agentName and sessionTitle fields added
   */
  private static enrichData(data: unknown): unknown {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return data;
    }

    const logData = data as LogData;
    const result: Record<string, unknown> = { ...logData };

    if (logData.agentId) {
      const agentConfig = getAgentConfig(logData.agentId);
      result['agentId'] = logData.agentId;
      if (agentConfig?.name) {
        result['agentName'] = agentConfig.name;
      }
    }

    if (logData.sessionId && this.sessionManagers) {
      result['sessionId'] = logData.sessionId;
      for (const sessionManager of this.sessionManagers.values()) {
        const session = sessionManager.getSession(logData.sessionId);
        if (session?.title) {
          result['sessionTitle'] = session.title;
          break;
        }
      }
    }

    return result;
  }
}
