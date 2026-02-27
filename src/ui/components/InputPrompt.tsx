import { useState } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { HalfLinePaddedBox } from './shared/HalfLinePaddedBox.js';
import { theme } from '../themes.js';
import { useKeypress } from '../hooks/useKeypress.js';

interface InputPromptProps {
  onSubmit: (text: string) => Promise<void>;
  isStreaming: boolean;
}

export function InputPrompt({ onSubmit, isStreaming }: InputPromptProps) {
  const [input, setInput] = useState('');
  const placeholder = '  Type your message or @path/to/file';

  useKeypress((key) => {
    if (isStreaming) return false;

    if (key.name === 'return') {
      const trimmed = input.trim();
      if (trimmed) {
        void onSubmit(trimmed);
        setInput('');
      }
      return true;
    }

    if (key.name === 'backspace' || key.name === 'delete') {
      setInput((prev) => prev.slice(0, -1));
      return true;
    }

    if (key.insertable) {
      setInput((prev) => prev + key.sequence);
      return true;
    }

    return false;
  });

  const isInputEmpty = input.length === 0;
  const bgColor = '#585959';

  const renderContent = () => {
    if (isInputEmpty) {
      return (
        <Text
          terminalCursorFocus={true}
          terminalCursorPosition={0}
          color={theme.text.secondary}
          dimColor
        >
          {chalk.inverse(placeholder[0])}
          {placeholder.slice(1)}
        </Text>
      );
    }

    const cursorPos = stringWidth(input);
    return (
      <Text terminalCursorFocus={true} terminalCursorPosition={cursorPos}>
        {input}
        {chalk.inverse(' ')}
      </Text>
    );
  };

  return (
    <HalfLinePaddedBox backgroundColor={bgColor}>
      <Box flexGrow={1} flexDirection="row">
        <Text color={theme.text.accent}>&gt; </Text>
        <Box flexGrow={1}>{renderContent()}</Box>
      </Box>
    </HalfLinePaddedBox>
  );
}
