import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  httpServer,
  setupOpenAIRoutes,
} from '../../src/server/http-server.js';
import {
  initWebSocket,
  shutdownWebSocket,
} from '../../src/server/websocket-server.js';
import { initBuiltinToolPool } from '../../src/builtin-tool-pool/store.js';
import { initMcpPool } from '../../src/mcp-pool/store.js';
import { initSkillPool } from '../../src/skill-pool/store.js';
import {
  initCredentialPool,
  setCredential,
} from '../../src/credential/store.js';
import {
  initAgentConfigStore,
  listAgentConfigs,
  updateAgentConfig,
} from '../../src/agent-config/store.js';
import { setDefaultWorkspaceDir } from '../../src/agent-factory/index.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { fileURLToPath } from 'node:url';

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

let PORT: number;
let BASE_URL: string;

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(testFileDir, '..');
const testDataDir = path.join(testsDir, 'test-data');
const testWorkspaceDir = path.join(testsDir, 'config');

function ensureTestDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Integration test configuration
 *
 * Uses environment variables for API credentials:
 * - TEST_API_KEY: Required - API key for the LLM provider
 * - TEST_PROVIDER: Optional - Provider type (default: openai)
 * - TEST_MODEL_ID: Optional - Model ID (default: gpt-4o)
 */
function getTestConfig(): {
  apiKey: string;
  provider: 'openai' | 'anthropic';
  modelId: string;
} | null {
  const apiKey = process.env['TEST_API_KEY'];
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return null;
  }

  return {
    apiKey,
    provider: (process.env['TEST_PROVIDER'] as 'openai' | 'anthropic') ?? 'openai',
    modelId: process.env['TEST_MODEL_ID'] ?? 'gpt-4o',
  };
}

const testConfig = getTestConfig();
const skipReason = testConfig ? null : 'TEST_API_KEY environment variable not set';

const maybeDescribe = skipReason ? describe.skip : describe;

if (skipReason) {
  console.log(`⚠️  Skipping integration tests: ${skipReason}`);
}

maybeDescribe('Integration Tests', () => {
  beforeAll(async () => {
    if (!testConfig) {
      throw new Error('Test config not available');
    }

    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}/v1`;

    process.env['NO_TUNNEL'] = '1';

    ensureTestDir(testDataDir);
    ensureTestDir(testWorkspaceDir);

    setDefaultWorkspaceDir(testWorkspaceDir);

    const credentialsPath = path.join(testDataDir, 'credentials.json');
    const agentsPath = path.join(testDataDir, 'agents');

    initCredentialPool(credentialsPath);
    initAgentConfigStore(agentsPath);

    setCredential(testConfig.provider, {
      apiKey: testConfig.apiKey,
    });

    const agentConfigs = listAgentConfigs();
    if (agentConfigs.length === 0) {
      throw new Error('No agent configs found');
    }

    const defaultAgent = agentConfigs[0];
    updateAgentConfig(defaultAgent.id, {
      provider: testConfig.provider,
      modelId: testConfig.modelId,
    });

    initBuiltinToolPool(testWorkspaceDir);

    const skillsDir = path.join(testsDir, 'test-config', 'skills');
    if (fs.existsSync(skillsDir)) {
      initSkillPool(skillsDir);
    } else {
      initSkillPool(testWorkspaceDir);
    }

    const mcpConfigPath = path.join(testsDir, 'test-config', 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
      await initMcpPool(mcpConfigPath);
    }

    await setupOpenAIRoutes();
    initWebSocket();

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    shutdownWebSocket();
    httpServer.close();
  });

  it('SSE Streaming - Basic Chat', async () => {
    const payload = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    };

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let hasDone = false;

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') {
            hasDone = true;
          }
        }
      }
    }

    expect(hasDone).toBe(true);
  }, 30000);

  it('Non-Streaming Response - Should return 501', async () => {
    const payload = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: false,
    };

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(501);
    const data = (await response.json()) as { error: { type: string } };
    expect(data.error.type).toBe('not_implemented');
  }, 30000);

  it('Context Retention (Chat History)', async () => {
    const payload = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'My name is IntegrationTestUser.' },
        { role: 'assistant', content: 'Hello! Nice to meet you.' },
        { role: 'user', content: 'What is my name?' },
      ],
      stream: true,
    };

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            if (data.choices?.[0]?.delta?.content) {
              fullContent += data.choices[0].delta.content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    expect(fullContent).toContain('IntegrationTestUser');
  }, 30000);
});
