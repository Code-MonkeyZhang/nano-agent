import { useState, useCallback } from 'react';
import { useStdout } from 'ink';
import { App } from './App.js';
import { UIStateContext } from './contexts/UIStateContext.js';
import { UIActionsContext } from './contexts/UIActionsContext.js';
import { KeypressProvider } from './contexts/KeypressContext.js';
import type { HistoryItem, StreamingState } from './types.js';
import type { AgentCore } from '../agent.js';
import type { AgentEvent } from '../schema/events.js';

interface AppContainerProps {
  agent: AgentCore;
}

// AppContainer主要保存业务逻辑
export function AppContainer({ agent }: AppContainerProps) {
  const { stdout } = useStdout(); // 获取终端窗口的“宽高”

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>('idle');

  const terminalWidth = stdout.columns ?? 80;
  const terminalHeight = stdout.rows ?? 24;
  const currentModel = agent.config.llm.model;
  const currentProvider = agent.config.llm.provider;

  const submitInput = useCallback(
    async (text: string) => {
      setHistory((prev) => [
        ...prev,
        { type: 'user', text, timestamp: Date.now() },
      ]); // append new input to History

      setStreamingState('streaming'); // 提示正在进行streaming
      agent.addUserMessage(text); // add message to Agent

      try {
        const stream = agent.runStream(); // 启动agent stream

        for await (const event of stream as AsyncGenerator<AgentEvent>) {
          // 根据event类型添加进history
          switch (event.type) {
            case 'thinking':
              setHistory((prev) => [
                ...prev,
                {
                  type: 'thinking',
                  text: event.content,
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'content':
              setHistory((prev) => {
                const last = prev[prev.length - 1];
                if (last?.type === 'agent') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + event.content },
                  ];
                }
                return [
                  ...prev,
                  {
                    type: 'agent',
                    text: event.content,
                    timestamp: Date.now(),
                  },
                ];
              });
              break;

            case 'tool_start': {
              const functionName = event.toolCall.function.name;
              const args = event.toolCall.function.arguments ?? {};
              setHistory((prev) => [
                ...prev,
                {
                  type: 'tool',
                  name: functionName,
                  args,
                  result: 'Executing...',
                  success: true,
                  timestamp: Date.now(),
                },
              ]);
              break;
            }

            case 'tool_result': {
              setHistory((prev) => {
                const lastToolIndex = [...prev]
                  .reverse()
                  .findIndex((item) => item.type === 'tool');
                if (lastToolIndex === -1) return prev;

                const actualIndex = prev.length - 1 - lastToolIndex;
                const updated = [...prev];
                const lastTool = updated[actualIndex];
                if (lastTool?.type === 'tool') {
                  updated[actualIndex] = {
                    ...lastTool,
                    result: event.result.content || event.result.error || '',
                    success: event.result.success,
                  };
                }
                return updated;
              });
              break;
            }

            case 'error':
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
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setHistory((prev) => [
          ...prev,
          {
            type: 'error',
            text: errorMessage,
            timestamp: Date.now(),
          },
        ]); // 添加error信息
        agent.messages.pop(); //移除message
      }

      setStreamingState('idle');
    },
    [agent]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const state = {
    history,
    streamingState,
    terminalWidth,
    terminalHeight,
    currentModel,
    currentProvider,
  };

  const actions = {
    submitInput,
    clearHistory,
  };

  return (
    <KeypressProvider>
      <UIStateContext.Provider value={state}>
        <UIActionsContext.Provider value={actions}>
          <App />
        </UIActionsContext.Provider>
      </UIStateContext.Provider>
    </KeypressProvider>
  );
}
