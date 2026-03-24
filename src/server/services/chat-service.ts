/**
 * @fileoverview Chat service - core logic for processing messages.
 */

import type { SessionManager } from '../../session/index.js';
import {
  getAgentConfig,
  AgentCore,
  createAgentRunConfig,
} from '../../agent/index.js';
import { Logger } from '../../util/logger.js';
import { broadcastToSession } from '../websocket-server.js';

interface ChatRequest {
  agentId: string;
  sessionId: string;
  content: string;
  sessionManager: SessionManager;
}

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
    return { success: false, error: `Session not found: ${sessionId}` };
  }

  const agentConfig = getAgentConfig(agentId);
  if (!agentConfig) {
    return { success: false, error: `Agent not found: ${agentId}` };
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

    // 创建一个临时容器, 收集当前step的所有内容 方便广播
    let currentStep: {
      stepIndex: number;
      thinking: string;
      content: string;
    } | null = null;

    // 开启agent loop循环
    for await (const event of agent.runStream()) {
      switch (event.type) {
        case 'step_start':
          // 如果有上一个step，构建消息并push到agent，然后保存并广播
          if (currentStep) {
            agent.messages.push({
              role: 'assistant',
              content: currentStep.content,
              thinking: currentStep.thinking || undefined,
            });
            saveStepMessages(sessionManager, sessionId, agent, historyLength);
            broadcastToSession(sessionId, {
              type: 'step_complete',
              sessionId,
              ...currentStep,
            });
          }
          // 创建新的step对象，用于收集本轮的思考和输出
          currentStep = {
            stepIndex: event.step,
            thinking: '',
            content: '',
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

        case 'error':
          return { success: false, error: event.error };
      }
    }

    // 处理最后一个step：构建消息并push到agent，然后保存并广播
    if (currentStep) {
      agent.messages.push({
        role: 'assistant',
        content: currentStep.content,
        thinking: currentStep.thinking || undefined,
      });
      saveStepMessages(sessionManager, sessionId, agent, historyLength);
      broadcastToSession(sessionId, {
        type: 'step_complete',
        sessionId,
        ...currentStep,
      });
    }

    // 发送完成信号
    broadcastToSession(sessionId, { type: 'complete', sessionId });

    return { success: true };
  } catch (error) {
    const err = error as Error;
    Logger.log('CHAT', `Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}
