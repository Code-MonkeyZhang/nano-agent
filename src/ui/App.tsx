import { Box } from 'ink';
import { useUIState } from './contexts/UIStateContext.js';
import { useUIActions } from './contexts/UIActionsContext.js';
import { HistoryList } from './components/HistoryList.js';
import { InputPrompt } from './components/InputPrompt.js';
import { Footer } from './components/Footer.js';

// App.tsx 复杂展示组件
export function App() {
  const { history, streamingState, currentModel } = useUIState();
  const { submitInput } = useUIActions();

  const workspace = process.cwd(); // 这个是否应该考虑从 AgentCore获取?

  // UI结构:
  // - HistoryList
  // - InputBox
  // - Footer
  return (
    <Box flexDirection="column" flexGrow={1}>
      <HistoryList items={history} />
      <Box marginTop={1}>
        <InputPrompt
          onSubmit={submitInput}
          isStreaming={streamingState === 'streaming'}
        />
      </Box>
      <Footer workspace={workspace} model={currentModel} />
    </Box>
  );
}
