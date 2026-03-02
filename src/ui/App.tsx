import { useMemo } from 'react';
import { Box, Static } from 'ink';
import { useUIState } from './contexts/UIStateContext.js';
import { useUIActions } from './contexts/UIActionsContext.js';
import { HistoryItem } from './components/HistoryItem.js';
import { InputPrompt } from './components/InputPrompt.js';
import { Footer } from './components/Footer.js';
import type { AgentCore } from '../agent.js';

interface AppProps {
  agent: AgentCore;
}

export function App({ agent }: AppProps) {
  const {
    history,
    pendingItem,
    streamingState,
    currentModel,
    serverState,
    terminalWidth,
  } = useUIState();
  const { submitInput } = useUIActions();

  const workspace = agent.workspaceDir;

  const historyItems = useMemo(
    () =>
      history.map((item, index) => (
        <HistoryItem
          key={index}
          item={item}
          agent={agent}
          terminalWidth={terminalWidth}
        />
      )),
    [history, agent, terminalWidth]
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Static items={historyItems}>{(item) => item}</Static>
      {pendingItem && (
        <HistoryItem
          item={pendingItem}
          agent={agent}
          terminalWidth={terminalWidth}
        />
      )}
      <Box marginTop={1}>
        <InputPrompt
          onSubmit={submitInput}
          isStreaming={streamingState === 'streaming'}
        />
      </Box>
      <Footer
        workspace={workspace}
        model={currentModel}
        serverState={serverState}
        terminalWidth={terminalWidth}
      />
    </Box>
  );
}
