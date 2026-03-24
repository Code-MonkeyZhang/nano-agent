/**
 * @fileoverview Core agent runtime that executes LLM conversations.
 *
 * AgentCore is designed to accept pre-assembled configuration from AgentFactory.
 * It handles streaming responses from the LLM.
 */

import { stream } from '@mariozechner/pi-ai';
import type { Message, AgentEvent } from '../schema/index.js';
import type { AgentRunConfig } from './types.js';
import { convertContext } from '../converters/index.js';

/**
 * Core agent runtime that executes LLM conversations.
 *
 * Lifecycle: Short-lived, created per request and destroyed after completion.
 */
export class AgentCore {
  public runConfig: AgentRunConfig;
  public messages: Message[] = [];

  constructor(config: AgentRunConfig) {
    this.runConfig = config;
    this.messages = [{ role: 'system', content: config.systemPrompt }]; // add system prompt as first message
  }

  /**
   * Add a user message to the conversation history.
   *
   * @param content - The user's message text
   * TODO: 如果要支持多模态这个要改
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
    });
  }

  /**
   * Main loop that generates LLM responses.
   *
   * Yields raw delta events for thinking and content.
   * Does NOT accumulate content or build messages - caller is responsible for that.
   *
   * @param signal - Optional AbortSignal to cancel the stream
   */
  async *runStream(
    signal?: AbortSignal
  ): AsyncGenerator<AgentEvent, void, void> {
    for (let step = 0; step < this.runConfig.maxSteps; step++) {
      yield {
        type: 'step_start',
        step: step + 1,
        maxSteps: this.runConfig.maxSteps,
      };

      const context = convertContext(
        this.runConfig.systemPrompt,
        this.messages
      );

      const eventStream = stream(this.runConfig.model, context, {
        apiKey: this.runConfig.apiKey,
      });

      for await (const event of eventStream) {
        if (signal?.aborted) {
          return;
        }
        if (event.type === 'thinking_delta') {
          yield { type: 'thinking', content: event.delta };
        }

        if (event.type === 'text_delta') {
          yield { type: 'content', content: event.delta };
        }

        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }

      return;
    }
  }
}
