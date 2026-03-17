import { randomUUID } from 'node:crypto';
import { SessionStore } from './store.js';
import type { Session, SessionMeta, CreateSessionOptions } from './types.js';
import type { Message } from '../schema/index.js';

/**
 * Manages session CRUD operations with metadata tracking.
 *
 * Each SessionManager instance is bound to a specific agent's SessionStore.
 * The agentId is stored in each session but is determined by which store is used.
 */
export class SessionManager {
  private store: SessionStore;
  private agentId: string;

  /**
   * Creates a SessionManager instance.
   *
   * @param store - The SessionStore instance to use (determines the agent)
   * @param agentId - The agent ID this manager belongs to
   */
  constructor(store: SessionStore, agentId: string) {
    this.store = store;
    this.agentId = agentId;
  }

  /**
   * Returns a list of all sessions (metadata only, no messages).
   * Sessions are sorted by updatedAt in descending order.
   */
  listSessions(): SessionMeta[] {
    const sessions = this.store.loadIndex();
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Creates a new session for this agent.
   *
   * @param options - Optional creation options (title, workspacePath, modelId)
   * @returns The newly created session
   */
  createSession(options?: CreateSessionOptions): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      agentId: this.agentId,
      title: options?.title ?? 'New Session',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      messages: [],
      workspacePath: options?.workspacePath,
      modelId: options?.modelId,
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
   *
   * @param id - Session identifier
   * @param title - New title
   * @returns Updated session or null if session not found
   */
  updateTitle(id: string, title: string): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    session.title = title;
    session.updatedAt = Date.now();

    this.store.saveSession(session);
    this.updateIndexEntry(session);

    return session;
  }

  /**
   * Updates the session's workspace path.
   *
   * @param id - Session identifier
   * @param workspacePath - New workspace path
   * @returns Updated session or null if session not found
   */
  updateWorkspacePath(id: string, workspacePath: string): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    session.workspacePath = workspacePath;
    session.updatedAt = Date.now();

    this.store.saveSession(session);
    this.updateIndexEntry(session);

    return session;
  }

  updateModelId(id: string, modelId: string | undefined): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    session.modelId = modelId;
    session.updatedAt = Date.now();

    this.store.saveSession(session);
    this.updateIndexEntry(session);

    return session;
  }

  private addToIndex(session: Session): void {
    const index = this.store.loadIndex();
    index.push(this.sessionToMeta(session));
    this.store.saveIndex(index);
  }

  private removeFromIndex(id: string): void {
    const index = this.store.loadIndex();
    const filtered = index.filter((s) => s.id !== id);
    this.store.saveIndex(filtered);
  }

  private updateIndexEntry(session: Session): void {
    const index = this.store.loadIndex();
    const idx = index.findIndex((s) => s.id === session.id);

    if (idx !== -1) {
      index[idx] = this.sessionToMeta(session);
      this.store.saveIndex(index);
    }
  }

  private sessionToMeta(session: Session): SessionMeta {
    return {
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
      workspacePath: session.workspacePath,
      modelId: session.modelId,
    };
  }
}
