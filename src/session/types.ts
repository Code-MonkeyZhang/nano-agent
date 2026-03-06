import type { Message } from '../schema/index.js';

/**
 * Session metadata stored in the index file (sessions.json).
 * Contains summary information without the full message history.
 */
export interface SessionMeta {
  id: string;
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
