import { randomUUID } from 'node:crypto';
import { SessionStore } from './store.js';
import type { Session, SessionMeta } from './types.js';
import type { Message } from '../schema/index.js';

/**
 * Manages session CRUD operations with metadata tracking.
 *
 * Provides a high-level API for session management
 */
export class SessionManager {
  private store: SessionStore;

  /**
   * Creates a new SessionManager instance.
   *
   * @param store - Optional SessionStore instance. Creates a new one if not provided.
   */
  constructor(store?: SessionStore) {
    this.store = store ?? new SessionStore();
  }

  /**
   * Returns a list of all sessions (metadata only, no messages).
   * Sessions are sorted descending order by time.
   *
   * @returns Array of session metadata
   */
  listSessions(): SessionMeta[] {
    const sessions = this.store.loadIndex();
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Creates a new session.
   *
   * @param title - Session title (can be updated later after first message)
   * @returns The newly created session
   */
  createSession(title: string = 'New Session'): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      messages: [],
    };

    this.store.saveSession(session);
    this.addToIndex(session);

    return session;
  }

  /**
   * Retrieves a complete session including all messages.
   *
   * @param id - Session identifier
   * @returns Session object or null if not found
   */
  getSession(id: string): Session | null {
    return this.store.loadSession(id);
  }

  /**
   * Deletes a session completely (index entry + session file).
   *
   * @param id - Session identifier
   * @returns true if session was deleted
   */
  deleteSession(id: string): boolean {
    const session = this.store.loadSession(id);
    if (!session) {
      return false;
    }

    this.store.deleteSessionFile(id);
    this.removeFromIndex(id);

    return true;
  }

  /**
   * Appends a message to a session and updates metadata.
   *
   * @param id - Session identifier
   * @param message - Message to append
   * @returns Updated session or null if session not found
   */
  appendMessage(id: string, message: Message): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    session.messages.push(message);
    session.messageCount = session.messages.length;
    session.updatedAt = Date.now();

    this.store.saveSession(session);
    this.updateIndexEntry(session);

    return session;
  }

  /**
   * Updates the session title.
   * Typically called after the first user message to set a meaningful title.
   *
   * @param id - Session identifier
   * @param title - New title
   * @returns Updated session or null if session not found
   */
  updateTitle(id: string, title: string): Session | null {
    // 从文件读取原session
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    // 修改内存中的会话对象
    session.title = title;
    session.updatedAt = Date.now();

    // 重新保存session (覆盖原文件)
    this.store.saveSession(session);

    // 更新索引中session的标题和时间
    this.updateIndexEntry(session);

    return session;
  }

  /**
   * Adds a new session entry to the index.
   */
  private addToIndex(session: Session): void {
    const index = this.store.loadIndex();
    index.push(this.sessionToMeta(session));
    this.store.saveIndex(index);
  }

  /**
   * Removes session entry from the index.
   */
  private removeFromIndex(id: string): void {
    const index = this.store.loadIndex();
    const filtered = index.filter((s) => s.id !== id);
    this.store.saveIndex(filtered);
  }

  /**
   * Updates an existing session entry in the index.
   */
  private updateIndexEntry(session: Session): void {
    const index = this.store.loadIndex();
    const idx = index.findIndex((s) => s.id === session.id);

    if (idx !== -1) {
      index[idx] = this.sessionToMeta(session);
      this.store.saveIndex(index);
    }
  }

  /**
   * Extracts metadata from a full session object.
   */
  private sessionToMeta(session: Session): SessionMeta {
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
    };
  }
}
