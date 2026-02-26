import { Box, Text } from 'ink';

interface ThinkingMessageProps {
  text: string;
}

export function ThinkingMessage({ text }: ThinkingMessageProps) {
  return (
    <Box marginBottom={1}>
      <Text color="gray">🧠 {text}</Text>
    </Box>
  );
}
