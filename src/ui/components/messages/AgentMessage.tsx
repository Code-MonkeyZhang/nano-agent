import { Box, Text } from 'ink';
import { theme } from '../../themes.js';

/**
 * Agent response component.
 * Layout: Left side shows prefix "✦ " with fixed width (2),
 * right side shows content with flexible width.
 *
 * Example:
 * ✦ This is Agent's response
 */
interface AgentMessageProps {
  text: string;
}

export function AgentMessage({ text }: AgentMessageProps) {
  const prefix = '✦ ';

  return (
    <Box flexDirection="row" paddingY={1}>
      <Box width={2} flexShrink={0}>
        <Text color={theme.text.accent}>{prefix}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="wrap">{text}</Text>
      </Box>
    </Box>
  );
}
