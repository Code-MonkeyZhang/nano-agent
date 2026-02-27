import { Box, Text } from 'ink';
import { theme, messageStyles } from '../../themes.js';

interface ToolMessageProps {
  name: string;
  result: string;
  success: boolean;
}

export function ToolMessage({ name, result, success }: ToolMessageProps) {
  const statusIcon = success ? '✓' : '✗';
  const statusText = success ? 'Success' : 'Failed';
  const borderColor = success ? theme.status.success : theme.status.error;
  const truncatedResult =
    result.length > 200 ? `${result.slice(0, 200)}...` : result;

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
    >
      <Box>
        <Text color={theme.text.accent} bold>
          {messageStyles.tool.icon} {name}
        </Text>
        <Text> </Text>
        <Text color={borderColor}>
          {statusIcon} {statusText}
        </Text>
      </Box>
      {result && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary} dimColor>
            Result:
          </Text>
          {result.length > 200 ? (
            <Box flexDirection="column">
              <Text>{truncatedResult}</Text>
              <Text color={theme.text.secondary} dimColor>
                ({result.length - 200} more characters...)
              </Text>
            </Box>
          ) : (
            <Text>{result}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
