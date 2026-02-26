import { Box, Text } from 'ink';

interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  return (
    <Box marginBottom={1}>
      <Text color="cyan" bold>
        You:{' '}
      </Text>
      <Text>{text}</Text>
    </Box>
  );
}
