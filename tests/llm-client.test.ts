import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { Config } from '../src/config.js';
import { LLMClient } from '../src/llm-client/llm-client.js';
import type { Message } from '../src/schema/schema.js';

/**
 * LLM API Integration Test
 *
 * This is an integration test that will make real calls to LLM API.
 * Before running, ensure `nano-agent/config/config.yaml` is configured correctly
 * (when running from `nano-agent/`, the path is `./config/config.yaml`) and that
 * your environment allows network access.
 */
const configPath = Config.findConfigFile('config.yaml');
let config: Config | null = null;
let skipReason: string | null = null;

if (!configPath) {
  skipReason = 'config.yaml not found';
} else if (!fs.existsSync(configPath)) {
  skipReason = `config.yaml not found at resolved path: ${configPath}`;
} else {
  try {
    config = Config.fromYaml(configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    skipReason = `config.yaml exists but is not usable: ${message}`;
  }
}

const maybeDescribe = skipReason ? describe.skip : describe;

if (skipReason) {
  console.log(`⚠️  Skipping LLM API tests: ${skipReason}`);
}

maybeDescribe('LLM API Integration (stream)', () => {
  it('should stream a response from the configured LLM API', async () => {
    if (!config || !configPath) {
      throw new Error(`Unexpected: test ran but was gated off: ${skipReason}`);
    }

    const llmClient = new LLMClient(
      config.llm.apiKey,
      config.llm.apiBase,
      config.llm.provider,
      config.llm.model,
      config.llm.retry
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
