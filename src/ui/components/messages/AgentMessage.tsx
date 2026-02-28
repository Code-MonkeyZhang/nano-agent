import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';

const DEFAULT_TERMINAL_WIDTH = 80;

interface AgentMessageProps {
  text: string;
  terminalWidth?: number;
}

export function AgentMessage({
  text,
  terminalWidth = DEFAULT_TERMINAL_WIDTH,
}: AgentMessageProps) {
  const prefix = '✦ ';

  return (
    <Box flexDirection="row" paddingY={1}>
      <Box width={2} flexShrink={0}>
        <Text color={theme.text.accent}>{prefix}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <MarkdownDisplay text={text} terminalWidth={terminalWidth - 2} />
      </Box>
    </Box>
  );
}
