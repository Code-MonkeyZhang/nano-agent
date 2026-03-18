import { Router } from 'express';
import type { Request, Response } from 'express';

import { SSEWriter } from './sse-writer.js';
import { convertOpenAIRequest } from './converters/openai-to-nanoagent.js';
import type { ChatCompletionRequest } from './types/openai-types.js';
import { Logger } from '../util/logger.js';
import {
  createGlobalAbortController,
  clearGlobalAbortController,
} from './http-server.js';
import { createAgent } from '../agent-factory/index.js';
import { getAgentConfig } from '../agent-config/store.js';
import type { Message } from '../schema/index.js';
import type { AgentId } from '../agent-config/types.js';
import type { SessionManager } from '../session/index.js';

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
 * @param sessionManagers - Map of agentId -> SessionManager
 * @returns Express Router with `/completions` endpoint.
 */
export function createChatRouter(
  sessionManagers?: Map<string, SessionManager>
): Router {
  const router = Router();

  /**
   * OpenAI 兼容的聊天补全端点
   *
   * 接收 Openai 格式的聊天补全请求
   * - 验证请求消息格式
   * - 将请求转换为内部格式
   * - 调用 AgentCore 处理消息
   * - 通过 SSE 返回流式响应或同步返回完整响应
   */
  router.post('/completions', async (req: Request, res: Response) => {
    const body = req.body as ChatCompletionRequest;

    try {
      if (!body.messages || !Array.isArray(body.messages)) {
        throw new Error('Invalid messages array');
      }

      const { messages: requestMessages } = convertOpenAIRequest(body);
      const sessionId = body.sessionId;

      // Get session manager based on agentId from session or default to 'adam'
      let agentId: AgentId = 'adam';
      let sessionManager: SessionManager | undefined;

      if (sessionId && sessionManagers) {
        // Try to find the session in any agent's session manager
        for (const [, manager] of sessionManagers) {
          const session = manager.getSession(sessionId);
          if (session) {
            agentId = session.agentId;
            sessionManager = manager;
            break;
          }
        }
      }

      // If not found by sessionId, use default agent's session manager
      if (!sessionManager && sessionManagers) {
        sessionManager = sessionManagers.get(agentId);
      }

      let isNewSession = false;
      let workspacePath: string | undefined;
      let sessionModelId: string | undefined;

      if (sessionId && sessionManager) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          agentId = session.agentId;
          // Re-fetch session manager for the correct agent
          if (sessionManagers) {
            sessionManager = sessionManagers.get(agentId);
          }
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

      const abortController = createGlobalAbortController();
      const signal = abortController.signal;

      // generate text stream
      if (body.stream) {
        const sse = new SSEWriter(res);
        let wasAborted = false;
        try {
          sse.writeEvent('message_start', {});

          for await (const event of agent.runStream()) {
            if (signal.aborted) {
              Logger.log('CHAT', 'Generation aborted by user');
              sse.writeEvent('error', {
                error: '生成已被用户中断',
              });
              wasAborted = true;
              sse.writeEvent('done', {});
              break;
            }

            switch (event.type) {
              case 'thinking':
                sse.writeEvent('thinking', { delta: event.content });
                break;

              case 'content':
                sse.writeEvent('content', { delta: event.content });
                break;

              case 'tool_call':
                for (const tc of event.tool_calls) {
                  const input =
                    typeof tc.function.arguments === 'string'
                      ? JSON.parse(tc.function.arguments)
                      : tc.function.arguments;
                  sse.writeEvent('tool_call', {
                    id: tc.id,
                    name: tc.function.name,
                    input,
                  });
                }
                break;

              case 'tool_start':
                sse.writeEvent('tool_start', { toolId: event.toolCall.id });
                break;

              case 'tool_result':
                sse.writeEvent('tool_result', {
                  toolId: event.toolCallId,
                  result: event.result.success
                    ? event.result.content
                    : (event.result.error ?? 'Unknown error'),
                  success: event.result.success,
                });
                break;

              case 'step_start':
                sse.writeEvent('step_start', {
                  step: event.step,
                  maxSteps: event.maxSteps,
                });
                break;

              case 'error':
                sse.writeEvent('error', { error: event.error });
                break;
            }
          }

          if (!wasAborted) {
            sse.writeEvent('complete', {});
            sse.writeEvent('done', {});
            sse.done();

            if (sessionId && sessionManager) {
              const lastMsg = agent.messages[agent.messages.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                const newMessages = agent.messages.slice(historyLength);
                for (const msg of newMessages) {
                  sessionManager.appendMessage(sessionId, msg);
                }

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
          sse.writeEvent('error', {
            error: error instanceof Error ? error.message : String(error),
          });
          sse.writeEvent('done', {});
          sse.done();
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

      if (errorMessage.includes('No credential found')) {
        const providerMatch = errorMessage.match(/provider '(\w+)'/);
        const provider = providerMatch ? providerMatch[1] : 'unknown';
        res.status(401).json({
          error: {
            code: 'MISSING_CREDENTIALS',
            message: `API key not configured for provider '${provider}'. Please configure your API key in Settings.`,
            type: 'authentication_error',
            provider,
          },
        });
      } else if (
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
