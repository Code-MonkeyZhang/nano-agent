/**
 * @fileoverview Logger utility for nano-agent.
 *
 * Provides file-based logging with category, message, and optional data support.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { format } from 'date-fns';

/**
 * Static logger class for writing logs to file.
 */
export class Logger {
  private static logFile: string | null = null;
  private static enabled = false;

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
   * Write a log entry to the log file.
   * @param category - Log category (e.g., 'HTTP', 'SERVER', 'LLM')
   * @param message - Log message
   * @param data - Optional additional data to log
   */
  static log(category: string, message: string, data?: unknown) {
    if (!this.enabled) return;

    const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    let formattedData = '';
    if (data !== undefined && data !== null) {
      if (typeof data === 'string') {
        formattedData = `\n${data
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}`;
      } else {
        formattedData = JSON.stringify(data, null, 2);
      }
    }

    const fileEntry = `[${timestamp}] [${category}] ${message}${formattedData}\n`;

    if (this.logFile) {
      fs.appendFileSync(this.logFile, fileEntry);
    }
  }
}
