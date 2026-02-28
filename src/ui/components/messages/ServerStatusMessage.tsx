import { Box, Text } from 'ink';
import type { ServerState } from '../../types.js';

interface ServerStatusMessageProps {
  state: ServerState;
}

function getStatusDisplay(status: ServerState['status']): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'running':
      return { icon: '🟢', color: 'green', label: 'Running' };
    case 'starting':
      return { icon: '🟡', color: 'yellow', label: 'Starting' };
    case 'local':
      return { icon: '🔵', color: 'blue', label: 'Local' };
    case 'error':
      return { icon: '🔴', color: 'red', label: 'Error' };
    case 'stopped':
    default:
      return { icon: '⚪', color: 'gray', label: 'Stopped' };
  }
}

export function ServerStatusMessage({ state }: ServerStatusMessageProps) {
  const display = getStatusDisplay(state.status);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={display.color}
      paddingX={1}
      marginY={1}
    >
      <Text color={display.color} bold>
        Server Status
      </Text>
      <Text>
        Status: {display.icon} {display.label}
      </Text>

      {state.localUrl && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Local URLs:</Text>
          <Text color="gray">
            {'  '}API: {state.localUrl}/v1/chat/completions
          </Text>
          <Text color="gray">
            {'  '}WS: {state.localUrl.replace('http', 'ws')}/ws
          </Text>
        </Box>
      )}

      {state.publicUrl && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Public URLs:</Text>
          <Text color="gray">
            {'  '}API: {state.publicUrl}/v1/chat/completions
          </Text>
          <Text color="gray">
            {'  '}WS:{' '}
            {state.publicUrl
              .replace('https://', 'wss://')
              .replace('http://', 'ws://')}
            /ws
          </Text>
        </Box>
      )}

      {state.error && (
        <Box marginTop={1}>
          <Text color="red">Error: {state.error}</Text>
        </Box>
      )}

      {state.status === 'stopped' && !state.error && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Run /server-start to start with tunnel</Text>
          <Text color="gray">Run /server-local for local only</Text>
        </Box>
      )}

      {state.status === 'local' && !state.error && (
        <Box marginTop={1}>
          <Text color="yellow">Tunnel unavailable - server is local only</Text>
        </Box>
      )}
    </Box>
  );
}
