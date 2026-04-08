/**
 * @fileoverview 聊天服务 - 处理消息的核心逻辑。
 */

import type { SessionManager } from '../../session/index.js';
import {
  getAgentConfig,
  AgentCore,
  createAgentRunConfig,
} from '../../agent/index.js';
import type { ToolCall } from '../../schema/index.js';
import type { ToolResult } from '../../tools/index.js';
import { Logger } from '../../util/logger.js';
import { broadcastToSession } from '../websocket-server.js';
import { generateTitle } from '../../session/title-generator.js';

const MAX_RESULT_LENGTH = 1000;

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}...`;
}

/**
 * 处理聊天消息的请求参数。
 */
interface ChatRequest {
  agentId: string;
  sessionId: string;
  content: string;
  sessionManager: SessionManager;
}

/**
 * 处理聊天消息的响应。
 */
interface ChatResponse {
  success: boolean;
  error?: string;
}

/**
 * 增量保存消息到Session中
 *
 * 从 agent 的消息列表中提取新增消息（通过 historyLength 确定边界），
 * 并逐条追加到Session管理器中进行持久化存储。
 *
 * @param sessionManager - Session管理器，负责消息持久化
 * @param sessionId - Session唯一标识符
 * @param agent - agent核心对象，包含完整的消息历史
 * @param historyLength - 历史消息长度，用于界定新增消息的起始位置
 */
function saveStepMessages(
  sessionManager: SessionManager,
  sessionId: string,
  agent: AgentCore,
  historyLength: number
): void {
  const newMessages = agent.messages.slice(historyLength);
  for (const msg of newMessages) {
    sessionManager.appendMessage(sessionId, msg);
  }
}

/**
 * 处理聊天请求，执行 Agent 对话流程
 *
 * @param request - 聊天请求参数
 * @param request.agentId - Agent 标识符
 * @param request.sessionId - Session标识符
 * @param request.content - 用户消息内容
 * @param request.sessionManager - Session管理器
 *
 * @returns 聊天响应，包含成功状态和可能的错误信息
 * 实时内容通过 WebSocket step_complete 事件推送
 */
export async function processChat(request: ChatRequest): Promise<ChatResponse> {
  const { agentId, sessionId, content, sessionManager } = request;

  const session = sessionManager.getSession(sessionId);
  // TODO: 这个已经在外面查过了, 是不是不用再查一遍了? 或者这个本来就应该放在这里check?
  if (!session) {
    const errorMsg = `Session not found: ${sessionId}`;
    broadcastToSession(sessionId, {
      type: 'error',
      sessionId,
      message: errorMsg,
    });
    broadcastToSession(sessionId, { type: 'complete', sessionId });
    return { success: false, error: errorMsg };
  }

  const agentConfig = getAgentConfig(agentId);
  if (!agentConfig) {
    const errorMsg = `Agent not found: ${agentId}`;
    broadcastToSession(sessionId, {
      type: 'error',
      sessionId,
      message: errorMsg,
    });
    broadcastToSession(sessionId, { type: 'complete', sessionId });
    return { success: false, error: errorMsg };
  }

  //TODO: 这里不应该使用当前目录作为兜底, 应该在./nano-agent这个文件夹中有一个空的workspace作为默认工作目录
  const workspaceDir =
    session.workspacePath || agentConfig.defaultWorkspacePath || process.cwd();

  try {
    // 构建AgentConfig, 创建AgentCore
    const runConfig = createAgentRunConfig(agentConfig, session, workspaceDir);
    const agent = new AgentCore(runConfig);

    // 把除了SystemPrompt以外的消息推入Agent, 新的SystemPrompt已经在构建AgentCore时注入了
    for (const msg of session.messages) {
      if (msg.role !== 'system') {
        agent.messages.push(msg);
      }
    }

    const historyLength = agent.messages.length;
    agent.addUserMessage(content);
    Logger.log('CHAT', 'User message added', { agentId, sessionId, content });

    // Fire-and-forget: auto-generate title on the first message
    const isFirstMessage = session.messageCount === 0;
    const isDefaultTitle = session.title === 'New Session';
    if (isFirstMessage && isDefaultTitle) {
      Logger.log('TITLE', 'Auto-generating title', { sessionId });
      const { provider: modelProvider, model: modelId } = session.model;
      generateTitle(content, modelProvider, modelId)
        .then((title) => {
          if (!title) {
            Logger.log('TITLE', 'Generation returned empty', { sessionId });
            return;
          }
          Logger.log('TITLE', 'Title generated', { sessionId, title });
          sessionManager.updateTitle(sessionId, title);
          broadcastToSession(sessionId, {
            type: 'title_updated',
            sessionId,
            title,
          });
        })
        .catch((err) => {
          Logger.log('TITLE', 'Generation error', {
            sessionId,
            error: (err as Error).message,
          });
        });
    }

    // 创建一个临时容器, 收集当前step的所有内容 方便广播
    let currentStep: {
      stepIndex: number;
      thinking: string;
      content: string;
      toolCalls: ToolCall[];
      toolResults: {
        toolCallId: string;
        toolName: string;
        result: string;
        success: boolean;
      }[];
    } | null = null;

    /** Build a step_complete event payload from the current step accumulator. */
    const buildStepCompleteEvent = () => ({
      type: 'step_complete' as const,
      sessionId,
      stepIndex: currentStep!.stepIndex,
      thinking: currentStep!.thinking || undefined,
      // TODO: 临时去重 — 某些 OpenAI 兼容提供者会在 content 和 reasoning_content 中返回相同文本，
      // 导致 thinking 与 content 完全一致。应在 agent.ts 层面改用 streamSimple() 正确控制 reasoning 行为。
      content:
        currentStep!.thinking && currentStep!.thinking === currentStep!.content
          ? undefined
          : currentStep!.content || undefined,
      toolCalls:
        currentStep!.toolCalls.length > 0
          ? currentStep!.toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            }))
          : undefined,
      toolResults:
        currentStep!.toolResults.length > 0
          ? currentStep!.toolResults
          : undefined,
    });

    /**
     * Flush the current step: save messages, log, and broadcast step_complete.
     * Resets currentStep to null after broadcasting.
     */
    const flushCurrentStep = () => {
      if (!currentStep) return;
      saveStepMessages(sessionManager, sessionId, agent, historyLength);
      Logger.log('CHAT', 'Step complete', {
        sessionId,
        stepIndex: currentStep.stepIndex,
        thinking: currentStep.thinking,
        content: currentStep.content,
        toolCallCount: currentStep.toolCalls.length,
        toolResultCount: currentStep.toolResults.length,
      });
      for (const tr of currentStep.toolResults) {
        const toolCall = currentStep.toolCalls.find(
          (tc) => tc.id === tr.toolCallId
        );
        Logger.log('TOOL', `Tool executed: ${tr.toolName}`, {
          sessionId,
          toolName: tr.toolName,
          arguments: toolCall?.function.arguments,
          success: tr.success,
          result: truncate(tr.result, MAX_RESULT_LENGTH),
        });
      }
      broadcastToSession(sessionId, buildStepCompleteEvent());
    };

    // 开启agent loop循环
    for await (const event of agent.runStream()) {
      switch (event.type) {
        case 'step_start':
          flushCurrentStep();
          currentStep = {
            stepIndex: event.step,
            thinking: '',
            content: '',
            toolCalls: [],
            toolResults: [],
          };
          break;

        case 'thinking':
          if (currentStep) {
            currentStep.thinking += event.content;
          }
          break;

        case 'content':
          if (currentStep) {
            currentStep.content += event.content;
          }
          break;

        case 'tool_call':
          if (currentStep) {
            currentStep.toolCalls.push(...event.tool_calls);
          }
          break;

        case 'tool_result': {
          if (currentStep) {
            const tr: ToolResult = event.result;
            currentStep.toolResults.push({
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              result: tr.success
                ? tr.content
                : `Error: ${tr.error ?? 'Unknown error'}`,
              success: tr.success,
            });
          }
          break;
        }

        case 'error': {
          flushCurrentStep();
          broadcastToSession(sessionId, {
            type: 'error',
            sessionId,
            message: event.error,
          });
          broadcastToSession(sessionId, { type: 'complete', sessionId });
          return { success: false, error: event.error };
        }
      }
    }

    // 处理最后一个step
    flushCurrentStep();

    // 发送完成信号
    broadcastToSession(sessionId, { type: 'complete', sessionId });
    return { success: true };
  } catch (error) {
    const err = error as Error;
    Logger.log('CHAT', 'Error', { agentId, sessionId, error: err.message });
    broadcastToSession(sessionId, {
      type: 'error',
      sessionId,
      message: err.message,
    });
    broadcastToSession(sessionId, { type: 'complete', sessionId });
    return { success: false, error: err.message };
  }
}
