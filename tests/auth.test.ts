/**
 * @fileoverview Integration tests for the Auth module.
 *
 * Tests cover two layers:
 * 1. Auth Store Functions - direct testing of storage operations
 * 2. HTTP API Routes - testing via HTTP requests to Express server
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import {
  initAuthPool,
  setAuth,
  deleteAuth,
  getAuth,
  listProvidersWithAuth,
  hasAuth,
} from '../src/auth/index.js';
import type { Provider, Auth } from '../src/auth/index.js';
import {
  createProviderRouter,
  createAuthRouter,
} from '../src/server/routers/auth.js';

/** Find an available port for the test server */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

let app: Express;
let httpServer: Server;
let PORT: number;
let BASE_URL: string;
let tempDir: string;
let authPath: string;

describe('Auth Module Integration Tests', () => {
  /** Setup test server and temporary directory */
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    authPath = path.join(tempDir, 'auth.json');

    initAuthPool(authPath);

    app = express();
    app.use(express.json());
    app.use('/api/providers', createProviderRouter());
    app.use('/api/auth', createAuthRouter());

    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}`;

    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => resolve());
    });
  });

  /** Cleanup test server and temporary directory */
  afterAll(async () => {
    httpServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /** Tests for Auth Store Functions */
  describe('Auth Store Functions', () => {
    /** Reset auth store before each test */
    beforeEach(() => {
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
      initAuthPool(authPath);
    });

    describe('initAuthPool', () => {
      it('should initialize with empty store when file does not exist', () => {
        const providers = listProvidersWithAuth();
        expect(providers.length).toBeGreaterThan(0);
        expect(providers.every((p) => p.hasAuth === false)).toBe(true);
      });

      it('should load existing auth data from file', () => {
        const existingData: Record<string, Auth> = {
          anthropic: { apiKey: 'sk-test-123' },
          openai: { apiKey: 'sk-openai-456' },
        };
        fs.writeFileSync(authPath, JSON.stringify(existingData));

        initAuthPool(authPath);
        const providers = listProvidersWithAuth();

        expect(providers.find((p) => p.id === 'anthropic')?.hasAuth).toBe(true);
        expect(providers.find((p) => p.id === 'openai')?.hasAuth).toBe(true);
      });
    });

    describe('setAuth', () => {
      it('should set auth for a provider', () => {
        const auth = setAuth('anthropic' as Provider, { apiKey: 'sk-ant-test' });
        expect(auth.apiKey).toBe('sk-ant-test');
      });

      it('should persist auth to file', () => {
        setAuth('openai' as Provider, { apiKey: 'sk-test-key' });

        const fileContent = fs.readFileSync(authPath, 'utf8');
        const data = JSON.parse(fileContent) as Record<string, Auth>;

        expect(data['openai']?.apiKey).toBe('sk-test-key');
      });

      it('should overwrite existing auth', () => {
        setAuth('anthropic' as Provider, { apiKey: 'key1' });
        setAuth('anthropic' as Provider, { apiKey: 'key2' });

        const auth = getAuth('anthropic' as Provider);
        expect(auth?.apiKey).toBe('key2');
      });
    });

    describe('getAuth', () => {
      it('should return auth for existing provider', () => {
        setAuth('anthropic' as Provider, { apiKey: 'secret-key' });

        const auth = getAuth('anthropic' as Provider);
        expect(auth).toBeDefined();
        expect(auth?.apiKey).toBe('secret-key');
      });

      it('should return undefined for non-existent provider', () => {
        const auth = getAuth('anthropic' as Provider);
        expect(auth).toBeUndefined();
      });
    });

    describe('hasAuth', () => {
      it('should return true for existing auth', () => {
        setAuth('openai' as Provider, { apiKey: 'key' });
        expect(hasAuth('openai' as Provider)).toBe(true);
      });

      it('should return false for non-existent auth', () => {
        expect(hasAuth('openai' as Provider)).toBe(false);
      });
    });

    describe('deleteAuth', () => {
      it('should delete auth for existing provider', () => {
        setAuth('anthropic' as Provider, { apiKey: 'key' });
        expect(hasAuth('anthropic' as Provider)).toBe(true);

        deleteAuth('anthropic' as Provider);

        expect(hasAuth('anthropic' as Provider)).toBe(false);
        expect(getAuth('anthropic' as Provider)).toBeUndefined();
      });

      it('should throw error for non-existent provider', () => {
        expect(() => deleteAuth('anthropic' as Provider)).toThrow(
          'Auth not found'
        );
      });

      it('should persist deletion to file', () => {
        setAuth('openai' as Provider, { apiKey: 'key' });
        deleteAuth('openai' as Provider);

        const fileContent = fs.readFileSync(authPath, 'utf8');
        const data = JSON.parse(fileContent) as Record<string, Auth>;

        expect(Object.keys(data).length).toBe(0);
      });
    });

    describe('listProvidersWithAuth', () => {
      it('should return all providers with correct status', () => {
        setAuth('anthropic' as Provider, { apiKey: 'key1' });
        setAuth('openai' as Provider, { apiKey: 'key2' });

        const list = listProvidersWithAuth();

        expect(list.length).toBeGreaterThan(0);
        expect(list.find((p) => p.id === 'anthropic')?.hasAuth).toBe(true);
        expect(list.find((p) => p.id === 'openai')?.hasAuth).toBe(true);

        const noAuthProvider = list.find((p) => p.id === 'groq');
        if (noAuthProvider) {
          expect(noAuthProvider.hasAuth).toBe(false);
        }
      });

      it('should include model information for each provider', () => {
        const list = listProvidersWithAuth();
        const openai = list.find((p) => p.id === 'openai');

        expect(openai).toBeDefined();
        expect(openai?.models).toBeDefined();
        expect(Array.isArray(openai?.models)).toBe(true);
      });
    });
  });

  /** Tests for HTTP Provider Routes */
  describe('HTTP API - Provider Routes', () => {
    beforeEach(() => {
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
      initAuthPool(authPath);
    });

    describe('GET /api/providers', () => {
      it('should return all providers with auth status', async () => {
        const response = await fetch(`${BASE_URL}/api/providers`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          providers: Array<{ id: string; hasAuth: boolean }>;
        };
        expect(Array.isArray(data.providers)).toBe(true);
        expect(data.providers.length).toBeGreaterThan(0);
      });

      it('should reflect auth status correctly', async () => {
        await fetch(`${BASE_URL}/api/auth/openai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'test-key' }),
        });

        const response = await fetch(`${BASE_URL}/api/providers`);
        const data = (await response.json()) as {
          providers: Array<{ id: string; hasAuth: boolean }>;
        };

        const openai = data.providers.find((p) => p.id === 'openai');
        expect(openai?.hasAuth).toBe(true);
      });
    });
  });

  /** Tests for HTTP Auth Routes */
  describe('HTTP API - Auth Routes', () => {
    beforeEach(() => {
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
      initAuthPool(authPath);
    });

    describe('PUT /api/auth/:provider', () => {
      it('should create auth for a provider', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/openai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'sk-test-123' }),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as {
          provider: string;
          apiKey: string;
        };
        expect(data.provider).toBe('openai');
        expect(data.apiKey).toBe('sk-test-123');
      });

      it('should return 400 when apiKey is missing', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/openai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(400);
        const data = (await response.json()) as { error: string };
        expect(data.error).toContain('apiKey');
      });

      it('should update existing auth', async () => {
        await fetch(`${BASE_URL}/api/auth/anthropic`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'old-key' }),
        });

        const response = await fetch(`${BASE_URL}/api/auth/anthropic`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'new-key' }),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as { apiKey: string };
        expect(data.apiKey).toBe('new-key');
      });
    });

    describe('GET /api/auth/:provider', () => {
      it('should return auth for existing provider', async () => {
        await fetch(`${BASE_URL}/api/auth/openai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'my-secret-key' }),
        });

        const response = await fetch(`${BASE_URL}/api/auth/openai`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          provider: string;
          apiKey: string;
        };
        expect(data.provider).toBe('openai');
        expect(data.apiKey).toBe('my-secret-key');
      });

      it('should return 404 for non-existent auth', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/nonexistent`);
        expect(response.status).toBe(404);

        const data = (await response.json()) as { error: string };
        expect(data.error).toBeDefined();
      });
    });

    describe('DELETE /api/auth/:provider', () => {
      it('should delete existing auth', async () => {
        await fetch(`${BASE_URL}/api/auth/groq`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'key-to-delete' }),
        });

        const response = await fetch(`${BASE_URL}/api/auth/groq`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(200);

        const data = (await response.json()) as { success: boolean };
        expect(data.success).toBe(true);

        const getResponse = await fetch(`${BASE_URL}/api/auth/groq`);
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent auth', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/nonexistent`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });

    /**
     * Tests for POST /api/auth/:provider/verify
     * Note: These tests only cover error cases that don't require real API calls.
     * Verification with real API keys is not tested to avoid external dependencies.
     */
    describe('POST /api/auth/:provider/verify', () => {
      it('should return error when no API key provided or stored', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/openai/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as { valid: boolean; error: string };
        expect(data.valid).toBe(false);
        expect(data.error).toContain('No API key');
      });

      it('should return error when only empty object provided', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/anthropic/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as { valid: boolean; error: string };
        expect(data.valid).toBe(false);
      });
    });
  });
});
