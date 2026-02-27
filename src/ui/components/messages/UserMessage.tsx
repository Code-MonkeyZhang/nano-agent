import { Box, Text } from 'ink';
import { theme } from '../../themes.js';

/**
 * User message component.
 * Layout: Left side shows prefix "> " with fixed width (2),
 * right side shows content with flexible width.
 *
 * Example:
 * > Hello, this is my message
 */
interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  return (
    <Box flexDirection="row" paddingY={1}>
      <Box width={2} flexShrink={0}>
        <Text color={theme.text.accent}>&gt; </Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="wrap" color={theme.text.secondary}>
          {text}
        </Text>
      </Box>
    </Box>
  );
}
