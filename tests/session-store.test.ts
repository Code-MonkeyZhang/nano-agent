import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../src/session/store.js';
import type { Session, SessionMeta } from '../src/session/types.js';

const TEST_AGENT_ID = 'adam';

describe('SessionStore', () => {
  let store: SessionStore;
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `nano-agent-test-${randomUUID()}`);
    store = new SessionStore(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getSessionsPath', () => {
    it('should return sessions directory path', () => {
      const expected = path.join(testDir, 'sessions');
      expect(store.getSessionsPath()).toBe(expected);
    });
  });

  describe('loadIndex', () => {
    it('should return empty array when index file does not exist', () => {
      expect(store.loadIndex()).toEqual([]);
    });

    it('should return parsed index when file exists', () => {
      const sessions: SessionMeta[] = [
        {
          id: 'test-1',
          agentId: TEST_AGENT_ID,
          title: 'Test Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        },
      ];
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'sessions.json'),
        JSON.stringify(sessions)
      );

      expect(store.loadIndex()).toEqual(sessions);
    });

    it('should return empty array on invalid JSON', () => {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'sessions.json'), 'invalid json');

      expect(store.loadIndex()).toEqual([]);
    });
  });

  describe('saveIndex', () => {
    it('should create directory and save index', () => {
      const sessions: SessionMeta[] = [
        {
          id: 'test-1',
          agentId: TEST_AGENT_ID,
          title: 'Test Session',
          createdAt: 1000,
          updatedAt: 2000,
          messageCount: 5,
        },
      ];

      store.saveIndex(sessions);

      const indexPath = path.join(testDir, 'sessions.json');
      expect(fs.existsSync(indexPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(indexPath, 'utf-8'))).toEqual(sessions);
    });
  });

  describe('loadSession', () => {
    it('should return null when session file does not exist', () => {
      expect(store.loadSession('non-existent')).toBeNull();
    });

    it('should return parsed session when file exists', () => {
      const session: Session = {
        id: 'test-1',
        agentId: TEST_AGENT_ID,
        title: 'Test Session',
        createdAt: 1000,
        updatedAt: 2000,
        messageCount: 2,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      };

      const sessionsDir = path.join(testDir, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(
        path.join(sessionsDir, 'test-1.json'),
        JSON.stringify(session)
      );

      expect(store.loadSession('test-1')).toEqual(session);
    });

    it('should return null on invalid JSON', () => {
      const sessionsDir = path.join(testDir, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(
        path.join(sessionsDir, 'invalid.json'),
        'invalid json'
      );

      expect(store.loadSession('invalid')).toBeNull();
    });
  });

  describe('saveSession', () => {
    it('should create directory and save session', () => {
      const session: Session = {
        id: 'test-1',
        agentId: TEST_AGENT_ID,
        title: 'Test Session',
        createdAt: 1000,
        updatedAt: 2000,
        messageCount: 2,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      };

      store.saveSession(session);

      const sessionPath = path.join(testDir, 'sessions', 'test-1.json');
      expect(fs.existsSync(sessionPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))).toEqual(
        session
      );
    });
  });

  describe('deleteSessionFile', () => {
    it('should return false when file does not exist', () => {
      expect(store.deleteSessionFile('non-existent')).toBe(false);
    });

    it('should delete file and return true when file exists', () => {
      const sessionsDir = path.join(testDir, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      const sessionPath = path.join(sessionsDir, 'test-1.json');
      fs.writeFileSync(sessionPath, '{}');

      expect(store.deleteSessionFile('test-1')).toBe(true);
      expect(fs.existsSync(sessionPath)).toBe(false);
    });
  });

  describe('integration', () => {
    it('should save and load session correctly', () => {
      const session: Session = {
        id: 'integration-test',
        agentId: TEST_AGENT_ID,
        title: 'Integration Test',
        createdAt: 1000,
        updatedAt: 2000,
        messageCount: 1,
        messages: [{ role: 'user', content: 'Test message' }],
      };

      store.saveSession(session);
      const loaded = store.loadSession('integration-test');

      expect(loaded).toEqual(session);
    });

    it('should save and load index correctly', () => {
      const sessions: SessionMeta[] = [
        {
          id: 'session-1',
          agentId: TEST_AGENT_ID,
          title: 'Session 1',
          createdAt: 1000,
          updatedAt: 2000,
          messageCount: 5,
        },
        {
          id: 'session-2',
          agentId: 'eve',
          title: 'Session 2',
          createdAt: 3000,
          updatedAt: 4000,
          messageCount: 3,
        },
      ];

      store.saveIndex(sessions);
      const loaded = store.loadIndex();

      expect(loaded).toEqual(sessions);
    });
  });
});
