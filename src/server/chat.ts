import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

import { SSEWriter } from './sse-writer.js';
import { convertOpenAIRequest } from './converters/openai-to-nanoagent.js';
import type { ChatCompletionRequest } from './types/openai-types.js';
import { Logger } from '../util/logger.js';
import {
  createGlobalAbortController,
  clearGlobalAbortController,
} from './http-server.js';
import { getGlobalSessionManager } from './sessions.js';
import { createAgent } from '../agent-factory/index.js';
import { getAgentConfig } from '../agent-config/store.js';
import type { Message } from '../schema/index.js';
import type { AgentId } from '../agent-config/types.js';

import * as path from 'node:path';

const MAX_TITLE_LENGTH = 30;

const DEFAULT_WORKSPACE_DIR = path.resolve(
  process.cwd(),
  'data',
  'agent-space'
);

/**
 * Extracts text content from a message.
 */
function extractTextContent(
  content: string | unknown[] | unknown
): string | null {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: string; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
  return null;
}

/**
 * Generates a title from user message content.
 * Takes the first 30 characters of the first user message.
 * TODO: 以后要修改成LLM自动总结 title, 当前改动不会反映在前端上, 因为前端只加载一次
 */
function generateTitle(messages: Message[]): string {
  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = extractTextContent(msg.content);
      if (text) {
        return text.length > MAX_TITLE_LENGTH
          ? `${text.slice(0, MAX_TITLE_LENGTH)}...`
          : text;
      }
    }
  }
  return 'New Chat';
}

/**
 * Creates an OpenAI-compatible chat router.
 *
 * @param config - The agent configuration.
 * @param workspaceDir - The workspace directory.
 * @returns Express Router with `/completions` endpoint.
 */
export function createChatRouter(): Router {
  const router = Router();

  /**
   * OpenAI 兼容的聊天补全端点
   *
   * 接收 OpenAI 格式的聊天补全请求
   * - 验证请求消息格式
   * - 将请求转换为内部格式
   * - 调用 AgentCore 处理消息
   * - 通过 SSE 返回流式响应或同步返回完整响应
   */
  router.post('/completions', async (req: Request, res: Response) => {
    const requestId = randomUUID();
    const body = req.body as ChatCompletionRequest;

    try {
      if (!body.messages || !Array.isArray(body.messages)) {
        throw new Error('Invalid messages array');
      }

      const { messages: requestMessages } = convertOpenAIRequest(body);
      const sessionId = body.sessionId;

      const sessionManager = getGlobalSessionManager();
      let agentId: AgentId = 'adam';
      let isNewSession = false;
      let workspacePath: string | undefined;
      let sessionModelId: string | undefined;

      if (sessionId && sessionManager) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          agentId = session.agentId;
          isNewSession = session.messageCount === 0;
          workspacePath = session.workspacePath;
          sessionModelId = session.modelId;
          Logger.log('CHAT', `Session ${sessionId} bound to agent ${agentId}`);
        } else {
          Logger.log(
            'CHAT',
            `Session ${sessionId} not found, using default agent`
          );
        }
      }

      if (!workspacePath) {
        const agentConfig = getAgentConfig(agentId);
        workspacePath = agentConfig?.defaultWorkspacePath;
      }

      const finalWorkspaceDir = workspacePath ?? DEFAULT_WORKSPACE_DIR;
      Logger.log('CHAT', `Using workspace: ${finalWorkspaceDir}`);

      // TODO 现在每次发送请求都会创建一个Agent,这个迟早要改
      const agent = await createAgent(
        agentId,
        finalWorkspaceDir,
        sessionModelId
      );

      agent.messages = [{ role: 'system', content: agent.systemPrompt }];

      if (sessionId && sessionManager) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          for (const msg of session.messages) {
            if (msg.role !== 'system') {
              agent.messages.push(msg);
            }
          }
          Logger.log(
            'CHAT',
            `Loaded ${session.messages.length} messages from session ${sessionId}`
          );
        }
      }

      // Track the starting message count for later saving
      const historyLength = agent.messages.length;

      // Add new messages from request
      for (const msg of requestMessages) {
        if (msg.role === 'user') {
          const content = extractTextContent(msg.content) ?? '';
          agent.messages.push({ role: 'user', content });
        } else {
          agent.messages.push(msg);
        }
      }

      Logger.log(
        'CHAT',
        `Loaded ${requestMessages.length} new messages from request`
      );

      const modelName = agent.runConfig.modelId;
      const abortController = createGlobalAbortController();
      const signal = abortController.signal;

      // generate text stream
      if (body.stream) {
        const sse = new SSEWriter(res);
        let wasAborted = false;
        try {
          for await (const event of agent.runStream()) {
            if (signal.aborted) {
              Logger.log('CHAT', 'Generation aborted by user');
              // Send abort info to client
              sse.write({
                id: requestId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: modelName,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: '\n\n⚠️ **生成已被用户中断**',
                    },
                    finish_reason: 'stop',
                  },
                ],
              });

              wasAborted = true;
              sse.done();
              break;
            }

            const timestamp = Math.floor(Date.now() / 1000);

            switch (event.type) {
              case 'thinking':
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

              case 'content':
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

              case 'step_start':
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

              case 'error':
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

          if (!wasAborted) {
            sse.done();

            // Save messages to session after successful completion
            if (sessionId && sessionManager) {
              const lastMsg = agent.messages[agent.messages.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                const newMessages = agent.messages.slice(historyLength);
                for (const msg of newMessages) {
                  sessionManager.appendMessage(sessionId, msg);
                }

                // Auto-generate title for new sessions
                if (isNewSession) {
                  const title = generateTitle(newMessages);
                  sessionManager.updateTitle(sessionId, title);
                  Logger.log('CHAT', `Generated title for session: ${title}`);
                }

                Logger.log(
                  'CHAT',
                  `Saved ${newMessages.length} messages to session ${sessionId}`
                );
              }
            }
          }
        } catch (error) {
          sse.error(error instanceof Error ? error : new Error(String(error)));
        } finally {
          clearGlobalAbortController();
        }
      } else {
        // Non-streaming mode not implemented
        res.status(501).json({
          error: {
            message:
              'Non-streaming mode is not supported. Please use stream: true.',
            type: 'not_implemented',
          },
        });
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
