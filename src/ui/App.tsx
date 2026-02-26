import { Box, Text } from 'ink';
import { useUIState } from './contexts/UIStateContext.js';
import { useUIActions } from './contexts/UIActionsContext.js';
import { HistoryList } from './components/HistoryList.js';
import { InputPrompt } from './components/InputPrompt.js';

export function App() {
  const {
    history,
    streamingState,
    terminalWidth,
    currentModel,
    currentProvider,
  } = useUIState();
  const { submitInput } = useUIActions();

  return (
    <Box flexDirection="column" width={terminalWidth} paddingX={1}>
      {/* 标题 */}
      <Box marginBottom={1}>
        <Text bold color="magenta">
          🤖 Nano Agent
        </Text>
        <Text color="gray">
          {' '}
          | {currentProvider} | {currentModel}
        </Text>
      </Box>

      {/* 分隔线 */}
      <Box marginBottom={1}>
        <Text color="gray">{'─'.repeat(Math.min(terminalWidth - 2, 60))}</Text>
      </Box>

      {/* 消息历史 */}
      <Box flexDirection="column" flexGrow={1}>
        <HistoryList items={history} />
      </Box>

      {/* 流式响应指示器 */}
      {streamingState === 'streaming' && (
        <Box marginBottom={1}>
          <Text color="yellow">⏳ Agent is thinking...</Text>
        </Box>
      )}

      {/* 输入框 */}
      <Box marginTop={1}>
        <InputPrompt
          onSubmit={submitInput}
          isStreaming={streamingState === 'streaming'}
        />
      </Box>
    </Box>
  );
}
