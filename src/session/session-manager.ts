/**
 * @fileoverview Session management operations.
 */

import { randomUUID } from 'node:crypto';
import { SessionStore } from './store.js';
import type { Session, SessionMeta, CreateSessionOptions } from './types.js';
import type { ModelConfig } from '../agent/types.js';
import type { Message } from '../schema/index.js';

export class SessionManager {
  constructor(
    private readonly store: SessionStore,
    private readonly agentId: string,
    private readonly defaultModel: ModelConfig,
    private readonly defaultWorkspacePath?: string
  ) {}

  /** List all sessions for this agent */
  listSessions(): SessionMeta[] {
    return this.store.loadIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Create a new session */
  createSession(options: CreateSessionOptions = {}): Session {
    const id = randomUUID();
    const now = Date.now();

    const session: Session = {
      id,
      agentId: this.agentId,
      title: options.title || 'New Session',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      messages: [],
      workspacePath: this.defaultWorkspacePath,
      model: this.defaultModel,
    };

    this.store.saveSession(session);
    this.addToIndex(session);
    return session;
  }

  /** Get a session by ID */
  getSession(id: string): Session | null {
    return this.store.loadSession(id);
  }

  /** Delete a session */
  deleteSession(id: string): boolean {
    const session = this.store.loadSession(id);
    if (!session) {
      return false;
    }

    this.store.deleteSessionFile(id);
    this.removeFromIndex(id);
    return true;
  }

  /** Append a message to a session */
  appendMessage(id: string, message: Message): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    session.messages.push(message);
    session.messageCount += 1;
    session.updatedAt = Date.now();

    this.store.saveSession(session);
    this.updateIndex(session);
    return session;
  }

  /** Update session title */
  updateTitle(id: string, title: string): Session | null {
    return this.updateSessionField(id, { title });
  }

  /** Update session workspace path */
  updateWorkspacePath(id: string, workspacePath: string): Session | null {
    return this.updateSessionField(id, { workspacePath });
  }

  /** Update session model */
  updateModel(id: string, model: ModelConfig | undefined): Session | null {
    return this.updateSessionField(id, { model });
  }

  /** Generic session field update */
  private updateSessionField(
    id: string,
    updates: Partial<Session>
  ): Session | null {
    const session = this.store.loadSession(id);
    if (!session) {
      return null;
    }

    Object.assign(session, updates, { updatedAt: Date.now() });
    this.store.saveSession(session);
    this.updateIndex(session);
    return session;
  }

  /** Add session to index */
  private addToIndex(session: Session): void {
    const index = this.store.loadIndex();
    index.push(this.toMeta(session));
    this.store.saveIndex(index);
  }

  /** Update session in index */
  private updateIndex(session: Session): void {
    const index = this.store.loadIndex();
    const idx = index.findIndex((s) => s.id === session.id);
    if (idx !== -1) {
      index[idx] = this.toMeta(session);
      this.store.saveIndex(index);
    }
  }

  /** Remove session from index */
  private removeFromIndex(id: string): void {
    const index = this.store.loadIndex();
    const filtered = index.filter((s) => s.id !== id);
    this.store.saveIndex(filtered);
  }

  /** Convert full session to metadata */
  private toMeta(session: Session): SessionMeta {
    return {
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
      workspacePath: session.workspacePath,
      model: session.model,
    };
  }
}
