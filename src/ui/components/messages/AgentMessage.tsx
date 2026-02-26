import { Box, Text } from 'ink';

interface AgentMessageProps {
  text: string;
}

export function AgentMessage({ text }: AgentMessageProps) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color="green" bold>
        Agent:
      </Text>
      <Text>{text}</Text>
    </Box>
  );
}
