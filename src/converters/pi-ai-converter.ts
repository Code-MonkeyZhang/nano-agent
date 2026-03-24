/**
 * @fileoverview Conversion layer between internal types and pi-ai format.
 */

import type {
  Context,
  Message as PiAiMessage,
  UserMessage,
  AssistantMessage,
  TextContent,
  ThinkingContent,
} from '@mariozechner/pi-ai';
import type { Message } from '../schema/index.js';

/**
 * Convert internal Message array to pi-ai Message array.
 * Handles user and assistant messages.
 */
export function convertMessages(messages: Message[]): PiAiMessage[] {
  const result: PiAiMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const userMsg: UserMessage = {
        role: 'user',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content
                .filter((b) => b.type === 'text')
                .map((b) => ({ type: 'text', text: b.text ?? '' })),
        timestamp: Date.now(),
      };
      result.push(userMsg);
    } else if (msg.role === 'assistant') {
      const content: (TextContent | ThinkingContent)[] = [];

      if (msg.thinking) {
        content.push({ type: 'thinking', thinking: msg.thinking });
      }

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        content,
        api: 'openai-completions',
        provider: 'openai',
        model: '',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop',
        timestamp: Date.now(),
      };
      result.push(assistantMsg);
    }
  }

  return result;
}

/**
 * Create a pi-ai Context from system prompt and messages.
 */
export function convertContext(
  systemPrompt: string,
  messages: Message[]
): Context {
  return {
    systemPrompt,
    messages: convertMessages(messages),
    tools: [],
  };
}
