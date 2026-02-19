import type { ChatCompletionChunk } from '../types/openai-types.js';
import type { LLMStreamChunk } from '../../schema/index.js';

/**
 * Converts an internal Nano-Agent stream chunk into an OpenAI SSE-compatible chunk.
 *
 * This function maps:
 * - Content deltas
 * - Thinking/Reasoning content (for models like DeepSeek)
 * - Tool call deltas
 * - Finish reasons
 *
 * @param {LLMStreamChunk} chunk - The internal stream chunk from the LLM client.
 * @param {string} model - The model name to report in the response.
 * @param {string} id - The unique request ID.
 * @param {number} timestamp - The unix timestamp for the chunk creation.
 * @returns {ChatCompletionChunk} The OpenAI-compatible chunk object.
 */
export function convertStreamChunk(
  chunk: LLMStreamChunk,
  model: string,
  id: string,
  timestamp: number
): ChatCompletionChunk {
  const delta: ChatCompletionChunk['choices'][0]['delta'] = {};

  if (chunk.content) {
    delta.content = chunk.content;
  }

  if (chunk.thinking) {
    delta.reasoning_content = chunk.thinking;
  }

  if (chunk.tool_calls) {
    delta.tool_calls = chunk.tool_calls.map((tc, index) => ({
      index,
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments),
      },
    }));
  }

  return {
    id,
    object: 'chat.completion.chunk',
    created: timestamp,
    model,
    choices: [
      {
        index: 0,
        delta: Object.keys(delta).length > 0 ? delta : { role: 'assistant' },
        finish_reason: chunk.done ? chunk.finish_reason || 'stop' : null,
      },
    ],
  };
}
