/**
 * Session management module for nano-agent.
 *
 * Provides persistent storage of conversation sessions using JSON files.
 * Each session is bound to a specific agent via agentId.
 *
 * @module session
 */
export { SessionStore } from './store.js';
export { SessionManager } from './manager.js';
export type { Session, SessionMeta, CreateSessionOptions } from './types.js';
