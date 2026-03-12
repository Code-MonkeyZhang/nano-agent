import { randomUUID } from 'node:crypto';
import { SessionStore } from './store.js';
import type { Session, SessionMeta, CreateSessionOptions } from './types.js';
import type { AgentId } from '../agent-config/types.js';
import type { Message } from '../schema/index.js';

/**
 * Manages session CRUD operations with metadata tracking.
 *
 * Each session is bound to a specific agent via agentId.
 * Sessions are organized by agent - switching agents means switching session lists.
 */
export class SessionManager {
  private store: SessionStore;

  constructor(store?: SessionStore) {
    this.store = store ?? new SessionStore();
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
   * Returns sessions for a specific agent.
   *
   * @param agentId - The agent ID to filter sessions by
   * @returns Array of session metadata for the specified agent
   */
  listSessionsByAgent(agentId: AgentId): SessionMeta[] {
    return this.listSessions().filter((s) => s.agentId === agentId);
  }

  /**
   * Creates a new session bound to a specific agent.
   *
   * @param agentId - The agent ID this session belongs to (required)
   * @param options - Optional creation options (title)
   * @returns The newly created session
   */
  createSession(agentId: AgentId, options?: CreateSessionOptions): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      agentId,
      title: options?.title ?? 'New Session',
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
   * Updates the session's agent binding.
   *
   * @param id - Session identifier
   * @param agentId - New agent ID
   * @returns Updated session or null if session not found
   */
  updateAgentId(id: string, agentId: AgentId): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    session.agentId = agentId;
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
    };
  }
}
