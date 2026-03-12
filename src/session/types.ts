import type { AgentId } from '../agent-config/types.js';
import type { Message } from '../schema/index.js';

/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
  title?: string;
}

/**
 * Session metadata stored in the index file (sessions.json).
 * Contains summary information without the full message history.
 */
export interface SessionMeta {
  id: string;
  agentId: AgentId;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Complete session data including full message history.
 * Stored in individual session files ({sessionId}.json).
 */
export interface Session extends SessionMeta {
  messages: Message[];
}
