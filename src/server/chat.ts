import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

import { SSEWriter } from './sse-writer.js';
import { convertOpenAIRequest } from './converters/openai-to-nanoagent.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './types/openai-types.js';
import { Logger } from '../util/logger.js';
import { getGlobalAgent } from './http-server.js';

/**
 * Creates an OpenAI-compatible chat router.
 *
 * @param config - The agent configuration.
 * @param workspaceDir - The workspace directory.
 * @returns Express Router with `/completions` endpoint.
 */
export function createChatRouter(): Router {
  const router = Router();

  router.post('/completions', async (req: Request, res: Response) => {
    const requestId = randomUUID();
    const body = req.body as ChatCompletionRequest; // Parse OpenAI-compatible request

    try {
      if (!body.messages || !Array.isArray(body.messages)) {
        throw new Error('Invalid messages array'); // Validate messages field
      }

      const { messages } = convertOpenAIRequest(body); // Convert OpenAI format to internal format

      const agent = getGlobalAgent(); // Retrieve shared AgentCore instance
      if (!agent) {
        throw new Error('AgentCore not initialized');
      }

      agent.messages = [{ role: 'system', content: agent.systemPrompt }]; // Reset with system prompt

      if (messages.length > 1) {
        const historyMessages = messages.slice(0, messages.length - 1);
        agent.messages.push(...historyMessages);
        Logger.log(
          'CHAT',
          `Injected ${historyMessages.length} history messages`
        );
      }

      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'user') {
        let content = '';
        if (typeof lastMsg.content === 'string') {
          content = lastMsg.content;
        } else if (Array.isArray(lastMsg.content)) {
          content = lastMsg.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
        }
        agent.addUserMessage(content);
        Logger.log('CHAT', `User message preview: ${content.slice(0, 100)}...`);
      }

      const modelName = agent.config.llm.model; // Get model name for response

      if (body.stream) {
        // Streaming mode: send events via SSE
        const sse = new SSEWriter(res); // Initialize SSE writer for streaming response
        try {
          for await (const event of agent.runStream()) {
            // Iterate through agent execution events
            const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp for each chunk

            switch (event.type) {
              case 'thinking': // Agent reasoning process
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: { reasoning_content: event.content },
                      finish_reason: null,
                    },
                  ],
                });
                break;

              case 'content': // Generated text output
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: { content: event.content },
                      finish_reason: null,
                    },
                  ],
                });
                break;

              case 'tool_call': {
                // Tool invocation
                const toolBlocks = event.tool_calls
                  .map((tc) => {
                    try {
                      JSON.parse(JSON.stringify(tc.function.arguments));

                      const argsStr =
                        typeof tc.function.arguments === 'string'
                          ? tc.function.arguments
                          : JSON.stringify(tc.function.arguments, null, 2);

                      return `\n\n🔧 **Tool: ${tc.function.name}**\n\`\`\`json\n${argsStr}\n\`\`\``;
                    } catch {
                      return `\n\n🔧 **Tool: ${tc.function.name}**`;
                    }
                  })
                  .join('\n\n');

                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: { reasoning_content: toolBlocks },
                      finish_reason: null,
                    },
                  ],
                });
                break;
              }

              case 'tool_result': {
                // Tool execution result
                const resultBlock = event.result.success
                  ? `\n\n✅ **Tool Result (${event.toolName})**\n\`\`\`\n${
                      event.result.content.length > 500
                        ? `${event.result.content.slice(0, 500)}...`
                        : event.result.content
                    }\n\`\`\``
                  : `\n\n❌ **Tool Error (${event.toolName})**\n\`\`\`\n${event.result.error}\n\`\`\``;

                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: { reasoning_content: resultBlock },
                      finish_reason: null,
                    },
                  ],
                });
                break;
              }

              case 'step_start': // Multi-step execution marker
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        reasoning_content: `\n---\n**Step ${event.step}/${event.maxSteps}**\n---\n`,
                      },
                      finish_reason: null,
                    },
                  ],
                });
                break;

              case 'error': // Execution error
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        reasoning_content: `\n❌ **Error:** ${event.error}\n`,
                      },
                      finish_reason: null,
                    },
                  ],
                });
                break;
            }
          }

          sse.done(); // Signal end of stream
        } catch (error) {
          sse.error(error instanceof Error ? error : new Error(String(error)));
        }
      } else {
        // Non-streaming mode: wait for complete response
        let fullContent = ''; // Accumulate all content events
        const iterator = agent.runStream(); // Run agent and iterate through events
        let result = await iterator.next();

        while (!result.done) {
          // Consume iterator until completion
          const event = result.value;
          if (event.type === 'content') {
            fullContent += event.content;
          }
          result = await iterator.next();
        }

        const finalContent =
          typeof result.value === 'string' ? result.value : fullContent;

        const response: ChatCompletionResponse = {
          // Build OpenAI-compatible response
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelName,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: finalContent || null,
              },
              finish_reason: 'stop',
            },
          ],
        };

        res.json(response);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

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
        // Internal server error
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
