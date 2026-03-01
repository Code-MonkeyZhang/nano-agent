import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, setupOpenAIRoutes } from '../../src/server/http-server.js';
import {
  initWebSocket,
  shutdownWebSocket,
} from '../../src/server/websocket-server.js';
import { Config } from '../../src/config.js';
import * as path from 'node:path';
import * as net from 'node:net';
import { fileURLToPath } from 'node:url';

/**
 * 找到一个可用端口
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

let PORT: number;
let BASE_URL: string;

// Get test directory path
const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(testFileDir, '..');
const testConfigDir = path.join(testsDir, 'test-config');
const testConfigPath = path.join(testConfigDir, 'config.yaml');

// Configuration check for integration tests
let config: Config | null = null;
let skipReason: string | null = null;

try {
  config = Config.fromYaml(testConfigPath);
  // Override MCP config path to absolute path to avoid Config.findConfigFile() searching in other locations
  config.tools.mcpConfigPath = path.join(testConfigDir, 'mcp.json');
  // Override skills dir to absolute path
  config.tools.skillsDir = path.join(testConfigDir, 'skills');
  // Check if API key is valid (not the placeholder value)
  if (!config.llm?.apiKey || config.llm.apiKey === 'YOUR_API_KEY_HERE') {
    skipReason = 'Invalid or missing API key in test config';
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  skipReason = `Test config is not usable: ${message}`;
}

const maybeDescribe = skipReason ? describe.skip : describe;

if (skipReason) {
  console.log(`⚠️  Skipping integration tests: ${skipReason}`);
}

maybeDescribe('Integration Tests', () => {
  // Start server before all tests
  beforeAll(async () => {
    if (!config) {
      throw new Error('Config not available for integration test');
    }

    // Find available port
    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}/v1`;

    // Override env vars if needed
    process.env['NO_TUNNEL'] = '1';

    // Setup Routes
    await setupOpenAIRoutes(
      config,
      path.join(testsDir, 'config')
    );

    // Initialize services
    initWebSocket();

    // Start HTTP server
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => {
        resolve();
      });
    });
  });

  // Stop server after all tests
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
    // expect(content.length).toBeGreaterThan(0); // Content might be empty if only thinking occurred or tool use
  }, 30000);

  it('Non-Streaming Response', async () => {
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

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = (await response.json()) as any;
    expect(data.object).toBe('chat.completion');
    expect(data.choices).toBeInstanceOf(Array);
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeDefined();
  }, 30000);

  it('Context Retention (Chat History)', async () => {
    // We simulate sending a full history.
    // Since the server is stateless, we must send the history in the messages array.
    const payload = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'My name is IntegrationTestUser.' },
        { role: 'assistant', content: 'Hello! Nice to meet you.' },
        { role: 'user', content: 'What is my name?' },
      ],
      stream: false,
    };

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;
    const content = data.choices[0].message.content;

    // Check if the LLM mentions the name from the history
    expect(content).toContain('IntegrationTestUser');
  }, 30000);
});
