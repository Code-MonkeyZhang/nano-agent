/**
 * @fileoverview Auth 模块集成测试
 *
 * 测试覆盖两个层级：
 * 1. Auth Store 函数 - 直接测试存储操作
 * 2. HTTP API 路由 - 通过 HTTP 请求测试 Express 服务器
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import {
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

/** 临时测试目录 */
let tempDir: string;
/** 认证配置文件路径 */
let authPath: string;

vi.mock('../src/util/paths.js', () => ({
  getAuthPath: () => authPath,
}));

/**
 * 查找可用端口用于测试服务器
 * @returns 可用的端口号
 */
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

/** Express 应用实例 */
let app: Express;
/** HTTP 服务器实例 */
let httpServer: Server;
/** 测试服务器端口 */
let PORT: number;
/** API 基础 URL */
let BASE_URL: string;

describe('Auth Module Integration Tests', () => {
  /** 初始化测试服务器和临时目录 */
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    authPath = path.join(tempDir, 'auth.json');

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

  /** 清理测试服务器和临时目录 */
  afterAll(async () => {
    httpServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /** Auth Store 函数测试 */
  describe('Auth Store Functions', () => {
    /** 每个测试前重置认证存储 */
    beforeEach(() => {
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
    });

    /** setAuth 函数测试 */
    describe('setAuth', () => {
      /** 测试为提供商设置认证 */
      it('should set auth for a provider', () => {
        const auth = setAuth('anthropic' as Provider, { apiKey: 'sk-ant-test' });
        expect(auth.apiKey).toBe('sk-ant-test');
      });

      /** 测试认证持久化到文件 */
      it('should persist auth to file', () => {
        setAuth('openai' as Provider, { apiKey: 'sk-test-key' });

        const fileContent = fs.readFileSync(authPath, 'utf8');
        const data = JSON.parse(fileContent) as Record<string, Auth>;

        expect(data['openai']?.apiKey).toBe('sk-test-key');
      });

      /** 测试覆盖已存在的认证 */
      it('should overwrite existing auth', () => {
        setAuth('anthropic' as Provider, { apiKey: 'key1' });
        setAuth('anthropic' as Provider, { apiKey: 'key2' });

        const auth = getAuth('anthropic' as Provider);
        expect(auth?.apiKey).toBe('key2');
      });
    });

    /** getAuth 函数测试 */
    describe('getAuth', () => {
      /** 测试获取已存在提供商的认证 */
      it('should return auth for existing provider', () => {
        setAuth('anthropic' as Provider, { apiKey: 'secret-key' });

        const auth = getAuth('anthropic' as Provider);
        expect(auth).toBeDefined();
        expect(auth?.apiKey).toBe('secret-key');
      });

      /** 测试获取不存在提供商的认证返回 undefined */
      it('should return undefined for non-existent provider', () => {
        const auth = getAuth('anthropic' as Provider);
        expect(auth).toBeUndefined();
      });
    });

    /** hasAuth 函数测试 */
    describe('hasAuth', () => {
      /** 测试已存在认证返回 true */
      it('should return true for existing auth', () => {
        setAuth('openai' as Provider, { apiKey: 'key' });
        expect(hasAuth('openai' as Provider)).toBe(true);
      });

      /** 测试不存在认证返回 false */
      it('should return false for non-existent auth', () => {
        expect(hasAuth('openai' as Provider)).toBe(false);
      });
    });

    /** deleteAuth 函数测试 */
    describe('deleteAuth', () => {
      /** 测试删除已存在提供商的认证 */
      it('should delete auth for existing provider', () => {
        setAuth('anthropic' as Provider, { apiKey: 'key' });
        expect(hasAuth('anthropic' as Provider)).toBe(true);

        deleteAuth('anthropic' as Provider);

        expect(hasAuth('anthropic' as Provider)).toBe(false);
        expect(getAuth('anthropic' as Provider)).toBeUndefined();
      });

      /** 测试删除不存在提供商抛出错误 */
      it('should throw error for non-existent provider', () => {
        expect(() => deleteAuth('anthropic' as Provider)).toThrow(
          'Auth not found'
        );
      });

      /** 测试删除操作持久化到文件 */
      it('should persist deletion to file', () => {
        setAuth('openai' as Provider, { apiKey: 'key' });
        deleteAuth('openai' as Provider);

        const fileContent = fs.readFileSync(authPath, 'utf8');
        const data = JSON.parse(fileContent) as Record<string, Auth>;

        expect(Object.keys(data).length).toBe(0);
      });
    });

    /** listProvidersWithAuth 函数测试 */
    describe('listProvidersWithAuth', () => {
      /** 测试返回所有提供商及其认证状态 */
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

      /** 测试每个提供商包含模型信息 */
      it('should include model information for each provider', () => {
        const list = listProvidersWithAuth();
        const openai = list.find((p) => p.id === 'openai');

        expect(openai).toBeDefined();
        expect(openai?.models).toBeDefined();
        expect(Array.isArray(openai?.models)).toBe(true);
      });
    });
  });

  /** HTTP Provider 路由测试 */
  describe('HTTP API - Provider Routes', () => {
    beforeEach(() => {
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
    });

    /** GET /api/providers 测试 */
    describe('GET /api/providers', () => {
      /** 测试返回所有提供商及其认证状态 */
      it('should return all providers with auth status', async () => {
        const response = await fetch(`${BASE_URL}/api/providers`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          providers: Array<{ id: string; hasAuth: boolean }>;
        };
        expect(Array.isArray(data.providers)).toBe(true);
        expect(data.providers.length).toBeGreaterThan(0);
      });

      /** 测试正确反映认证状态 */
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

  /** HTTP Auth 路由测试 */
  describe('HTTP API - Auth Routes', () => {
    beforeEach(() => {
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
    });

    /** PUT /api/auth/:provider 测试 */
    describe('PUT /api/auth/:provider', () => {
      /** 测试为提供商创建认证 */
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

      /** 测试缺少 apiKey 时返回 400 */
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

      /** 测试更新已存在的认证 */
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

    /** GET /api/auth/:provider 测试 */
    describe('GET /api/auth/:provider', () => {
      /** 测试获取已存在提供商的认证 */
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

      /** 测试获取不存在的认证返回 404 */
      it('should return 404 for non-existent auth', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/nonexistent`);
        expect(response.status).toBe(404);

        const data = (await response.json()) as { error: string };
        expect(data.error).toBeDefined();
      });
    });

    /** DELETE /api/auth/:provider 测试 */
    describe('DELETE /api/auth/:provider', () => {
      /** 测试删除已存在的认证 */
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

      /** 测试删除不存在的认证返回 404 */
      it('should return 404 for non-existent auth', async () => {
        const response = await fetch(`${BASE_URL}/api/auth/nonexistent`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });

    /**
     * POST /api/auth/:provider/verify 测试
     * 注意：这些测试仅覆盖不需要真实 API 调用的错误情况。
     * 不使用真实 API key 进行验证测试，以避免外部依赖。
     */
    describe('POST /api/auth/:provider/verify', () => {
      /** 测试无 API key 时返回错误 */
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

      /** 测试仅提供空对象时返回错误 */
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
