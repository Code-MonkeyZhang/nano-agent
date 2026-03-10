import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  initCredentialPool,
  createCredential,
  updateCredential,
  deleteCredential,
  getCredential,
  listCredentials,
  hasCredential,
} from '../src/credential/index.js';

describe('CredentialPool', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'credential-pool-test-'));
    testFilePath = path.join(tempDir, 'credentials.json');
    initCredentialPool(testFilePath);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initCredentialPool', () => {
    it('should initialize with empty pool when file does not exist', () => {
      expect(listCredentials()).toEqual([]);
    });

    it('should load existing credentials from file', () => {
      const existingData = {
        'test-id-1': {
          id: 'test-id-1',
          name: 'Test Credential',
          provider: 'anthropic',
          apiBase: 'https://api.anthropic.com',
          apiKey: 'sk-test-123',
        },
      };
      fs.writeFileSync(testFilePath, JSON.stringify(existingData));

      initCredentialPool(testFilePath);
      const credentials = listCredentials();

      expect(credentials.length).toBe(1);
      expect(credentials[0]?.name).toBe('Test Credential');
    });
  });

  describe('createCredential', () => {
    it('should create a credential with generated ID', () => {
      const credential = createCredential({
        name: 'MiniMax',
        provider: 'anthropic',
        apiBase: 'https://api.minimax.chat/v1',
        apiKey: 'minimax-api-key-12345',
      });

      expect(credential.id).toBeDefined();
      expect(credential.name).toBe('MiniMax');
      expect(credential.provider).toBe('anthropic');
      expect(credential.apiBase).toBe('https://api.minimax.chat/v1');
      expect(credential.apiKey).toBe('minimax-api-key-12345');
    });

    it('should persist credential to file', () => {
      createCredential({
        name: 'Test',
        provider: 'openai',
        apiBase: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      });

      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      const data = JSON.parse(fileContent);

      expect(Object.keys(data).length).toBe(1);
    });

    it('should create multiple credentials', () => {
      createCredential({
        name: 'MiniMax',
        provider: 'anthropic',
        apiBase: 'https://api.minimax.chat/v1',
        apiKey: 'key1',
      });

      createCredential({
        name: 'ZhipuAI',
        provider: 'anthropic',
        apiBase: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'key2',
      });

      createCredential({
        name: 'DeepSeek',
        provider: 'openai',
        apiBase: 'https://api.deepseek.com/v1',
        apiKey: 'key3',
      });

      expect(listCredentials().length).toBe(3);
    });
  });

  describe('getCredential', () => {
    it('should return credential with full API key', () => {
      const created = createCredential({
        name: 'Test',
        provider: 'anthropic',
        apiBase: 'https://api.test.com',
        apiKey: 'secret-key-123',
      });

      const retrieved = getCredential(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.apiKey).toBe('secret-key-123');
    });

    it('should return undefined for non-existent ID', () => {
      expect(getCredential('non-existent-id')).toBeUndefined();
    });
  });

  describe('listCredentials', () => {
    it('should return all credentials', () => {
      createCredential({
        name: 'MiniMax',
        provider: 'anthropic',
        apiBase: 'https://api.minimax.chat/v1',
        apiKey: 'minimax-secret-key',
      });

      createCredential({
        name: 'DeepSeek',
        provider: 'openai',
        apiBase: 'https://api.deepseek.com/v1',
        apiKey: 'deepseek-secret-key',
      });

      const list = listCredentials();

      expect(list.length).toBe(2);
    });
  });

  describe('updateCredential', () => {
    it('should update credential fields', () => {
      const created = createCredential({
        name: 'Original',
        provider: 'anthropic',
        apiBase: 'https://original.com',
        apiKey: 'original-key',
      });

      const updated = updateCredential(created.id, {
        name: 'Updated',
        apiKey: 'new-key-12345',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.apiKey).toBe('new-key-12345');
      expect(updated.provider).toBe('anthropic');
    });

    it('should throw error for non-existent credential', () => {
      expect(() => updateCredential('non-existent', { name: 'Test' })).toThrow(
        'Credential not found'
      );
    });

    it('should persist updates to file', () => {
      const created = createCredential({
        name: 'Test',
        provider: 'openai',
        apiBase: 'https://test.com',
        apiKey: 'key',
      });

      updateCredential(created.id, { name: 'Updated' });

      initCredentialPool(testFilePath);
      const retrieved = getCredential(created.id);

      expect(retrieved?.name).toBe('Updated');
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential', () => {
      const created = createCredential({
        name: 'To Delete',
        provider: 'anthropic',
        apiBase: 'https://test.com',
        apiKey: 'key',
      });

      expect(hasCredential(created.id)).toBe(true);

      deleteCredential(created.id);

      expect(hasCredential(created.id)).toBe(false);
      expect(getCredential(created.id)).toBeUndefined();
    });

    it('should throw error for non-existent credential', () => {
      expect(() => deleteCredential('non-existent')).toThrow(
        'Credential not found'
      );
    });

    it('should persist deletion to file', () => {
      const created = createCredential({
        name: 'Test',
        provider: 'openai',
        apiBase: 'https://test.com',
        apiKey: 'key',
      });

      deleteCredential(created.id);

      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      const data = JSON.parse(fileContent);

      expect(Object.keys(data).length).toBe(0);
    });
  });

  describe('hasCredential', () => {
    it('should return true for existing credential', () => {
      const created = createCredential({
        name: 'Test',
        provider: 'anthropic',
        apiBase: 'https://test.com',
        apiKey: 'key',
      });

      expect(hasCredential(created.id)).toBe(true);
    });

    it('should return false for non-existent credential', () => {
      expect(hasCredential('non-existent')).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should support MiniMax (Anthropic-compatible)', () => {
      const credential = createCredential({
        name: 'MiniMax',
        provider: 'anthropic',
        apiBase: 'https://api.minimax.chat/v1',
        apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      });

      expect(credential.provider).toBe('anthropic');
      expect(credential.apiBase).toBe('https://api.minimax.chat/v1');
    });

    it('should support ZhipuAI (Anthropic-compatible)', () => {
      const credential = createCredential({
        name: 'ZhipuAI',
        provider: 'anthropic',
        apiBase: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'zhipuai-api-key-abcdef',
      });

      expect(credential.provider).toBe('anthropic');
      expect(credential.apiBase).toBe(
        'https://open.bigmodel.cn/api/paas/v4'
      );
    });

    it('should support DeepSeek (OpenAI-compatible)', () => {
      const credential = createCredential({
        name: 'DeepSeek',
        provider: 'openai',
        apiBase: 'https://api.deepseek.com/v1',
        apiKey: 'sk-deepseek-key-12345678',
      });

      expect(credential.provider).toBe('openai');
      expect(credential.apiBase).toBe('https://api.deepseek.com/v1');
    });

    it('should list all three providers', () => {
      createCredential({
        name: 'MiniMax',
        provider: 'anthropic',
        apiBase: 'https://api.minimax.chat/v1',
        apiKey: 'minimax-key',
      });

      createCredential({
        name: 'ZhipuAI',
        provider: 'anthropic',
        apiBase: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'zhipu-key',
      });

      createCredential({
        name: 'DeepSeek',
        provider: 'openai',
        apiBase: 'https://api.deepseek.com/v1',
        apiKey: 'deepseek-key',
      });

      const list = listCredentials();

      expect(list.length).toBe(3);

      const anthropicCount = list.filter((c) => c.provider === 'anthropic').length;
      const openaiCount = list.filter((c) => c.provider === 'openai').length;

      expect(anthropicCount).toBe(2);
      expect(openaiCount).toBe(1);
    });
  });
});
