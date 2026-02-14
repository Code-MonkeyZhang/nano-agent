/* eslint-disable no-console */
import { Router } from 'express';
import * as fs from 'node:fs';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { LLMClient } from '../../llm-client/llm-client.js';
import { SSEWriter } from '../streaming/sse-writer.js';
import { convertOpenAIRequest } from '../converters/openai-to-nanoagent.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '../types/openai-types.js';
import { Logger } from '../../util/logger.js';
import { Agent } from '../../agent.js';
import {
  loadMcpToolsAsync,
  ReadTool,
  WriteTool,
  EditTool,
  BashTool,
  BashOutputTool,
  BashKillTool,
} from '../../tools/index.js';
import type { Tool } from '../../tools/index.js';
import { SkillLoader, GetSkillTool } from '../../skills/index.js';

/**
 * Creates an OpenAI-compatible chat router.
 *
 * @param llmClient - The LLM client instance.
 * @param systemPrompt - The system prompt.
 * @param workspaceDir - The workspace directory.
 * @param mcpConfigPath - The path to the MCP configuration file.
 * @param skillsDir - The directory containing skills.
 * @returns Express Router with `/completions` endpoint.
 */
export function createChatRouter(
  llmClient: LLMClient,
  systemPrompt: string,
  workspaceDir: string,
  mcpConfigPath: string,
  skillsDir: string
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

      // Load Tools (Basic + MCP)
      const tools: Tool[] = [
        new ReadTool(workspaceDir),
        new WriteTool(workspaceDir),
        new EditTool(workspaceDir),
        new BashTool(),
        new BashOutputTool(),
        new BashKillTool(),
      ];

      // Load Skills
      let finalSystemPrompt = systemPrompt;
      try {
        if (skillsDir && fs.existsSync(skillsDir)) {
          const skillLoader = new SkillLoader(skillsDir);
          const discoveredSkills = skillLoader.discoverSkills();

          if (discoveredSkills.length > 0) {
            // Inject find skill tool
            tools.push(new GetSkillTool(skillLoader));

            // Inject skills metadata into system prompt
            const skillsMetadata = skillLoader.getSkillsMetadataPrompt();
            finalSystemPrompt += `\n\n${skillsMetadata}`;

            console.log(
              `[Chat API] Loaded ${discoveredSkills.length} skills from ${skillsDir}`
            );
          }
        }
      } catch (error) {
        console.warn('[Chat API] Failed to load Skills:', error);
      }

      // Load MCP Tools
      try {
        if (mcpConfigPath) {
          const mcpTools = await loadMcpToolsAsync(mcpConfigPath);
          tools.push(...mcpTools);
          console.log(
            `[Chat API] Loaded ${mcpTools.length} MCP tools from ${mcpConfigPath}`
          );
        }
      } catch (error) {
        console.warn('[Chat API] Failed to load MCP tools:', error);
      }

      // Create Agent instance
      // Note: Agent constructor registers tools automatically
      const agent = new Agent(
        llmClient,
        finalSystemPrompt, // Use updated system prompt with skills
        tools,
        100, // maxSteps
        workspaceDir
      );

      // Inject history messages
      // We take all messages except the last one (which is the current user query handled below)
      if (messages.length > 1) {
        const historyMessages = messages.slice(0, messages.length - 1);
        agent.messages.push(...historyMessages);
        console.log(
          `[Chat API] Injected ${historyMessages.length} history messages`
        );
      }

      // Set user message
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
        console.log(`[Chat API] User message: ${content.slice(0, 100)}...`);
      }

      // Branch: Streaming vs non-streaming response based on stream parameter
      if (body.stream) {
        // Streaming mode: Output chunks via SSE
        const sse = new SSEWriter(res);
        try {
          // Iterate through agent stream events
          for await (const event of agent.runStream()) {
            const timestamp = Math.floor(Date.now() / 1000);

            switch (event.type) {
              case 'thinking':
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: llmClient.model,
                  choices: [
                    {
                      index: 0,
                      delta: { reasoning_content: event.content },
                      finish_reason: null,
                    },
                  ],
                });
                break;

              case 'content':
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: llmClient.model,
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
                const toolBlocks = event.tool_calls
                  .map((tc) => {
                    try {
                      // Validate parsing but use string version if possible
                      JSON.parse(JSON.stringify(tc.function.arguments));
                      // Handle both object and string arguments (Agent uses Record<string, unknown> usually)
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
                  model: llmClient.model,
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
                  model: llmClient.model,
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

              case 'step_start':
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: llmClient.model,
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

              case 'error':
                sse.write({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: timestamp,
                  model: llmClient.model,
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
          sse.done();
        } catch (error) {
          sse.error(error instanceof Error ? error : new Error(String(error)));
        }
      } else {
        // Non-streaming mode: Accumulate all content and return complete JSON response
        let fullContent = '';
        const iterator = agent.runStream();
        let result = await iterator.next();

        while (!result.done) {
          const event = result.value;
          if (event.type === 'content') {
            fullContent += event.content;
          }
          result = await iterator.next();
        }

        const finalContent =
          typeof result.value === 'string' ? result.value : fullContent;

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
                content: finalContent || null,
              },
              finish_reason: 'stop',
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
