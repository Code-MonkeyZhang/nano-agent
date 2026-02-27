import { Box, Text } from 'ink';
import { theme } from '../../themes.js';

/**
 * Thinking indicator component.
 * Shows when Agent is processing/thinking, with 🧠 emoji and dimmed text.
 *
 */
interface ThinkingMessageProps {
  text: string;
}

export function ThinkingMessage({ text }: ThinkingMessageProps) {
  return (
    <Box paddingY={1}>
      <Text color={theme.text.secondary} dimColor>
        🧠 {text}
      </Text>
    </Box>
  );
}
