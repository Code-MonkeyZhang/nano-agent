import { Box, Text } from 'ink';

interface ErrorMessageProps {
  text: string;
}

export function ErrorMessage({ text }: ErrorMessageProps) {
  return (
    <Box marginBottom={1}>
      <Text color="red" bold>
        ❌ Error:{' '}
      </Text>
      <Text color="red">{text}</Text>
    </Box>
  );
}
