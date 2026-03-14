import * as path from 'node:path';
import * as fs from 'node:fs';
import type { Session, SessionMeta } from './types.js';

const SESSIONS_SUBDIR = 'sessions';
const INDEX_FILE = 'sessions.json';

/**
 * 为Session提供CRUD文件操作的基础类
 *
 * 目录结构：
 * {basePath}/
 * ├── sessions.json    # 索引文件
 * └── sessions/        # session 文件目录
 */
export class SessionStore {
  private basePath: string;
  private sessionsDir: string;
  private indexPath: string;

  /**
   * Creates SessionStore instance.
   *
   * @param basePath - Base directory for this store (e.g., data/agents/adam)
   */
  constructor(basePath: string) {
    if (!basePath) {
      throw new Error('basePath is required');
    }
    this.basePath = basePath;
    this.sessionsDir = path.join(this.basePath, SESSIONS_SUBDIR);
    this.indexPath = path.join(this.basePath, INDEX_FILE);
  }

  /**
   * Ensures the base and sessions directories exist.
   * And creates them recursively if needed.
   */
  private ensureDirExists(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Loads the session index from disk.
   *
   * @returns Array of session metadata. Returns empty array if file doesn't exist or is invalid.
   */
  loadIndex(): SessionMeta[] {
    if (!fs.existsSync(this.indexPath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      return JSON.parse(content) as SessionMeta[];
    } catch {
      return [];
    }
  }

  /**
   * Saves the session index to disk.
   * Uses atomic write to prevent corruption.
   *
   * @param sessions - Array of session metadata to save
   */
  saveIndex(sessions: SessionMeta[]): void {
    this.ensureDirExists();
    this.writeJsonAtomic(this.indexPath, sessions);
  }

  /**
   * Loads a specific session from disk.
   *
   * @param id - Session identifier
   * @returns Session object with messages, or null if not found or invalid
   */
  loadSession(id: string): Session | null {
    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8');
      return JSON.parse(content) as Session;
    } catch {
      return null;
    }
  }

  /**
   * Saves a session to disk.
   * Uses atomic write to prevent corruption.
   *
   * @param session - Complete session object including messages
   */
  saveSession(session: Session): void {
    this.ensureDirExists();
    const sessionPath = path.join(this.sessionsDir, `${session.id}.json`);
    this.writeJsonAtomic(sessionPath, session);
  }

  /**
   * Returns the sessions directory path.
   *
   * @returns Absolute path to the sessions directory
   */
  getSessionsPath(): string {
    return this.sessionsDir;
  }

  /**
   * Deletes a session file from disk.
   *
   * @param id - Session identifier
   * @returns true if file was deleted, false if it didn't exist
   */
  deleteSessionFile(id: string): boolean {
    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      return true;
    }
    return false;
  }

  /**
   * Writes JSON atomically using temp file + rename,
   * preventing data corruption if write is interrupted.
   *
   * @param filePath - Target file path
   * @param data - Data to serialize as JSON
   */
  private writeJsonAtomic(filePath: string, data: unknown): void {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }
}
