import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  initAgentConfigStore,
  createAgentConfig,
  updateAgentConfig,
  deleteAgentConfig,
  getAgentConfig,
  listAgentConfigs,
  hasAgentConfig,
  reloadAgentConfig,
} from '../src/agent-config/index.js';

describe('AgentConfigStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-test-'));
    initAgentConfigStore(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initAgentConfigStore', () => {
    it('should return empty array when directory is empty', () => {
      const agents = listAgentConfigs();

      expect(agents.length).toBe(0);
    });

    it('should load existing agents from directory', () => {
      const existingAgent = {
        id: 'custom-agent',
        name: 'Custom Agent',
        systemPrompt: 'You are a custom agent.',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 10,
        mcpIds: [],
        skillIds: [],
      };

      const agentDir = path.join(tempDir, 'custom-agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, 'config.json'),
        JSON.stringify(existingAgent)
      );

      initAgentConfigStore(tempDir);
      const agents = listAgentConfigs();
      const custom = agents.find((a) => a.id === 'custom-agent');

      expect(custom).toBeDefined();
      expect(custom?.name).toBe('Custom Agent');
    });
  });

  describe('createAgentConfig', () => {
    it('should create an agent with generated ID', () => {
      const agent = createAgentConfig({
        name: 'Test Agent',
        systemPrompt: 'You are a test agent.',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 10,
        mcpIds: ['ticktick'],
        skillIds: [],
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.provider).toBe('openai');
      expect(agent.mcpIds).toEqual(['ticktick']);
    });

    it('should create an agent with custom ID', () => {
      const agent = createAgentConfig({
        id: 'my-custom-id',
        name: 'Custom ID Agent',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      expect(agent.id).toBe('my-custom-id');
    });

    it('should throw error if agent with same ID exists', () => {
      createAgentConfig({
        id: 'duplicate-id',
        name: 'First',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      expect(() =>
        createAgentConfig({
          id: 'duplicate-id',
          name: 'Second',
          systemPrompt: 'Test',
          provider: 'openai',
          modelId: 'gpt-4o',
          maxSteps: 5,
          mcpIds: [],
          skillIds: [],
        })
      ).toThrow('Agent already exists');
    });

    it('should persist agent to file', () => {
      createAgentConfig({
        id: 'persisted-agent',
        name: 'Persisted',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 10,
        mcpIds: [],
        skillIds: [],
      });

      const filePath = path.join(tempDir, 'persisted-agent', 'config.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(content.name).toBe('Persisted');
      expect(content.provider).toBe('openai');
    });
  });

  describe('getAgentConfig', () => {
    it('should return agent by ID', () => {
      createAgentConfig({
        id: 'get-test',
        name: 'Get Test',
        systemPrompt: 'Test prompt',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 10,
        mcpIds: [],
        skillIds: [],
      });

      const agent = getAgentConfig('get-test');

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Get Test');
    });

    it('should return undefined for non-existent ID', () => {
      expect(getAgentConfig('non-existent')).toBeUndefined();
    });
  });

  describe('listAgentConfigs', () => {
    it('should list all agents', () => {
      const countBefore = listAgentConfigs().length;

      createAgentConfig({
        id: 'agent-1',
        name: 'Agent 1',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      createAgentConfig({
        id: 'agent-2',
        name: 'Agent 2',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      const agents = listAgentConfigs();

      expect(agents.length).toBe(countBefore + 2);
    });
  });

  describe('updateAgentConfig', () => {
    it('should update agent fields', () => {
      createAgentConfig({
        id: 'update-test',
        name: 'Original',
        systemPrompt: 'Original prompt',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      const updated = updateAgentConfig('update-test', {
        name: 'Updated',
        provider: 'anthropic',
        maxSteps: 20,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.provider).toBe('anthropic');
      expect(updated.maxSteps).toBe(20);
      expect(updated.modelId).toBe('gpt-4o');
    });

    it('should throw error for non-existent agent', () => {
      expect(() =>
        updateAgentConfig('non-existent', { name: 'Test' })
      ).toThrow('Agent not found');
    });

    it('should persist updates to file', () => {
      createAgentConfig({
        id: 'persist-update',
        name: 'Original',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      updateAgentConfig('persist-update', { name: 'Updated' });

      initAgentConfigStore(tempDir);
      const agent = getAgentConfig('persist-update');

      expect(agent?.name).toBe('Updated');
    });
  });

  describe('deleteAgentConfig', () => {
    it('should delete agent', () => {
      createAgentConfig({
        id: 'delete-test',
        name: 'To Delete',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      expect(hasAgentConfig('delete-test')).toBe(true);

      deleteAgentConfig('delete-test');

      expect(hasAgentConfig('delete-test')).toBe(false);
      expect(getAgentConfig('delete-test')).toBeUndefined();
    });

    it('should throw error for non-existent agent', () => {
      expect(() => deleteAgentConfig('non-existent')).toThrow('Agent not found');
    });

    it('should delete agent file', () => {
      createAgentConfig({
        id: 'file-delete',
        name: 'File Delete',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      const agentDir = path.join(tempDir, 'file-delete');
      expect(fs.existsSync(agentDir)).toBe(true);

      deleteAgentConfig('file-delete');

      expect(fs.existsSync(agentDir)).toBe(false);
    });
  });

  describe('hasAgentConfig', () => {
    it('should return true for existing agent', () => {
      createAgentConfig({
        id: 'has-test',
        name: 'Has Test',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      expect(hasAgentConfig('has-test')).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      expect(hasAgentConfig('non-existent')).toBe(false);
    });
  });

  describe('reloadAgentConfig', () => {
    it('should reload agent from file', () => {
      createAgentConfig({
        id: 'reload-test',
        name: 'Original',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      const filePath = path.join(tempDir, 'reload-test', 'config.json');
      const modified = {
        id: 'reload-test',
        name: 'Modified Externally',
        systemPrompt: 'Test',
        provider: 'anthropic',
        modelId: 'gpt-4o',
        maxSteps: 10,
        mcpIds: [],
        skillIds: [],
      };

      fs.writeFileSync(filePath, JSON.stringify(modified));

      const reloaded = reloadAgentConfig('reload-test');

      expect(reloaded?.name).toBe('Modified Externally');
      expect(reloaded?.provider).toBe('anthropic');
    });

    it('should return undefined and remove from cache if file deleted', () => {
      createAgentConfig({
        id: 'reload-delete',
        name: 'To Delete',
        systemPrompt: 'Test',
        provider: 'openai',
        modelId: 'gpt-4o',
        maxSteps: 5,
        mcpIds: [],
        skillIds: [],
      });

      const agentDir = path.join(tempDir, 'reload-delete');
      fs.rmSync(agentDir, { recursive: true, force: true });

      const reloaded = reloadAgentConfig('reload-delete');

      expect(reloaded).toBeUndefined();
      expect(hasAgentConfig('reload-delete')).toBe(false);
    });
  });
});
