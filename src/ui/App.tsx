import { Box } from 'ink';
import { useUIState } from './contexts/UIStateContext.js';
import { useUIActions } from './contexts/UIActionsContext.js';
import { HistoryList } from './components/HistoryList.js';
import { InputPrompt } from './components/InputPrompt.js';
import { Footer } from './components/Footer.js';
import type { AgentCore } from '../agent.js';

interface AppProps {
  agent: AgentCore;
}

export function App({ agent }: AppProps) {
  const { history, streamingState, currentModel } = useUIState();
  const { submitInput } = useUIActions();

  const workspace = agent.workspaceDir;

  return (
    <Box flexDirection="column" flexGrow={1}>
      <HistoryList items={history} agent={agent} />
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
