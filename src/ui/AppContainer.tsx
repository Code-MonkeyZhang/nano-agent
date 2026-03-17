/**
 * Nano-Agent 主应用容器组件
 *
 * 职责:
 * - 管理对话历史 (history)
 * - 处理用户输入和 Agent 响应流
 * - 提供 UI 状态和操作上下文
 * - 显示启动摘要 (StartupSummary)
 *
 * 状态管理:
 * - history: 已完成的历史项（不可变）
 * - pendingItem: 正在流式输出的当前项（可变）
 * - streamingState: 流式响应状态 (idle/streaming)
 * - serverState: MCP 服务器状态
 */

import { useState, useCallback, useEffect } from 'react';
import { Box } from 'ink';
import { App } from './App.js';
import { UIStateContext } from './contexts/UIStateContext.js';
import { UIActionsContext } from './contexts/UIActionsContext.js';
import { KeypressProvider } from './contexts/KeypressContext.js';
import { StartupSummary } from './components/StartupSummary.js';
import type { HistoryItem, StreamingState, ServerState } from './types.js';
import type { AgentCore } from '../agent.js';
import type { AgentEvent } from '../schema/events.js';
import { getCommandRegistry } from './commands/CommandRegistry.js';
import type { CommandResult } from './commands/types.js';
import { parseError } from '../util/error-parser.js';
import { getServerManager } from '../server/index.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useStateAndRef } from './hooks/useStateAndRef.js';

/** MCP 服务器初始状态 */
const initialServerState: ServerState = { status: 'stopped' };

interface AppContainerProps {
  agent: AgentCore;
}

/**
 * 主应用容器组件
 * 管理整个应用的 UI 状态和核心交互逻辑
 */
export function AppContainer({ agent }: AppContainerProps) {
  const { columns: terminalWidth } = useTerminalSize();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingItem, pendingItemRef, setPendingItem] =
    useStateAndRef<HistoryItem | null>(null);
  const [streamingState, setStreamingState] = useState<StreamingState>('idle');
  const [serverState, setServerState] =
    useState<ServerState>(initialServerState);
  const [showStartup, setShowStartup] = useState(true);

  const currentModel = agent.runConfig.modelId;

  // 监听 MCP 服务器状态变化
  useEffect(() => {
    const manager = getServerManager();
    manager.onStatusChange((state) => {
      setServerState(state);
    });
    setServerState(manager.getState());
  }, []);

  /**
   * 处理命令执行结果
   * 将不同类型的命令结果转换为历史记录
   */
  const handleCommandResult = useCallback(
    (result: CommandResult) => {
      switch (result.type) {
        case 'message':
          // 普通消息
          setHistory((prev) => [
            ...prev,
            {
              type: 'command',
              content: result.content,
              messageType: result.messageType,
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'help':
          // 帮助命令
          setHistory((prev) => [
            ...prev,
            {
              type: 'help',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'about':
          // 关于命令
          setHistory((prev) => [
            ...prev,
            {
              type: 'about',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'mcp':
          // MCP 命令
          setHistory((prev) => [
            ...prev,
            {
              type: 'mcp',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'skill':
          // Skill 命令
          setHistory((prev) => [
            ...prev,
            {
              type: 'skill',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'open_url':
          // 打开 URL 命令
          setHistory((prev) => [
            ...prev,
            {
              type: 'command',
              content: result.message,
              messageType: 'info' as const,
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'server_status':
          // 服务器状态命令
          setHistory((prev) => [
            ...prev,
            {
              type: 'server_status',
              state: result.state,
              timestamp: Date.now(),
            },
          ]);
          break;
      }
    },
    [setHistory]
  );

  /**
   * 处理提交用户输入的函数
   * 处理两种类型的输入:
   * - Slash command - 通过命令注册表执行
   * - 普通对话 - 调用 Agent 进行流式响应
   */
  const submitInput = useCallback(
    async (text: string) => {
      // 隐藏启动摘要
      setShowStartup(false);

      // 解析命令
      const registry = getCommandRegistry();
      const parsed = registry.parse(text);

      // ===== 处理command命令 =====
      if (parsed.isValid && parsed.command) {
        setHistory((prev) => [
          ...prev,
          { type: 'user', text, timestamp: Date.now() },
        ]);

        try {
          // 执行命令
          const result = await registry.execute(parsed.command, {
            agent,
            args: parsed.args,
          });
          handleCommandResult(result);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          setHistory((prev) => [
            ...prev,
            {
              type: 'command',
              content: `❌ Command failed: ${errorMessage}`,
              messageType: 'error',
              timestamp: Date.now(),
            },
          ]);
        }
        return;
      }

      // ===== 处理普通对话输入 =====
      // 将用户消息添加到历史
      setHistory((prev) => [
        ...prev,
        { type: 'user', text, timestamp: Date.now() },
      ]);

      // 开始流式响应
      setStreamingState('streaming');
      agent.addUserMessage(text);

      try {
        const stream = agent.runStream();

        // ===== 处理流式事件 =====
        for await (const event of stream as AsyncGenerator<AgentEvent>) {
          switch (event.type) {
            case 'thinking':
              // thinking 消息完成后添加到 history
              setHistory((prev) => [
                ...prev,
                {
                  type: 'thinking',
                  text: event.content,
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'content': {
              // 如果有非 agent 类型的 pendingItem（如 tool），先移到 history
              const contentItemToFlush = pendingItemRef.current;
              if (contentItemToFlush && contentItemToFlush.type !== 'agent') {
                setHistory((prev) => [...prev, contentItemToFlush]);
                setPendingItem(null);
              }

              // content 消息使用 pendingItem（可实时更新）
              setPendingItem((prev) => {
                if (prev?.type === 'agent') {
                  return { ...prev, text: prev.text + event.content };
                }
                return {
                  type: 'agent',
                  text: event.content,
                  timestamp: Date.now(),
                };
              });
              break;
            }

            case 'tool_start': {
              // 如果有 pendingItem，先移到 history
              const itemToFlush = pendingItemRef.current;
              if (itemToFlush) {
                setHistory((prev) => [...prev, itemToFlush]);
                setPendingItem(null);
              }

              // 添加 tool 消息到 pendingItem
              const functionName = event.toolCall.function.name;
              const args = event.toolCall.function.arguments ?? {};
              setPendingItem({
                type: 'tool',
                name: functionName,
                args,
                result: 'Executing...',
                success: true,
                timestamp: Date.now(),
              });
              break;
            }

            case 'tool_result': {
              // 工具完成时，立即推送到 history（Static）
              const toolItemToFlush = pendingItemRef.current;
              if (toolItemToFlush && toolItemToFlush.type === 'tool') {
                const completedTool = {
                  ...toolItemToFlush,
                  result: event.result.content || event.result.error || '',
                  success: event.result.success,
                };
                setHistory((prev) => [...prev, completedTool]);
                setPendingItem(null);
              }
              break;
            }

            case 'error':
              // 如果有 pendingItem，先移到 history
              const errorItemToFlush = pendingItemRef.current;
              if (errorItemToFlush) {
                setHistory((prev) => [...prev, errorItemToFlush]);
                setPendingItem(null);
              }

              // error 消息完成后添加到 history
              setHistory((prev) => [
                ...prev,
                {
                  type: 'error',
                  text: event.error,
                  timestamp: Date.now(),
                },
              ]);
              break;
          }
        }

        // 流结束：将 pendingItem 移到 history
        const streamEndItemToFlush = pendingItemRef.current;
        if (streamEndItemToFlush) {
          setHistory((prev) => [...prev, streamEndItemToFlush]);
          setPendingItem(null);
        }
      } catch (error) {
        // 如果有 pendingItem，先移到 history
        const catchItemToFlush = pendingItemRef.current;
        if (catchItemToFlush) {
          setHistory((prev) => [...prev, catchItemToFlush]);
          setPendingItem(null);
        }

        const parsed = parseError(error);
        setHistory((prev) => [
          ...prev,
          {
            type: 'error',
            text: parsed.text,
            code: parsed.code,
            suggestion: parsed.suggestion,
            timestamp: Date.now(),
          },
        ]);
        // 移除未完成的用户消息
        agent.messages.pop();
      }

      // 流式响应结束
      setStreamingState('idle');
    },
    [agent, handleCommandResult]
  );

  /** UI 状态上下文值 */
  const state = {
    history,
    pendingItem,
    streamingState,
    terminalWidth,
    currentModel,
    serverState,
  };

  /** UI 操作上下文值 */
  const actions = {
    submitInput,
  };

  // ===== 渲染所有组件 =====
  return (
    <KeypressProvider>
      <UIStateContext.Provider value={state}>
        <UIActionsContext.Provider value={actions}>
          <Box flexDirection="column">
            {/* 启动摘要 */}
            {showStartup && <StartupSummary agent={agent} />}
            {/* 主应用组件 */}
            <App agent={agent} />
          </Box>
        </UIActionsContext.Provider>
      </UIStateContext.Provider>
    </KeypressProvider>
  );
}
