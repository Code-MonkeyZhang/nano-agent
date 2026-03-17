import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  initCredentialPool,
  setCredential,
  deleteCredential,
  getCredential,
  listProvidersWithCredential,
  hasCredential,
} from '../src/credential/index.js';
import type { Provider } from '../src/credential/index.js';

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
    it('should initialize with all providers listed when file does not exist', () => {
      const providers = listProvidersWithCredential();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.every((p) => p.hasCredential === false)).toBe(true);
    });

    it('should load existing credentials from file', () => {
      const existingData = {
        anthropic: { apiKey: 'sk-test-123' },
        openai: { apiKey: 'sk-openai-456' },
      };
      fs.writeFileSync(testFilePath, JSON.stringify(existingData));

      initCredentialPool(testFilePath);
      const providers = listProvidersWithCredential();

      expect(providers.length).toBeGreaterThan(0);
      expect(providers.find((p) => p.id === 'anthropic')?.hasCredential).toBe(
        true
      );
      expect(providers.find((p) => p.id === 'openai')?.hasCredential).toBe(
        true
      );
    });
  });

  describe('setCredential', () => {
    it('should set a credential for a provider', () => {
      const credential = setCredential('anthropic' as Provider, {
        apiKey: 'sk-ant-test-123',
      });

      expect(credential.apiKey).toBe('sk-ant-test-123');
    });

    it('should persist credential to file', () => {
      setCredential('openai' as Provider, { apiKey: 'sk-test-key' });

      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      const data = JSON.parse(fileContent);

      expect(Object.keys(data).length).toBe(1);
      expect(data.openai?.apiKey).toBe('sk-test-key');
    });

    it('should overwrite existing credential', () => {
      setCredential('anthropic' as Provider, { apiKey: 'key1' });
      setCredential('anthropic' as Provider, { apiKey: 'key2' });

      const credential = getCredential('anthropic' as Provider);
      expect(credential?.apiKey).toBe('key2');
    });
  });

  describe('getCredential', () => {
    it('should return credential with full API key', () => {
      setCredential('anthropic' as Provider, {
        apiKey: 'secret-key-123',
      });

      const retrieved = getCredential('anthropic' as Provider);

      expect(retrieved).toBeDefined();
      expect(retrieved?.apiKey).toBe('secret-key-123');
    });

    it('should return undefined for non-existent provider', () => {
      expect(getCredential('anthropic' as Provider)).toBeUndefined();
    });
  });

  describe('listProvidersWithCredential', () => {
    it('should return all providers with their status', () => {
      setCredential('anthropic' as Provider, { apiKey: 'anthropic-key' });
      setCredential('openai' as Provider, { apiKey: 'openai-key' });

      const list = listProvidersWithCredential();

      expect(list.length).toBeGreaterThan(0);
      const anthropic = list.find((p) => p.id === 'anthropic');
      const openai = list.find((p) => p.id === 'openai');

      expect(anthropic?.hasCredential).toBe(true);
      expect(openai?.hasCredential).toBe(true);
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential', () => {
      setCredential('anthropic' as Provider, { apiKey: 'key' });

      expect(hasCredential('anthropic' as Provider)).toBe(true);

      deleteCredential('anthropic' as Provider);

      expect(hasCredential('anthropic' as Provider)).toBe(false);
      expect(getCredential('anthropic' as Provider)).toBeUndefined();
    });

    it('should throw error for non-existent provider', () => {
      expect(() => deleteCredential('anthropic' as Provider)).toThrow(
        'Credential not found'
      );
    });

    it('should persist deletion to file', () => {
      setCredential('openai' as Provider, { apiKey: 'key' });

      deleteCredential('openai' as Provider);

      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      const data = JSON.parse(fileContent);

      expect(Object.keys(data).length).toBe(0);
    });
  });

  describe('hasCredential', () => {
    it('should return true for existing credential', () => {
      setCredential('anthropic' as Provider, { apiKey: 'key' });

      expect(hasCredential('anthropic' as Provider)).toBe(true);
    });

    it('should return false for non-existent credential', () => {
      expect(hasCredential('anthropic' as Provider)).toBe(false);
    });
  });
});
