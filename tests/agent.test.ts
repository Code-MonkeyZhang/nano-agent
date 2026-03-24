/**
 * @fileoverview Agent 模块集成测试
 * 测试 Agent 配置的 CRUD 操作和 HTTP API 路由
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  mock,
} from 'bun:test';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import type { AgentConfig, AgentConfigInput } from '../src/agent/index.js';
import type { SessionManagersMap } from '../src/server/routers/agent.js';

/** 临时目录路径 */
let tempDir: string;
/** Agent 配置存储目录 */
let agentsDir: string;

/** Mock 路径模块，使用临时目录 */
mock.module('../src/util/paths.js', () => ({
  getAgentsDir: () => agentsDir,
}));

import {
  listAgentConfigs,
  getAgentConfig,
  createAgentConfig,
  updateAgentConfig,
  deleteAgentConfig,
  hasAgentConfig,
  getAgentDirPath,
} from '../src/agent/index.js';
import { createAgentRouter } from '../src/server/routers/agent.js';

/** 查找可用端口，避免端口冲突 */
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
/** 服务器端口 */
let PORT: number;
/** HTTP API 基础 URL */
let BASE_URL: string;
/** Agent-Session 管理器映射 */
let sessionManagers: SessionManagersMap;

/** 默认模型配置 */
const defaultModel = { provider: 'openai', model: 'gpt-4' };

/**
 * 创建测试 Agent 配置
 * @param overrides - 覆盖默认配置的字段
 * @returns Agent 配置对象
 */
function createTestAgentInput(
  overrides: Partial<AgentConfigInput> = {}
): AgentConfigInput {
  return {
    name: 'Test Agent',
    systemPrompt: 'You are a helpful assistant.',
    defaultModel,
    maxSteps: 10,
    ...overrides,
  };
}

describe('Agent Module Integration Tests', () => {
  /** 初始化测试环境：创建临时目录、启动服务器 */
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
    agentsDir = path.join(tempDir, 'agents');

    sessionManagers = new Map();
    app = express();
    app.use(express.json());
    app.use('/api/agents', createAgentRouter(sessionManagers));

    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}`;

    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => resolve());
    });
  });

  /** 清理测试环境：关闭服务器、删除临时目录 */
  afterAll(async () => {
    httpServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /** 测试套件：Agent Store 函数（直接调用，无 HTTP） */
  describe('Agent Store Functions', () => {
    /** 每个测试前清理 Agent 目录 */
    beforeEach(() => {
      if (fs.existsSync(agentsDir)) {
        fs.rmSync(agentsDir, { recursive: true, force: true });
      }
    });

    describe('createAgentConfig', () => {
      /** 测试：自动生成 ID 创建 Agent */
      it('should create an agent with auto-generated ID', () => {
        const input = createTestAgentInput();
        const agent = createAgentConfig(input);

        expect(agent.id).toBeDefined();
        expect(agent.name).toBe('Test Agent');
        expect(agent.systemPrompt).toBe('You are a helpful assistant.');
        expect(agent.defaultModel).toEqual(defaultModel);
        expect(agent.createdAt).toBe(agent.updatedAt);
      });

      /** 测试：Agent 持久化到文件系统 */
      it('should persist agent to file', () => {
        const agent = createAgentConfig(createTestAgentInput());

        const configPath = path.join(agentsDir, agent.id, 'config.json');
        expect(fs.existsSync(configPath)).toBe(true);

        const content = fs.readFileSync(configPath, 'utf8');
        const saved = JSON.parse(content) as AgentConfig;
        expect(saved.name).toBe('Test Agent');
      });

      /** 测试：创建 Agent 目录结构 */
      it('should create agent directory structure', () => {
        const agent = createAgentConfig(createTestAgentInput());

        const agentDir = path.join(agentsDir, agent.id);
        expect(fs.existsSync(agentDir)).toBe(true);
        expect(fs.statSync(agentDir).isDirectory()).toBe(true);
      });
    });

    describe('getAgentConfig', () => {
      /** 测试：获取已存在的 Agent 配置 */
      it('should return agent config for existing agent', () => {
        const created = createAgentConfig(createTestAgentInput());

        const agent = getAgentConfig(created.id);
        expect(agent).toBeDefined();
        expect(agent?.name).toBe('Test Agent');
      });

      /** 测试：获取不存在的 Agent 返回 undefined */
      it('should return undefined for non-existent agent', () => {
        const agent = getAgentConfig('non-existent');
        expect(agent).toBeUndefined();
      });
    });

    describe('hasAgentConfig', () => {
      /** 测试：已存在的 Agent 返回 true */
      it('should return true for existing agent', () => {
        const agent = createAgentConfig(createTestAgentInput());
        expect(hasAgentConfig(agent.id)).toBe(true);
      });

      /** 测试：不存在的 Agent 返回 false */
      it('should return false for non-existent agent', () => {
        expect(hasAgentConfig('non-existent')).toBe(false);
      });
    });

    describe('listAgentConfigs', () => {
      /** 测试：无 Agent 时返回空数组 */
      it('should return empty array when no agents exist', () => {
        const agents = listAgentConfigs();
        expect(agents).toEqual([]);
      });

      /** 测试：返回所有 Agent 列表 */
      it('should return all agents', () => {
        createAgentConfig(createTestAgentInput({ name: 'Agent 1' }));
        createAgentConfig(createTestAgentInput({ name: 'Agent 2' }));

        const agents = listAgentConfigs();
        expect(agents.length).toBe(2);
        expect(agents.map((a) => a.name).sort()).toEqual(['Agent 1', 'Agent 2']);
      });
    });

    describe('updateAgentConfig', () => {
      /** 测试：更新 Agent 名称 */
      it('should update agent name', () => {
        const agent = createAgentConfig(createTestAgentInput());
        const updated = updateAgentConfig(
          agent.id,
          createTestAgentInput({ name: 'Updated Name' })
        );

        expect(updated.name).toBe('Updated Name');
        expect(updated.updatedAt).toBeGreaterThanOrEqual(updated.createdAt);
      });

      /** 测试：更新不存在的 Agent 抛出错误 */
      it('should throw error for non-existent agent', () => {
        expect(() =>
          updateAgentConfig('non-existent', createTestAgentInput({ name: 'New Name' }))
        ).toThrow('Agent not found');
      });

      /** 测试：更新时保留不可变字段 */
      it('should preserve immutable fields', () => {
        const created = createAgentConfig(createTestAgentInput());
        const updated = updateAgentConfig(
          created.id,
          createTestAgentInput({ name: 'New Name' })
        );

        expect(updated.id).toBe(created.id);
        expect(updated.createdAt).toBe(created.createdAt);
      });
    });

    describe('deleteAgentConfig', () => {
      /** 测试：删除 Agent 配置 */
      it('should delete agent directory', () => {
        const agent = createAgentConfig(createTestAgentInput());
        expect(hasAgentConfig(agent.id)).toBe(true);

        deleteAgentConfig(agent.id);
        expect(hasAgentConfig(agent.id)).toBe(false);
      });

      /** 测试：删除 Agent 时移除整个目录 */
      it('should remove entire agent directory', () => {
        const agent = createAgentConfig(createTestAgentInput());
        const agentDir = getAgentDirPath(agent.id);
        expect(fs.existsSync(agentDir)).toBe(true);

        deleteAgentConfig(agent.id);
        expect(fs.existsSync(agentDir)).toBe(false);
      });
    });
  });

  /** 测试套件：HTTP API 路由（集成测试） */
  describe('HTTP API - Agent Routes', () => {
    /** 每个测试前清理 Agent 目录和 Session 管理器 */
    beforeEach(() => {
      if (fs.existsSync(agentsDir)) {
        fs.rmSync(agentsDir, { recursive: true, force: true });
      }
      sessionManagers.clear();
    });

    describe('GET /api/agents', () => {
      /** 测试：无 Agent 时返回空数组 */
      it('should return empty array when no agents exist', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as { agents: AgentConfig[] };
        expect(data.agents).toEqual([]);
      });

      /** 测试：返回所有 Agent 列表 */
      it('should return all agents', async () => {
        await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput({ name: 'Agent A' })),
        });
        await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput({ name: 'Agent B' })),
        });

        const response = await fetch(`${BASE_URL}/api/agents`);
        const data = (await response.json()) as { agents: AgentConfig[] };
        expect(data.agents.length).toBe(2);
      });
    });

    describe('POST /api/agents', () => {
      /** 测试：创建新 Agent */
      it('should create a new agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput()),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as { agent: AgentConfig };
        expect(data.agent.name).toBe('Test Agent');
        expect(data.agent.id).toBeDefined();
      });

      /** 测试：缺少必填字段返回 400 */
      it('should return 400 when required fields are missing', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Incomplete Agent' }),
        });

        expect(response.status).toBe(400);
        const data = (await response.json()) as { error: unknown };
        expect(Array.isArray(data.error)).toBe(true);
      });

      /** 测试：创建 Agent 时注册 Session 管理器 */
      it('should register session manager for new agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput()),
        });
        const { agent } = (await response.json()) as { agent: AgentConfig };

        expect(sessionManagers.has(agent.id)).toBe(true);
      });
    });

    describe('GET /api/agents/:id', () => {
      /** 测试：根据 ID 获取 Agent */
      it('should return agent by ID', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput()),
        });
        const { agent: created } = (await createResponse.json()) as { agent: AgentConfig };

        const response = await fetch(`${BASE_URL}/api/agents/${created.id}`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as { agent: AgentConfig };
        expect(data.agent.id).toBe(created.id);
      });

      /** 测试：不存在的 Agent 返回 404 */
      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/non-existent`);
        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/agents/:id', () => {
      /** 测试：更新 Agent 配置 */
      it('should update agent', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput()),
        });
        const { agent: created } = (await createResponse.json()) as { agent: AgentConfig };

        const response = await fetch(`${BASE_URL}/api/agents/${created.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput({ name: 'Updated via HTTP' })),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as { agent: AgentConfig };
        expect(data.agent.name).toBe('Updated via HTTP');
      });

      /** 测试：更新不存在的 Agent 返回 404 */
      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/non-existent`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput({ name: 'New Name' })),
        });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/agents/:id', () => {
      /** 测试：删除 Agent */
      it('should delete agent', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput()),
        });
        const { agent: created } = (await createResponse.json()) as { agent: AgentConfig };

        const response = await fetch(`${BASE_URL}/api/agents/${created.id}`, {
          method: 'DELETE',
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as { success: boolean };
        expect(data.success).toBe(true);

        const getResponse = await fetch(`${BASE_URL}/api/agents/${created.id}`);
        expect(getResponse.status).toBe(404);
      });

      /** 测试：删除 Agent 时移除 Session 管理器 */
      it('should remove session manager when agent deleted', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createTestAgentInput()),
        });
        const { agent: created } = (await createResponse.json()) as { agent: AgentConfig };
        expect(sessionManagers.has(created.id)).toBe(true);

        await fetch(`${BASE_URL}/api/agents/${created.id}`, { method: 'DELETE' });
        expect(sessionManagers.has(created.id)).toBe(false);
      });

      /** 测试：删除不存在的 Agent 返回 404 */
      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/non-existent`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });
  });
});
