/**
 * @fileoverview Session file storage operations.
 *
 * Storage structure:
 * {agentDir}/
 * ├── sessions/
 * │   ├── index.json          # Index file with all session metadata
 * │   └── {sessionId}.json    # Full session data with messages
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getAgentSessionsDir,
  getAgentSessionIndexPath,
} from '../util/paths.js';
import type { Session, SessionMeta } from './types.js';

export class SessionStore {
  private readonly sessionsDir: string;
  private readonly indexPath: string;

  constructor(agentId: string) {
    this.sessionsDir = getAgentSessionsDir(agentId);
    this.indexPath = getAgentSessionIndexPath(agentId);
    this.ensureDirs();
  }

  /** Ensure required directories exist */
  private ensureDirs(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /** Get the sessions directory path */
  getSessionsPath(): string {
    return this.sessionsDir;
  }

  /** Load the session index */
  loadIndex(): SessionMeta[] {
    if (!fs.existsSync(this.indexPath)) {
      return [];
    }
    const content = fs.readFileSync(this.indexPath, 'utf8');
    return JSON.parse(content) as SessionMeta[];
  }

  /** Save the session index */
  saveIndex(sessions: SessionMeta[]): void {
    this.writeJsonAtomic(this.indexPath, sessions);
  }

  /** Load a full session by ID */
  loadSession(id: string): Session | null {
    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }
    const content = fs.readFileSync(sessionPath, 'utf8');
    return JSON.parse(content) as Session;
  }

  /** Save a full session */
  saveSession(session: Session): void {
    const sessionPath = path.join(this.sessionsDir, `${session.id}.json`);
    this.writeJsonAtomic(sessionPath, session);
  }

  /** Delete a session file */
  deleteSessionFile(id: string): boolean {
    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      return true;
    }
    return false;
  }

  /** Atomic write to prevent data corruption */
  private writeJsonAtomic(filePath: string, data: unknown): void {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
  }
}
