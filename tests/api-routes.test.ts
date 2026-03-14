import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import { initCredentialPool } from '../src/credential/index.js';
import { initAgentConfigStore } from '../src/agent-config/index.js';
import { initBuiltinToolPool } from '../src/builtin-tool-pool/store.js';
import { initMcpPool } from '../src/mcp-pool/store.js';
import { initSkillPool } from '../src/skill-pool/index.js';
import { createCredentialRouter } from '../src/server/credential-router.js';
import { createAgentRouter } from '../src/server/agent-router.js';
import { createBuiltinToolRouter } from '../src/server/builtin-tool-router.js';
import { createMcpRouter } from '../src/server/mcp-router.js';
import { createSkillRouter } from '../src/server/skill-router.js';
import { createSessionRouter } from '../src/server/sessions.js';
import { SessionStore } from '../src/session/store.js';
import { SessionManager } from '../src/session/manager.js';

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
let credentialPath: string;
let agentsPath: string;
let skillsPath: string;
let mcpConfigPath: string;
let workspacePath: string;
let sessionStore: SessionStore;
let sessionManager: SessionManager;

describe('Phase 8: HTTP API Tests', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-routes-test-'));
    credentialPath = path.join(tempDir, 'credentials.json');
    agentsPath = path.join(tempDir, 'agents');
    skillsPath = path.join(tempDir, 'skills');
    mcpConfigPath = path.join(tempDir, 'mcp.json');
    workspacePath = path.join(tempDir, 'workspace');
    const sessionsPath = path.join(tempDir, 'sessions');

    fs.mkdirSync(agentsPath, { recursive: true });
    fs.mkdirSync(skillsPath, { recursive: true });
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(sessionsPath, { recursive: true });

    fs.writeFileSync(
      mcpConfigPath,
      JSON.stringify({
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      })
    );

    initCredentialPool(credentialPath);
    initAgentConfigStore(agentsPath);
    initBuiltinToolPool(workspacePath);
    initSkillPool(skillsPath);
    await initMcpPool(mcpConfigPath);

    // Create session store and manager for tests
    sessionStore = new SessionStore(sessionsPath);
    sessionManager = new SessionManager(sessionStore, 'adam');

    app = express();
    app.use(express.json());

    app.use('/api/credentials', createCredentialRouter());
    app.use('/api/agents', createAgentRouter());
    app.use('/api/builtin-tools', createBuiltinToolRouter());
    app.use('/api/mcp', createMcpRouter());
    app.use('/api/skills', createSkillRouter());
    app.use('/api/agents/adam/sessions', createSessionRouter(sessionManager));

    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}`;

    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => resolve());
    });
  });

  afterAll(async () => {
    httpServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('8.1 Credential Management API', () => {
    describe('PUT /api/credentials/:provider', () => {
      it('should create a credential', async () => {
        const response = await fetch(`${BASE_URL}/api/credentials/openai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: 'sk-test-1234567890',
          }),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as { provider: string; apiKey: string };
        expect(data.provider).toBe('openai');
        expect(data.apiKey).toContain('***');
      });

      it('should return masked API key in response', async () => {
        const response = await fetch(`${BASE_URL}/api/credentials/anthropic`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: 'sk-ant-1234567890abcdefghijklmnop',
          }),
        });

        const data = (await response.json()) as {
          provider: string;
          apiKey: string;
        };
        expect(data.apiKey).not.toBe('sk-ant-1234567890abcdefghijklmnop');
        expect(data.apiKey).toContain('***');
      });
    });

    describe('GET /api/credentials/', () => {
      it('should list all providers with credential status', async () => {
        const response = await fetch(`${BASE_URL}/api/credentials/`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          providers: Array<{ provider: string; hasCredential: boolean }>;
        };
        expect(Array.isArray(data.providers)).toBe(true);
      });
    });

    describe('GET /api/credentials/:provider', () => {
      it('should return a single credential with masked API key', async () => {
        await fetch(`${BASE_URL}/api/credentials/openai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: 'secret-key-12345',
          }),
        });

        const response = await fetch(`${BASE_URL}/api/credentials/openai`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          provider: string;
          apiKey: string;
        };
        expect(data.provider).toBe('openai');
        expect(data.apiKey).toContain('***');
      });

      it('should return 404 for non-existent credential', async () => {
        const response = await fetch(`${BASE_URL}/api/credentials/nonexistent-provider`);
        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/credentials/:provider', () => {
      it('should delete a credential', async () => {
        await fetch(`${BASE_URL}/api/credentials/groq`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: 'key-to-delete',
          }),
        });

        const response = await fetch(`${BASE_URL}/api/credentials/groq`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(200);

        const getResponse = await fetch(`${BASE_URL}/api/credentials/groq`);
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent credential', async () => {
        const response = await fetch(`${BASE_URL}/api/credentials/nonexistent-provider`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.2 Agent Configuration Management API', () => {
    beforeEach(async () => {
      await fetch(`${BASE_URL}/api/credentials/openai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-key',
        }),
      });
    });

    describe('POST /api/agents', () => {
      it('should create an agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'test-agent-1',
            name: 'Test Agent',
            systemPrompt: 'You are a test agent.',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 10,
            mcpIds: [],
            skillIds: [],
          }),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as {
          agent: { id: string; name: string };
        };
        expect(data.agent.id).toBe('test-agent-1');
        expect(data.agent.name).toBe('Test Agent');
      });

      it('should create an agent with MCP and Skill IDs', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'test-agent-with-tools',
            name: 'Agent with Tools',
            systemPrompt: 'Test',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 5,
            mcpIds: ['ticktick', 'notion'],
            skillIds: ['skill:code-review'],
          }),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as {
          agent: { mcpIds: string[]; skillIds: string[] };
        };
        expect(data.agent.mcpIds).toEqual(['ticktick', 'notion']);
        expect(data.agent.skillIds).toEqual(['skill:code-review']);
      });

      it('should reject duplicate agent ID', async () => {
        await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'duplicate-agent',
            name: 'First',
            systemPrompt: 'Test',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 5,
            mcpIds: [],
            skillIds: [],
          }),
        });

        const response = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'duplicate-agent',
            name: 'Second',
            systemPrompt: 'Test',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 5,
            mcpIds: [],
            skillIds: [],
          }),
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/agents', () => {
      it('should list all agents', async () => {
        const response = await fetch(`${BASE_URL}/api/agents`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as { agents: unknown[] };
        expect(Array.isArray(data.agents)).toBe(true);
      });
    });

    describe('GET /api/agents/:id', () => {
      it('should return a single agent', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'get-test-agent',
            name: 'Get Test Agent',
            systemPrompt: 'Test prompt',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 10,
            mcpIds: [],
            skillIds: [],
          }),
        });

        expect(createResponse.status).toBe(201);

        const response = await fetch(`${BASE_URL}/api/agents/get-test-agent`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          agent: { name: string; modelId: string };
        };
        expect(data.agent.name).toBe('Get Test Agent');
        expect(data.agent.modelId).toBe('gpt-4o');
      });

      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/non-existent`);
        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/agents/:id', () => {
      it('should update an agent', async () => {
        await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'update-test-agent',
            name: 'Original',
            systemPrompt: 'Original prompt',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 5,
            mcpIds: [],
            skillIds: [],
          }),
        });

        const response = await fetch(`${BASE_URL}/api/agents/update-test-agent`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated',
            maxSteps: 20,
          }),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as {
          agent: { name: string; maxSteps: number };
        };
        expect(data.agent.name).toBe('Updated');
        expect(data.agent.maxSteps).toBe(20);
      });

      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/non-existent`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        });
        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/agents/:id', () => {
      it('should delete an agent', async () => {
        await fetch(`${BASE_URL}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'delete-test-agent',
            name: 'To Delete',
            systemPrompt: 'Test',
            provider: 'openai',
            modelId: 'gpt-4o',
            maxSteps: 5,
            mcpIds: [],
            skillIds: [],
          }),
        });

        const response = await fetch(`${BASE_URL}/api/agents/delete-test-agent`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(200);

        const getResponse = await fetch(`${BASE_URL}/api/agents/delete-test-agent`);
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent agent', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/non-existent`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.3 Built-in Tool Query API', () => {
    describe('GET /api/builtin-tools', () => {
      it('should list all built-in tools', async () => {
        const response = await fetch(`${BASE_URL}/api/builtin-tools`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          tools: Array<{ id: string; name: string }>;
        };
        expect(Array.isArray(data.tools)).toBe(true);
        expect(data.tools.length).toBeGreaterThan(0);
      });

      it('should include standard tools like read, write, edit, bash', async () => {
        const response = await fetch(`${BASE_URL}/api/builtin-tools`);
        const data = (await response.json()) as {
          tools: Array<{ id: string }>;
        };
        const toolIds = data.tools.map((t) => t.id);

        expect(toolIds).toContain('builtin:read');
        expect(toolIds).toContain('builtin:write');
        expect(toolIds).toContain('builtin:edit');
        expect(toolIds).toContain('builtin:bash');
      });
    });

    describe('GET /api/builtin-tools/:id', () => {
      it('should return a single tool', async () => {
        const response = await fetch(`${BASE_URL}/api/builtin-tools/builtin:read`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          tool: { id: string; name: string };
        };
        expect(data.tool.id).toBe('builtin:read');
        expect(data.tool.name).toBe('read_file');
      });

      it('should return 404 for non-existent tool', async () => {
        const response = await fetch(
          `${BASE_URL}/api/builtin-tools/builtin:nonexistent`
        );
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.4 MCP Management API', () => {
    describe('GET /api/mcp', () => {
      it('should list all MCP servers with status', async () => {
        const response = await fetch(`${BASE_URL}/api/mcp`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          servers: Array<{ name: string; status: string }>;
        };
        expect(Array.isArray(data.servers)).toBe(true);
      });
    });

    describe('GET /api/mcp/:name', () => {
      it('should return a single MCP server', async () => {
        const response = await fetch(`${BASE_URL}/api/mcp/test-server`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          server: { name: string; status: string };
        };
        expect(data.server.name).toBe('test-server');
      });

      it('should return 404 for non-existent MCP server', async () => {
        const response = await fetch(`${BASE_URL}/api/mcp/non-existent`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.5 Skill Management API', () => {
    describe('GET /api/skills', () => {
      it('should list all skills', async () => {
        const response = await fetch(`${BASE_URL}/api/skills`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as { skills: unknown[] };
        expect(Array.isArray(data.skills)).toBe(true);
      });
    });

    describe('GET /api/skills/:id', () => {
      it('should return 404 for non-existent skill', async () => {
        const response = await fetch(`${BASE_URL}/api/skills/skill:nonexistent`);
        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/skills/:id/reload', () => {
      it('should return 404 for non-existent skill', async () => {
        const response = await fetch(`${BASE_URL}/api/skills/skill:nonexistent/reload`, {
          method: 'POST',
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.6 Session Management API', () => {
    let testAgentId: string;

    beforeEach(async () => {
      await fetch(`${BASE_URL}/api/credentials/openai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'test-key' }),
      });

      const agentResponse = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `session-test-agent-${Date.now()}`,
          name: 'Session Test Agent',
          systemPrompt: 'Test',
          provider: 'openai',
          modelId: 'gpt-4o',
          maxSteps: 5,
          mcpIds: [],
          skillIds: [],
          defaultWorkspacePath: '/tmp/test-workspace-default',
        }),
      });
      const agentData = (await agentResponse.json()) as { agent: { id: string } };
      testAgentId = agentData.agent.id;
    });

    describe('POST /api/agents/adam/sessions', () => {
      it('should create a session for adam', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Test Session',
          }),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as {
          session: { id: string; agentId: string; title: string };
        };
        expect(data.session.agentId).toBe('adam');
        expect(data.session.title).toBe('Test Session');
      });

      it('should create a session with custom workspacePath', async () => {
        const customWorkspace = '/tmp/custom-workspace-test';
        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Custom Workspace Session',
            workspacePath: customWorkspace,
          }),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as {
          session: { workspacePath: string };
        };
        expect(data.session.workspacePath).toBe(customWorkspace);
      });

      it('should use agent default workspace when workspacePath not specified', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Default Workspace Session',
          }),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as {
          session: { workspacePath?: string };
        };
        expect(data.session.workspacePath).toBeUndefined();
      });

      it('should create session with default title', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(201);
        const data = (await response.json()) as {
          session: { title: string };
        };
        expect(data.session.title).toBe('New Session');
      });
    });

    describe('GET /api/agents/adam/sessions', () => {
      it('should list all sessions', async () => {
        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as { sessions: unknown[] };
        expect(Array.isArray(data.sessions)).toBe(true);
      });

      it('should return sessions for this agent', async () => {
        await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Filter Test Session',
          }),
        });

        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          sessions: Array<{ agentId: string }>;
        };
        expect(data.sessions.every((s) => s.agentId === 'adam')).toBe(true);
      });
    });

    describe('GET /api/agents/adam/sessions/:id', () => {
      it('should return a single session', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Get Test Session',
          }),
        });
        const createData = (await createResponse.json()) as {
          session: { id: string };
        };
        const sessionId = createData.session.id;

        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions/${sessionId}`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          session: { id: string; title: string };
        };
        expect(data.session.id).toBe(sessionId);
        expect(data.session.title).toBe('Get Test Session');
      });

      it('should return 404 for non-existent session', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/adam/sessions/non-existent-session-id`
        );
        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/agents/adam/sessions/:id', () => {
      it('should update session workspacePath', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Update Test Session',
          }),
        });
        const createData = (await createResponse.json()) as {
          session: { id: string };
        };
        const sessionId = createData.session.id;

        const newWorkspace = '/tmp/updated-workspace';
        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspacePath: newWorkspace }),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as {
          session: { workspacePath: string };
        };
        expect(data.session.workspacePath).toBe(newWorkspace);
      });

      it('should update session title', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Original Title',
          }),
        });
        const createData = (await createResponse.json()) as {
          session: { id: string };
        };
        const sessionId = createData.session.id;

        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Title' }),
        });

        expect(response.status).toBe(200);
        const data = (await response.json()) as {
          session: { title: string };
        };
        expect(data.session.title).toBe('Updated Title');
      });

      it('should return 404 for non-existent session', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/adam/sessions/non-existent-session-id`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test' }),
          }
        );
        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/agents/adam/sessions/:id', () => {
      it('should delete a session', async () => {
        const createResponse = await fetch(`${BASE_URL}/api/agents/adam/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'To Delete',
          }),
        });
        const createData = (await createResponse.json()) as {
          session: { id: string };
        };
        const sessionId = createData.session.id;

        const response = await fetch(`${BASE_URL}/api/agents/adam/sessions/${sessionId}`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(200);

        const getResponse = await fetch(`${BASE_URL}/api/agents/adam/sessions/${sessionId}`);
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent session', async () => {
        const response = await fetch(
          `${BASE_URL}/api/agents/adam/sessions/non-existent-session-id`,
          {
            method: 'DELETE',
          }
        );
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.7 Credential Extended API', () => {
    describe('GET /api/credentials/all', () => {
      it('should list all supported providers', async () => {
        const response = await fetch(`${BASE_URL}/api/credentials/all`);
        expect(response.status).toBe(200);

        const data = (await response.json()) as {
          providers: string[];
        };
        expect(Array.isArray(data.providers)).toBe(true);
        expect(data.providers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('8.8 MCP Extended API', () => {
    describe('POST /api/mcp/:name/connect', () => {
      it('should return 404 for non-existent MCP server', async () => {
        const response = await fetch(`${BASE_URL}/api/mcp/non-existent/connect`, {
          method: 'POST',
        });
        expect(response.status).toBe(404);
      });
    });

    describe('GET /api/mcp/:name/tools', () => {
      it('should return 404 for non-existent MCP server', async () => {
        const response = await fetch(`${BASE_URL}/api/mcp/non-existent/tools`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('8.9 Relationship and Boundary Tests', () => {
    it('should create agent with reference to existing credential', async () => {
      await fetch(`${BASE_URL}/api/credentials/openai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-key',
        }),
      });

      const agentResponse = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'ref-test-agent',
          name: 'Ref Test Agent',
          systemPrompt: 'Test',
          provider: 'openai',
          modelId: 'gpt-4o',
          maxSteps: 5,
          mcpIds: [],
          skillIds: [],
        }),
      });

      expect(agentResponse.status).toBe(201);
      const agentData = (await agentResponse.json()) as {
        agent: { provider: string };
      };
      expect(agentData.agent.provider).toBe('openai');
    });

    it('should allow creating agent with provider', async () => {
      const response = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'provider-agent',
          name: 'Provider Agent',
          systemPrompt: 'Test',
          provider: 'openai',
          modelId: 'gpt-4o',
          maxSteps: 5,
          mcpIds: [],
          skillIds: [],
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as { agent: { provider: string } };
      expect(data.agent.provider).toBe('openai');
    });

    it('should return correct error structure for 404', async () => {
      const response = await fetch(`${BASE_URL}/api/agents/non-existent`);
      expect(response.status).toBe(404);

      const data = (await response.json()) as { error: string };
      expect(data.error).toBeDefined();
      expect(typeof data.error).toBe('string');
    });
  });
});
