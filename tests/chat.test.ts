/**
 * @fileoverview Chat 模块集成测试
 * 测试 HTTP Chat API、WebSocket 事件推送、Session 消息持久化
 * 使用真实 MiniMax-CN API 进行端到端测试
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
import { WebSocket } from 'ws';
import { createAgentRouter, type SessionManagersMap } from '../src/server/routers/agent.js';
import { createSessionRouter } from '../src/server/routers/session.js';
import { createChatRouter } from '../src/server/routers/chat.js';
import { createProviderRouter, createAuthRouter } from '../src/server/routers/auth.js';
import { initWebSocket, shutdownWebSocket } from '../src/server/websocket-server.js';
import type { AgentConfig, AgentConfigInput } from '../src/agent/index.js';
import type { Session } from '../src/session/types.js';

/** 测试配置：MiniMax-CN 提供商 */
const TEST_CONFIG = {
  provider: 'minimax-cn' as const,
  model: 'MiniMax-M2.7',
  apiKey: 'sk-cp-TPbFwVulpXO8EpjZjm2qikmRs36g7ymD1HpUo9vTjq-Jm2C0bfhvq1V2vmj-bsh2sIDqV6KvUk9k7yQeUMDEitoFHGBpVrR3y970LVQIGGvgfScaVWvX6AM',
  timeout: 60000,
};

/** 临时目录路径 */
let tempDir: string;
/** Agent 配置存储目录 */
let agentsDir: string;
/** 认证信息存储路径 */
let authPath: string;

/** Mock 路径模块，使用临时目录 */
mock.module('../src/util/paths.js', () => ({
  getAgentsDir: () => agentsDir,
  getAuthPath: () => authPath,
}));

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
/** WebSocket 连接 URL */
let WS_URL: string;
/** Agent-Session 管理器映射 */
let sessionManagers: SessionManagersMap;

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
    systemPrompt: 'You are a helpful assistant. Keep responses brief.',
    defaultModel: { provider: TEST_CONFIG.provider, model: TEST_CONFIG.model },
    maxSteps: 3,
    mcpNames: [],
    skillNames: [],
    ...overrides,
  };
}

/** 设置 API 认证信息 */
async function setupAuth(): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/${TEST_CONFIG.provider}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: TEST_CONFIG.apiKey }),
  });
}

/** 创建测试 Agent 并返回 ID */
async function createTestAgent(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createTestAgentInput()),
  });
  const { agent } = (await response.json()) as { agent: AgentConfig };
  return agent.id;
}

/**
 * 创建测试 Session
 * @param agentId - Agent ID
 * @returns Session ID
 */
async function createTestSession(agentId: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/agents/${agentId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Chat Session' }),
  });
  const { session } = (await response.json()) as { session: Session };
  return session.id;
}

describe('Chat Module Integration Tests', () => {
  /** 初始化测试环境：创建临时目录、启动服务器 */
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-test-'));
    agentsDir = path.join(tempDir, 'agents');
    authPath = path.join(tempDir, 'auth.json');

    sessionManagers = new Map();
    app = express();
    app.use(express.json());

    app.use('/api/providers', createProviderRouter());
    app.use('/api/auth', createAuthRouter());
    app.use('/api/agents', createAgentRouter(sessionManagers));
    app.use('/api/agents/:agentId/sessions', createSessionRouter(sessionManagers));
    app.use('/api/agents/:agentId/sessions/:sessionId/chat', createChatRouter(sessionManagers));

    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}`;
    WS_URL = `ws://localhost:${PORT}/ws`;

    httpServer = createServer(app);
    initWebSocket(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => resolve());
    });
  });

  /** 清理测试环境：关闭服务器、删除临时目录 */
  afterAll(async () => {
    shutdownWebSocket();
    httpServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('HTTP API - Chat Routes', () => {
    let agentId: string;
    let sessionId: string;

    /** 每个测试前：清理数据、设置认证、创建 Agent 和 Session */
    beforeEach(async () => {
      if (fs.existsSync(agentsDir)) {
        fs.rmSync(agentsDir, { recursive: true, force: true });
      }
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
      sessionManagers.clear();

      await setupAuth();
      agentId = await createTestAgent();
      sessionId = await createTestSession(agentId);
    });

    describe('POST /api/agents/:agentId/sessions/:sessionId/chat', () => {
      /** 测试：发送消息并接收响应 */
      it(
        'should send a message and receive response',
        async () => {
          const response = await fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: 'Say hello in one word.' }),
            }
          );

          expect(response.status).toBe(200);
          const data = (await response.json()) as {
            success: boolean;
            error?: string;
          };

          expect(data.success).toBe(true);
        },
        TEST_CONFIG.timeout
      );

      /** 测试：多轮对话，验证 AI 能记住上下文 */
      it(
        'should handle multi-turn conversation',
        async () => {
          const response1 = await fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: 'My name is Alice. Remember it.' }),
            }
          );

          expect(response1.status).toBe(200);
          const data1 = (await response1.json()) as { success: boolean };
          expect(data1.success).toBe(true);

          const response2 = await fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: 'What is my name?' }),
            }
          );

          expect(response2.status).toBe(200);
          const data2 = (await response2.json()) as { success: boolean };
          expect(data2.success).toBe(true);

          // 验证消息已持久化到 session
          const sessionResponse = await fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}`
          );
          const { session } = (await sessionResponse.json()) as { session: Session };
          
          // 检查最后一条 assistant 消息是否包含 Alice
          const lastAssistantMsg = [...session.messages]
            .reverse()
            .find((m) => m.role === 'assistant');
          expect(lastAssistantMsg?.content?.toLowerCase()).toContain('alice');
        },
        TEST_CONFIG.timeout
      );

      /** 测试：消息持久化到 Session */
      it(
        'should persist messages to session',
        async () => {
          await fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: 'Hello' }),
            }
          );

          const sessionResponse = await fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}`
          );
          const { session } = (await sessionResponse.json()) as { session: Session };

          expect(session.messageCount).toBeGreaterThan(0);
          expect(session.messages.length).toBeGreaterThan(0);
          expect(session.messages.some((m) => m.role === 'user')).toBe(true);
          expect(session.messages.some((m) => m.role === 'assistant')).toBe(true);
        },
        TEST_CONFIG.timeout
      );

      /** 测试：首次对话正常完成 */

      /** 测试：缺少 content 字段返回 400 */
      it('should return 400 when content is missing', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }
        );

        expect(response.status).toBe(400);
        const data = (await response.json()) as { error?: string };
        expect(data.error).toContain('Content is required');
      });

      /** 测试：空字符串 content 返回 400 */
      it('should return 400 when content is empty string', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '' }),
          }
        );

        expect(response.status).toBe(400);
      });

      /** 测试：不存在的 Agent 返回 404 */
      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/non-existent/sessions/${sessionId}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Hello' }),
          }
        );

        expect(response.status).toBe(404);
      });

      /** 测试：不存在的 Session 返回错误 */
      it('should return error for non-existent session', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/${agentId}/sessions/non-existent/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Hello' }),
          }
        );

        expect(response.status).toBe(500);
        const data = (await response.json()) as { success: boolean };
        expect(data.success).toBe(false);
      });
    });

    describe('Chat without API key', () => {
      /** 测试：未配置 API Key 时返回错误 */
      it(
        'should return error when API key is not configured',
        async () => {
          const noAuthAgentId = await (async () => {
            const response = await fetch(`${BASE_URL}/api/agents`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...createTestAgentInput(),
                id: 'no-auth-agent',
              }),
            });
            const { agent } = (await response.json()) as { agent: AgentConfig };
            return agent.id;
          })();

          const noAuthSessionId = await createTestSession(noAuthAgentId);

          await fetch(`${BASE_URL}/api/auth/${TEST_CONFIG.provider}`, {
            method: 'DELETE',
          });

          const response = await fetch(
            `${BASE_URL}/api/agents/${noAuthAgentId}/sessions/${noAuthSessionId}/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: 'Hello' }),
            }
          );

          expect(response.status).toBe(500);
          const data = (await response.json()) as { success: boolean; error?: string };
          expect(data.success).toBe(false);
          expect(data.error).toContain('API key');
        },
        TEST_CONFIG.timeout
      );
    });
  });

  describe('WebSocket Events', () => {
    let agentId: string;
    let sessionId: string;
    let ws: WebSocket;

    /** 每个测试前：清理数据、设置认证、创建 Agent 和 Session */
    beforeEach(async () => {
      if (fs.existsSync(agentsDir)) {
        fs.rmSync(agentsDir, { recursive: true, force: true });
      }
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
      sessionManagers.clear();

      await setupAuth();
      agentId = await createTestAgent();
      sessionId = await createTestSession(agentId);
    });

    /** 测试：通过 WebSocket 接收 step_complete 和 complete 事件 */
    it(
      'should receive step_complete and complete events via WebSocket',
      async () => {
        const receivedEvents: string[] = [];

        await new Promise<void>((resolve, reject) => {
          ws = new WebSocket(WS_URL);

          ws.on('open', () => {
            ws.send(JSON.stringify({
              type: 'subscribe',
              payload: { sessionId },
            }));
          });

          ws.on('message', (data: Buffer) => {
            const message = JSON.parse(data.toString()) as { type: string; sessionId?: string };
            receivedEvents.push(message.type);

            if (message.type === 'complete') {
              ws.close();
              resolve();
            }
          });

          ws.on('error', reject);

          ws.on('close', () => {
            if (!receivedEvents.includes('complete')) {
              reject(new Error('WebSocket closed without complete event'));
            }
          });

          setTimeout(() => {
            fetch(
              `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Say hi' }),
              }
            ).catch(reject);
          }, 100);
        });

        expect(receivedEvents).toContain('connected');
        expect(receivedEvents).toContain('subscribed');
        expect(receivedEvents).toContain('step_complete');
        expect(receivedEvents).toContain('complete');
      },
      TEST_CONFIG.timeout
    );

    /** 测试：多个 WebSocket 客户端同时订阅同一 Session */
    it(
      'should handle multiple WebSocket clients',
      async () => {
      const client1Events: string[] = [];
      const client2Events: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const ws1 = new WebSocket(WS_URL);
        const ws2 = new WebSocket(WS_URL);

        let completed = 0;

        const checkComplete = () => {
          completed++;
          if (completed === 2) {
            ws1.close();
            ws2.close();
            resolve();
          }
        };

        ws1.on('open', () => {
          ws1.send(JSON.stringify({ type: 'subscribe', payload: { sessionId } }));
        });

        ws2.on('open', () => {
          ws2.send(JSON.stringify({ type: 'subscribe', payload: { sessionId } }));
        });

        ws1.on('message', (data: Buffer) => {
          const msg = JSON.parse(data.toString()) as { type: string };
          client1Events.push(msg.type);
          if (msg.type === 'complete') checkComplete();
        });

        ws2.on('message', (data: Buffer) => {
          const msg = JSON.parse(data.toString()) as { type: string };
          client2Events.push(msg.type);
          if (msg.type === 'complete') checkComplete();
        });

        setTimeout(() => {
          fetch(
            `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: 'Hi' }),
            }
          ).catch(reject);
        }, 100);
      });

      expect(client1Events).toContain('step_complete');
      expect(client2Events).toContain('step_complete');
    },
    TEST_CONFIG.timeout
  );
  });

  describe('Session Persistence', () => {
    let agentId: string;

    /** 每个测试前：清理数据、设置认证、创建 Agent */
    beforeEach(async () => {
      if (fs.existsSync(agentsDir)) {
        fs.rmSync(agentsDir, { recursive: true, force: true });
      }
      if (fs.existsSync(authPath)) {
        fs.unlinkSync(authPath);
      }
      sessionManagers.clear();

      await setupAuth();
      agentId = await createTestAgent();
    });

    /** 测试：消息跨请求持久化 */
    it(
      'should persist messages across sessions',
      async () => {
        const sessionId = await createTestSession(agentId);

        await fetch(
          `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'First message' }),
          }
        );

        await fetch(
          `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Second message' }),
          }
        );

        const sessionResponse = await fetch(
          `${BASE_URL}/api/agents/${agentId}/sessions/${sessionId}`
        );
        const { session } = (await sessionResponse.json()) as { session: Session };

        expect(session.messageCount).toBeGreaterThanOrEqual(4);
        expect(session.messages.length).toBeGreaterThanOrEqual(4);

        const userMessages = session.messages.filter((m) => m.role === 'user');
        expect(userMessages.length).toBe(2);
      },
      TEST_CONFIG.timeout * 2
    );
  });
});
