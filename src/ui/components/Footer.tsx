import { Box, Text } from 'ink';
import { theme } from '../themes.js';
import type { ServerState } from '../types.js';

interface FooterProps {
  workspace: string;
  model: string;
  serverState: ServerState;
  terminalWidth: number;
}

function getServerIndicator(state: ServerState): {
  icon: string;
  color: string;
  label: string;
} {
  switch (state.status) {
    case 'running':
      return { icon: '●', color: 'green', label: 'running' };
    case 'starting':
      return { icon: '●', color: 'yellow', label: 'starting' };
    case 'local':
      return { icon: '●', color: 'blue', label: 'local' };
    case 'error':
      return { icon: '●', color: 'red', label: 'error' };
    case 'stopped':
    default:
      return { icon: '○', color: 'gray', label: 'stopped' };
  }
}

export function Footer({
  workspace,
  model,
  serverState,
  terminalWidth,
}: FooterProps) {
  const shortPath = workspace
    .replace(process.env['HOME'] || '', '~')
    .split('/')
    .slice(-3)
    .join('/');

  const indicator = getServerIndicator(serverState);
  const isNarrow = terminalWidth < 60;

  return (
    <Box justifyContent="space-between" paddingX={1} width="100%">
      <Box>
        <Text color={theme.text.primary}>~/{shortPath}</Text>
      </Box>

      <Box gap={2}>
        <Text>
          <Text color={indicator.color}>{indicator.icon}</Text>
          {!isNarrow && (
            <>
              <Text color={theme.text.secondary}> server:</Text>
              <Text color={indicator.color}> {indicator.label}</Text>
            </>
          )}
        </Text>

        <Text>
          <Text color={theme.text.secondary}>/model </Text>
          <Text color={theme.text.primary}>{model}</Text>
        </Text>
      </Box>
    </Box>
  );
}
