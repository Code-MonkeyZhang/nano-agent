import { Box, Text } from 'ink';
import { theme } from '../../themes.js';

interface ErrorMessageProps {
  text: string;
}

export function ErrorMessage({ text }: ErrorMessageProps) {
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
    </Box>
  );
}
