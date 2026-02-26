import { Box, Text } from 'ink';

interface ToolMessageProps {
  name: string;
  result: string;
  success: boolean;
}

export function ToolMessage({ name, result, success }: ToolMessageProps) {
  const icon = success ? '✓' : '✗';
  const color = success ? 'green' : 'red';
  const truncatedResult =
    result.length > 200 ? `${result.slice(0, 200)}...` : result;

  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color="yellow" bold>
        🔧 {name}
      </Text>
      <Text color={color}>
        {icon} {truncatedResult}
      </Text>
    </Box>
  );
}
