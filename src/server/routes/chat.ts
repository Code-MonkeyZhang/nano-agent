import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { LLMClient } from '../../llm-client/llm-client.js';
import { SSEWriter } from '../streaming/sse-writer.js';
import { convertOpenAIRequest } from '../converters/openai-to-nanoagent.js';
import { convertStreamChunk } from '../converters/nanoagent-to-openai.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '../types/openai-types.js';
import type { Message } from '../../schema/index.js';
import { Logger } from '../../util/logger.js';

/**
 * Creates an OpenAI-compatible chat router.
 *
 * @param llmClient - The LLM client instance.
 * @param systemPrompt - The system prompt.
 * @returns Express Router with `/completions` endpoint.
 */
export function createChatRouter(
  llmClient: LLMClient,
  systemPrompt: string
): Router {
  const router = Router();

  /**
   * POST /completions
   *
   * OpenAI-compatible chat completions endpoint.
   * Supports both streaming (SSE) and non-streaming (JSON) responses.
   */
  router.post('/completions', async (req: Request, res: Response) => {
    // Generate unique ID for request tracking and cast request body type
    const requestId = randomUUID();
    const body = req.body as ChatCompletionRequest;

    try {
      //Ensure messages exists and is an array
      if (!body.messages || !Array.isArray(body.messages)) {
        throw new Error('Invalid messages array');
      }

      const { messages } = convertOpenAIRequest(body);

      // Prepend system prompt
      const finalMessages: Message[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      // Start generation: Create async generator
      const generator = llmClient.generateStream(finalMessages, null);

      // Branch: Streaming vs non-streaming response based on stream parameter
      if (body.stream) {
        // Streaming mode: Output chunks via SSE
        const sse = new SSEWriter(res);
        try {
          // Iterate through each chunk, convert to OpenAI format, and write to SSE stream
          for await (const chunk of generator) {
            const timestamp = Math.floor(Date.now() / 1000);
            const openAIChunk = convertStreamChunk(
              chunk,
              llmClient.model,
              requestId,
              timestamp
            );
            sse.write(openAIChunk);
          }
          sse.done();
        } catch (error) {
          sse.error(error instanceof Error ? error : new Error(String(error)));
        }
      } else {
        // Non-streaming mode: Accumulate all chunks and return complete JSON response
        let fullContent = '';
        let fullThinking = '';
        let finishReason: string | null = null;
        const toolCalls: any[] = [];

        // Accumulate content by iterating through all chunks
        for await (const chunk of generator) {
          if (chunk.content) {
            fullContent += chunk.content;
          }
          if (chunk.thinking) {
            fullThinking += chunk.thinking;
          }
          if (chunk.tool_calls) {
            const mappedTools = chunk.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: JSON.stringify(tc.function.arguments),
              },
            }));
            toolCalls.push(...mappedTools);
          }
          // Record finish reason
          if (chunk.done && chunk.finish_reason) {
            finishReason = chunk.finish_reason;
          }
        }

        // Construct complete OpenAI-compatible response object
        const response: ChatCompletionResponse = {
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: llmClient.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: fullContent || null,
                ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
                ...(fullThinking ? { reasoning_content: fullThinking } : {}),
              },
              finish_reason: finishReason || 'stop',
            },
          ],
        };

        res.json(response);
      }
    } catch (error: unknown) {
      //Return appropriate HTTP status code and error message based on error type
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 404 errors indicate invalid or missing API key
      if (
        errorMessage.includes('404') ||
        errorMessage.includes('page not found')
      ) {
        res.status(500).json({
          error: {
            message:
              'LLM API key is not configured or invalid. Please check your config.yaml file.',
            type: 'authentication_error',
          },
        });
      } else {
        // Other errors: log and return internal server error
        Logger.log('Chat API', `Error: ${errorMessage}`, error);
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: errorMessage,
              type: 'internal_server_error',
            },
          });
        }
      }
    }
  });

  return router;
}
