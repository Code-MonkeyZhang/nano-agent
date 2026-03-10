import { describe, it, expect } from 'vitest';
import { LLMClient } from '../src/llm-client/llm-client.js';
import type { Message } from '../src/schema/schema.js';

/**
 * LLM API Integration Test
 *
 * Uses environment variables for configuration:
 * - TEST_API_KEY: Required - API key for the LLM provider
 * - TEST_API_BASE: Optional - API base URL (default: DeepSeek)
 * - TEST_PROVIDER: Optional - Provider type (default: openai)
 * - TEST_MODEL: Optional - Model name (default: deepseek-chat)
 */
function getTestConfig(): {
  apiKey: string;
  apiBase: string;
  provider: string;
  model: string;
} | null {
  const apiKey = process.env['TEST_API_KEY'];
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return null;
  }

  return {
    apiKey,
    apiBase: process.env['TEST_API_BASE'] ?? 'https://api.deepseek.com/v1',
    provider: process.env['TEST_PROVIDER'] ?? 'openai',
    model: process.env['TEST_MODEL'] ?? 'deepseek-chat',
  };
}

const testConfig = getTestConfig();
const skipReason = testConfig ? null : 'TEST_API_KEY environment variable not set';

const maybeDescribe = skipReason ? describe.skip : describe;

if (skipReason) {
  console.log(`⚠️  Skipping LLM API tests: ${skipReason}`);
}

maybeDescribe('LLM API Integration (stream)', () => {
  it('should stream a response from the configured LLM API', async () => {
    if (!testConfig) {
      throw new Error('Unexpected: test ran but was gated off');
    }

    const llmClient = new LLMClient(
      testConfig.apiKey,
      testConfig.apiBase,
      testConfig.provider,
      testConfig.model
    );

    const messages: Message[] = [
      { role: 'user', content: 'Reply with exactly: pong' },
    ];

    let fullContent = '';
    let sawDone = false;
    let chunks = 0;

    for await (const chunk of llmClient.generateStream(messages)) {
      if (chunk.content) fullContent += chunk.content;
      if (chunk.done) {
        sawDone = true;
        break;
      }
      chunks++;
      if (chunks > 200) break;
    }

    expect(sawDone).toBe(true);
    expect(fullContent.trim().length).toBeGreaterThan(0);
    expect(fullContent).toMatch(/pong/i);
  }, 30000);
});
