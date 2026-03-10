import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createAgent,
  getCachedAgent,
  clearAgentCache,
  clearAllAgentCache,
  isAgentCached,
  reloadAgent,
  setDefaultWorkspaceDir,
} from '../src/agent-factory/index.js';
import { initCredentialPool } from '../src/credential/store.js';
import { initAgentConfigStore } from '../src/agent-config/store.js';
import { initBuiltinToolPool } from '../src/builtin-tool-pool/store.js';
import { initSkillPool } from '../src/skill-pool/store.js';
import { createCredential } from '../src/credential/store.js';
import type { Credential } from '../src/credential/types.js';

const TEST_DATA_DIR = path.resolve(process.cwd(), 'tests/temp/agent-factory-test');
const TEST_WORKSPACE = path.resolve(process.cwd(), 'tests/temp/workspace');

function ensureTestDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('AgentFactory', () => {
  let testCredential: Credential;

  beforeEach(() => {
    cleanupTestDir(TEST_DATA_DIR);
    cleanupTestDir(TEST_WORKSPACE);
    ensureTestDir(TEST_DATA_DIR);
    ensureTestDir(TEST_WORKSPACE);
    ensureTestDir(path.join(TEST_DATA_DIR, 'agents'));

    clearAllAgentCache();
    setDefaultWorkspaceDir(TEST_WORKSPACE);

    initCredentialPool(path.join(TEST_DATA_DIR, 'credentials.json'));
    testCredential = createCredential({
      name: 'Test Credential',
      provider: 'openai',
      apiBase: 'https://api.test.com/v1',
      apiKey: 'test-api-key-12345',
    });

    const testAgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
      credentialId: testCredential.id,
      model: 'gpt-4o',
      maxSteps: 5,
      mcpIds: [],
      skillIds: [],
    };
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'agents', 'test-agent.json'),
      JSON.stringify(testAgentConfig, null, 2)
    );

    initAgentConfigStore(path.join(TEST_DATA_DIR, 'agents'));
    initBuiltinToolPool(TEST_WORKSPACE);
    initSkillPool(path.join(TEST_DATA_DIR, 'skills'));
  });

  afterEach(() => {
    clearAllAgentCache();
    cleanupTestDir(TEST_DATA_DIR);
    cleanupTestDir(TEST_WORKSPACE);
  });

  describe('createAgent', () => {
    it('should create an agent from config', async () => {
      const agent = await createAgent('test-agent');

      expect(agent).toBeDefined();
      expect(agent.runConfig.model).toBe('gpt-4o');
      expect(agent.runConfig.provider).toBe('openai');
      expect(agent.runConfig.apiBase).toBe('https://api.test.com/v1');
      expect(agent.runConfig.baseSystemPrompt).toContain(
        'You are a test agent.'
      );
      expect(agent.runConfig.maxSteps).toBe(5);
      expect(agent.tools.size).toBeGreaterThan(0);
    });

    it('should throw error if agent config not found', async () => {
      await expect(createAgent('non-existent-agent')).rejects.toThrow(
        'Agent not found: non-existent-agent'
      );
    });

    it('should throw error if credential not configured', async () => {
      const noCredentialConfig = {
        id: 'no-credential-agent',
        name: 'No Credential Agent',
        systemPrompt: 'Test',
        credentialId: null,
        model: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      };
      fs.writeFileSync(
        path.join(TEST_DATA_DIR, 'agents', 'no-credential-agent.json'),
        JSON.stringify(noCredentialConfig, null, 2)
      );
      initAgentConfigStore(path.join(TEST_DATA_DIR, 'agents'));

      await expect(createAgent('no-credential-agent')).rejects.toThrow(
        'has no credential configured'
      );
    });

    it('should throw error if credential not found', async () => {
      const invalidCredentialConfig = {
        id: 'invalid-credential-agent',
        name: 'Invalid Credential Agent',
        systemPrompt: 'Test',
        credentialId: 'non-existent-credential',
        model: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      };
      fs.writeFileSync(
        path.join(TEST_DATA_DIR, 'agents', 'invalid-credential-agent.json'),
        JSON.stringify(invalidCredentialConfig, null, 2)
      );
      initAgentConfigStore(path.join(TEST_DATA_DIR, 'agents'));

      await expect(createAgent('invalid-credential-agent')).rejects.toThrow(
        'Credential not found'
      );
    });

    it('should load builtin tools', async () => {
      const agent = await createAgent('test-agent');

      const toolNames = Array.from(agent.tools.keys());
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('edit_file');
      expect(toolNames).toContain('bash');
      expect(toolNames).toContain('bash_output');
      expect(toolNames).toContain('bash_kill');
    });
  });

  describe('caching', () => {
    it('should cache created agent', async () => {
      const agent1 = await createAgent('test-agent');
      const agent2 = await createAgent('test-agent');

      expect(agent1).toBe(agent2);
      expect(isAgentCached('test-agent')).toBe(true);
    });

    it('should return cached agent with getCachedAgent', async () => {
      await createAgent('test-agent');
      const cached = getCachedAgent('test-agent');

      expect(cached).toBeDefined();
      expect(cached?.runConfig.model).toBe('gpt-4o');
    });

    it('should return undefined for non-cached agent', () => {
      const cached = getCachedAgent('non-cached');
      expect(cached).toBeUndefined();
    });

    it('should clear specific agent from cache', async () => {
      await createAgent('test-agent');
      expect(isAgentCached('test-agent')).toBe(true);

      clearAgentCache('test-agent');
      expect(isAgentCached('test-agent')).toBe(false);
    });

    it('should clear all agents from cache', async () => {
      await createAgent('test-agent');
      expect(isAgentCached('test-agent')).toBe(true);

      clearAllAgentCache();
      expect(isAgentCached('test-agent')).toBe(false);
    });
  });

  describe('reloadAgent', () => {
    it('should reload agent from config', async () => {
      await createAgent('test-agent');
      clearAgentCache('test-agent');

      const agent = await reloadAgent('test-agent');

      expect(agent).toBeDefined();
      expect(agent.runConfig.model).toBe('gpt-4o');
      expect(isAgentCached('test-agent')).toBe(true);
    });
  });

  describe('setDefaultWorkspaceDir', () => {
    it('should set default workspace directory', async () => {
      const customWorkspace = path.join(TEST_DATA_DIR, 'custom-workspace');
      ensureTestDir(customWorkspace);

      setDefaultWorkspaceDir(customWorkspace);
      clearAgentCache('test-agent');

      const agent = await createAgent('test-agent');
      expect(agent.workspaceDir).toBe(customWorkspace);
    });
  });
});
