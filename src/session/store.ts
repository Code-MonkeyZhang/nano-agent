import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Session, SessionMeta } from './types.js';

const SESSIONS_DIR_NAME = '.nano-agent';
const SESSIONS_SUBDIR = 'sessions';
const INDEX_FILE = 'sessions.json';

/**
 * Finds the project root directory by searching for package.json.
 * Starts from the current file and walks up the directory tree.
 *
 * @returns Absolute path to the project root directory
 */
function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return currentDir;
}

/**
 * 为Session提供CRUD文件操作的基础类
 */
export class SessionStore {
  private basePath: string; // session保存总目录
  private sessionsDir: string; //具体session文件夹目录
  private indexPath: string; // session metadata目录

  /**
   * Creates SessionStore instance.
   *
   * @param basePath - Optional custom base path. Defaults to {projectRoot}/.nano-agent
   */
  constructor(basePath?: string) {
    this.basePath = basePath ?? path.join(findProjectRoot(), SESSIONS_DIR_NAME);
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
