import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputPromptProps {
  onSubmit: (text: string) => Promise<void>;
  isStreaming: boolean;
}

export function InputPrompt({ onSubmit, isStreaming }: InputPromptProps) {
  const [input, setInput] = useState('');

  useInput(
    (char, key) => {
      if (key.return) {
        if (input.trim()) {
          void onSubmit(input.trim());
          setInput('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
        return;
      }

      if (!key.ctrl && !key.meta) {
        setInput((prev) => prev + char);
      }
    },
    { isActive: !isStreaming }
  );

  return (
    <Box>
      <Text color="cyan" bold>
        You &gt;{' '}
      </Text>
      <Text>{input}</Text>
      {!isStreaming && <Text color="gray">▋</Text>}
      {isStreaming && <Text color="yellow"> ⏳ Waiting...</Text>}
    </Box>
  );
}
