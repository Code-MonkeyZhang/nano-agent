import { Box, Text } from 'ink';
import { theme } from '../../themes.js';

interface ErrorMessageProps {
  text: string;
  code?: string;
  suggestion?: string;
}

export function ErrorMessage({ text, suggestion }: ErrorMessageProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.status.error}
      paddingX={1}
      marginY={1}
    >
      <Text color={theme.status.error} bold>
        ✗ Error
      </Text>
      <Text color={theme.status.error}>{text}</Text>
      {suggestion ? <Text color="gray">Suggestion: {suggestion}</Text> : null}
    </Box>
  );
}
