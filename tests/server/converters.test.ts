import { describe, it, expect } from 'vitest';
import { convertOpenAIRequest } from '../../src/server/converters/openai-to-nanoagent.js';
import { convertStreamChunk } from '../../src/server/converters/nanoagent-to-openai.js';
import type { ChatCompletionRequest } from '../../src/server/types/openai-types.js';
import type { LLMStreamChunk } from '../../src/schema/index.js';

describe('OpenAI Converters', () => {
  describe('convertOpenAIRequest', () => {
    // Test that a simple user message is correctly converted
    it('should convert simple user message', () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = convertOpenAIRequest(request);

      expect(result.model).toBe('gpt-4');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    // Test that multiple message types (system, user, assistant) are preserved
    it('should convert system and assistant messages', () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Sys' },
          { role: 'user', content: 'User' },
          { role: 'assistant', content: 'Asst' },
        ],
      };

      const result = convertOpenAIRequest(request);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[2].role).toBe('assistant');
    });

    // Test that generation options like temperature and max_tokens are extracted
    it('should extract options', () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [],
        temperature: 0.7,
        max_tokens: 100,
      };

      const result = convertOpenAIRequest(request);

      expect(result.options.temperature).toBe(0.7);
      expect(result.options.maxTokens).toBe(100);
    });
  });

  describe('convertStreamChunk', () => {
    // Test that regular text content is correctly mapped to OpenAI delta format
    it('should convert content chunk', () => {
      const chunk: LLMStreamChunk = {
        done: false,
        content: 'Hello',
      };

      const result = convertStreamChunk(chunk, 'gpt-4', 'req-123', 1000);

      expect(result.id).toBe('req-123');
      expect(result.model).toBe('gpt-4');
      expect(result.choices[0].delta.content).toBe('Hello');
      expect(result.choices[0].finish_reason).toBeNull();
    });

    // Test that thinking/reasoning content is mapped to reasoning_content field
    it('should convert thinking chunk', () => {
      const chunk: LLMStreamChunk = {
        done: false,
        thinking: 'Hmm...',
      };

      const result = convertStreamChunk(chunk, 'gpt-4', 'req-123', 1000);

      expect(result.choices[0].delta.reasoning_content).toBe('Hmm...');
    });

    // Test that the final chunk correctly sets finish_reason
    it('should handle done chunk', () => {
      const chunk: LLMStreamChunk = {
        done: true,
        finish_reason: 'stop',
      };

      const result = convertStreamChunk(chunk, 'gpt-4', 'req-123', 1000);

      expect(result.choices[0].finish_reason).toBe('stop');
      expect(result.choices[0].delta).toEqual({ role: 'assistant' });
    });
  });
});
