import { useState, useCallback } from 'react';
import { useStdout } from 'ink';
import { App } from './App.js';
import { UIStateContext } from './contexts/UIStateContext.js';
import { UIActionsContext } from './contexts/UIActionsContext.js';
import { KeypressProvider } from './contexts/KeypressContext.js';
import type { HistoryItem, StreamingState } from './types.js';
import type { AgentCore } from '../agent.js';
import type { AgentEvent } from '../schema/events.js';
import { getCommandRegistry } from '../commands/CommandRegistry.js';
import type { CommandResult } from '../commands/types.js';
import { parseError } from '../util/error-parser.js';

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

  const handleCommandResult = useCallback(
    (result: CommandResult) => {
      switch (result.type) {
        case 'message':
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
          setHistory((prev) => [
            ...prev,
            {
              type: 'help',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'about':
          setHistory((prev) => [
            ...prev,
            {
              type: 'about',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'mcp':
          setHistory((prev) => [
            ...prev,
            {
              type: 'mcp',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'skill':
          setHistory((prev) => [
            ...prev,
            {
              type: 'skill',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'open_url':
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
      }
    },
    [setHistory]
  );

  const submitInput = useCallback(
    async (text: string) => {
      const registry = getCommandRegistry();
      const parsed = registry.parse(text);

      if (parsed.isValid && parsed.command) {
        setHistory((prev) => [
          ...prev,
          { type: 'user', text, timestamp: Date.now() },
        ]);

        try {
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

      setHistory((prev) => [
        ...prev,
        { type: 'user', text, timestamp: Date.now() },
      ]);

      setStreamingState('streaming');
      agent.addUserMessage(text);

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
        agent.messages.pop();
      }

      setStreamingState('idle');
    },
    [agent, handleCommandResult]
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
          <App agent={agent} />
        </UIActionsContext.Provider>
      </UIStateContext.Provider>
    </KeypressProvider>
  );
}
