import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createAgent,
  setDefaultWorkspaceDir,
} from '../src/agent-factory/index.js';
import { initCredentialPool, setCredential } from '../src/credential/store.js';
import { initAgentConfigStore } from '../src/agent-config/store.js';
import { initBuiltinToolPool } from '../src/builtin-tool-pool/store.js';
import { initSkillPool } from '../src/skill-pool/store.js';

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
  beforeEach(() => {
    cleanupTestDir(TEST_DATA_DIR);
    cleanupTestDir(TEST_WORKSPACE);
    ensureTestDir(TEST_DATA_DIR);
    ensureTestDir(TEST_WORKSPACE);
    ensureTestDir(path.join(TEST_DATA_DIR, 'agents'));

    setDefaultWorkspaceDir(TEST_WORKSPACE);

    initCredentialPool(path.join(TEST_DATA_DIR, 'credentials.json'));
    setCredential('openai', {
      apiKey: 'test-api-key-12345',
    });

    const testAgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
      provider: 'openai',
      modelId: 'gpt-4o',
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
    cleanupTestDir(TEST_DATA_DIR);
    cleanupTestDir(TEST_WORKSPACE);
  });

  describe('createAgent', () => {
    it('should create an agent from config', async () => {
      const agent = await createAgent('test-agent');

      expect(agent).toBeDefined();
      expect(agent.runConfig.modelId).toBe('gpt-4o');
      expect(agent.runConfig.provider).toBe('openai');
      expect(agent.runConfig.model.baseUrl).toBe('https://api.openai.com/v1');
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
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
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
        "No credential found for provider 'anthropic'"
      );
    });

    it('should throw error if model not found', async () => {
      const invalidModelConfig = {
        id: 'invalid-model-agent',
        name: 'Invalid Model Agent',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'non-existent-model',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      };
      fs.writeFileSync(
        path.join(TEST_DATA_DIR, 'agents', 'invalid-model-agent.json'),
        JSON.stringify(invalidModelConfig, null, 2)
      );
      initAgentConfigStore(path.join(TEST_DATA_DIR, 'agents'));

      await expect(createAgent('invalid-model-agent')).rejects.toThrow(
        "Model not found: openai/non-existent-model"
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

  describe('setDefaultWorkspaceDir', () => {
    it('should set default workspace directory', async () => {
      const customWorkspace = path.join(TEST_DATA_DIR, 'custom-workspace');
      ensureTestDir(customWorkspace);

      setDefaultWorkspaceDir(customWorkspace);

      const agent = await createAgent('test-agent');
      expect(agent.workspaceDir).toBe(customWorkspace);
    });
  });
});
