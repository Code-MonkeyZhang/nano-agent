import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../src/session/store.js';
import { SessionManager } from '../src/session/manager.js';
import type { Session } from '../src/session/types.js';

const TEST_AGENT_ID = 'adam';
const TEST_AGENT_ID_2 = 'eve';

describe('SessionManager', () => {
  let manager: SessionManager;
  let store: SessionStore;
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `nano-agent-test-${randomUUID()}`);
    store = new SessionStore(testDir);
    manager = new SessionManager(store);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('listSessions', () => {
    it('should return empty array when no sessions exist', () => {
      expect(manager.listSessions()).toEqual([]);
    });

    it('should return sessions sorted by updatedAt descending', () => {
      manager.createSession(TEST_AGENT_ID, { title: 'Session 1' });
      const session2 = manager.createSession(TEST_AGENT_ID, { title: 'Session 2' });
      manager.createSession(TEST_AGENT_ID, { title: 'Session 3' });

      manager.appendMessage(session2.id, { role: 'user', content: 'Hello' });

      const sessions = manager.listSessions();
      expect(sessions.length).toBe(3);
      expect(sessions[0].id).toBe(session2.id);
    });
  });

  describe('listSessionsByAgent', () => {
    it('should return only sessions for the specified agent', () => {
      manager.createSession(TEST_AGENT_ID, { title: 'Adam Session 1' });
      manager.createSession(TEST_AGENT_ID, { title: 'Adam Session 2' });
      manager.createSession(TEST_AGENT_ID_2, { title: 'Eve Session 1' });

      const adamSessions = manager.listSessionsByAgent(TEST_AGENT_ID);
      expect(adamSessions.length).toBe(2);
      expect(adamSessions.every((s) => s.agentId === TEST_AGENT_ID)).toBe(true);

      const eveSessions = manager.listSessionsByAgent(TEST_AGENT_ID_2);
      expect(eveSessions.length).toBe(1);
      expect(eveSessions[0].agentId).toBe(TEST_AGENT_ID_2);
    });

    it('should return empty array for agent with no sessions', () => {
      manager.createSession(TEST_AGENT_ID, { title: 'Session' });
      expect(manager.listSessionsByAgent('unknown-agent')).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('should create a session with agentId', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Test Session' });

      expect(session.id).toBeDefined();
      expect(session.agentId).toBe(TEST_AGENT_ID);
      expect(session.title).toBe('Test Session');
      expect(session.createdAt).toBe(session.updatedAt);
      expect(session.messageCount).toBe(0);
      expect(session.messages).toEqual([]);
    });

    it('should create a session with default title', () => {
      const session = manager.createSession(TEST_AGENT_ID);

      expect(session.title).toBe('New Session');
    });

    it('should persist session to storage', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Persisted' });

      const loaded = store.loadSession(session.id);
      expect(loaded).toEqual(session);
    });

    it('should add session to index with agentId', () => {
      manager.createSession(TEST_AGENT_ID, { title: 'Indexed' });

      const index = store.loadIndex();
      expect(index.length).toBe(1);
      expect(index[0].title).toBe('Indexed');
      expect(index[0].agentId).toBe(TEST_AGENT_ID);
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      expect(manager.getSession('non-existent')).toBeNull();
    });

    it('should return complete session with messages', () => {
      const created = manager.createSession(TEST_AGENT_ID, { title: 'Test' });
      manager.appendMessage(created.id, { role: 'user', content: 'Hello' });
      manager.appendMessage(created.id, { role: 'assistant', content: 'Hi' });

      const session = manager.getSession(created.id);
      expect(session?.messages.length).toBe(2);
      expect(session?.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(session?.messages[1]).toEqual({
        role: 'assistant',
        content: 'Hi',
      });
    });
  });

  describe('deleteSession', () => {
    it('should return false for non-existent session', () => {
      expect(manager.deleteSession('non-existent')).toBe(false);
    });

    it('should delete session and remove from index', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'To Delete' });

      expect(manager.deleteSession(session.id)).toBe(true);
      expect(manager.getSession(session.id)).toBeNull();
      expect(manager.listSessions().length).toBe(0);
    });
  });

  describe('appendMessage', () => {
    it('should return null for non-existent session', () => {
      const result = manager.appendMessage('non-existent', {
        role: 'user',
        content: 'Test',
      });
      expect(result).toBeNull();
    });

    it('should append message and update metadata', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Test' });
      const beforeUpdate = session.updatedAt;

      const updated = manager.appendMessage(session.id, {
        role: 'user',
        content: 'Hello',
      });

      expect(updated?.messages.length).toBe(1);
      expect(updated?.messageCount).toBe(1);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should update index with new metadata', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Test' });
      manager.appendMessage(session.id, { role: 'user', content: 'Hello' });

      const index = store.loadIndex();
      const indexEntry = index.find((s) => s.id === session.id);
      expect(indexEntry?.messageCount).toBe(1);
    });

    it('should persist messages to session file', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Test' });
      manager.appendMessage(session.id, { role: 'user', content: 'Hello' });

      const loaded = store.loadSession(session.id);
      expect(loaded?.messages.length).toBe(1);
    });
  });

  describe('updateTitle', () => {
    it('should return null for non-existent session', () => {
      expect(manager.updateTitle('non-existent', 'New Title')).toBeNull();
    });

    it('should update title and updatedAt', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Old Title' });
      const beforeUpdate = session.updatedAt;

      const updated = manager.updateTitle(session.id, 'New Title');

      expect(updated?.title).toBe('New Title');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should update index with new title', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Old' });

      manager.updateTitle(session.id, 'New');

      const index = store.loadIndex();
      const indexEntry = index.find((s) => s.id === session.id);
      expect(indexEntry?.title).toBe('New');
    });
  });

  describe('updateAgentId', () => {
    it('should return null for non-existent session', () => {
      expect(manager.updateAgentId('non-existent', TEST_AGENT_ID_2)).toBeNull();
    });

    it('should update agentId and updatedAt', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Test' });
      const beforeUpdate = session.updatedAt;

      const updated = manager.updateAgentId(session.id, TEST_AGENT_ID_2);

      expect(updated?.agentId).toBe(TEST_AGENT_ID_2);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should update index with new agentId', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'Test' });

      manager.updateAgentId(session.id, TEST_AGENT_ID_2);

      const index = store.loadIndex();
      const indexEntry = index.find((s) => s.id === session.id);
      expect(indexEntry?.agentId).toBe(TEST_AGENT_ID_2);
    });
  });

  describe('integration', () => {
    it('should handle full session lifecycle with agent binding', () => {
      const session = manager.createSession(TEST_AGENT_ID, { title: 'My Chat' });
      expect(session.agentId).toBe(TEST_AGENT_ID);
      expect(session.messageCount).toBe(0);

      manager.appendMessage(session.id, {
        role: 'user',
        content: 'What is 2+2?',
      });
      manager.appendMessage(session.id, {
        role: 'assistant',
        content: '2+2 equals 4.',
      });

      manager.updateTitle(session.id, 'What is 2+2?');

      const loaded = manager.getSession(session.id);
      expect(loaded?.title).toBe('What is 2+2?');
      expect(loaded?.agentId).toBe(TEST_AGENT_ID);
      expect(loaded?.messageCount).toBe(2);
      expect(loaded?.messages.length).toBe(2);

      expect(manager.deleteSession(session.id)).toBe(true);
      expect(manager.getSession(session.id)).toBeNull();
    });

    it('should maintain consistency between index and sessions', () => {
      const sessions: Session[] = [];

      for (let i = 0; i < 5; i++) {
        const agentId = i % 2 === 0 ? TEST_AGENT_ID : TEST_AGENT_ID_2;
        sessions.push(manager.createSession(agentId, { title: `Session ${i}` }));
      }

      manager.appendMessage(sessions[0].id, { role: 'user', content: 'A' });
      manager.appendMessage(sessions[2].id, { role: 'user', content: 'B' });
      manager.appendMessage(sessions[2].id, { role: 'user', content: 'C' });

      const index = manager.listSessions();
      expect(index.length).toBe(5);

      for (const meta of index) {
        const session = manager.getSession(meta.id);
        expect(session).not.toBeNull();
        expect(session?.messageCount).toBe(meta.messageCount);
        expect(session?.title).toBe(meta.title);
        expect(session?.agentId).toBe(meta.agentId);
      }

      manager.deleteSession(sessions[1].id);
      manager.deleteSession(sessions[3].id);

      const remainingIndex = manager.listSessions();
      expect(remainingIndex.length).toBe(3);
    });

    it('should correctly filter sessions by agent', () => {
      manager.createSession(TEST_AGENT_ID, { title: 'Adam 1' });
      manager.createSession(TEST_AGENT_ID_2, { title: 'Eve 1' });
      manager.createSession(TEST_AGENT_ID, { title: 'Adam 2' });
      manager.createSession(TEST_AGENT_ID_2, { title: 'Eve 2' });

      const adamSessions = manager.listSessionsByAgent(TEST_AGENT_ID);
      const eveSessions = manager.listSessionsByAgent(TEST_AGENT_ID_2);

      expect(adamSessions.length).toBe(2);
      expect(eveSessions.length).toBe(2);
    });
  });
});
