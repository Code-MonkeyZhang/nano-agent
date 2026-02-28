import { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { HalfLinePaddedBox } from './shared/HalfLinePaddedBox.js';
import { theme } from '../themes.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { cpLen, cpSlice } from '../utils/textUtils.js';

interface InputPromptProps {
  onSubmit: (text: string) => Promise<void>;
  isStreaming: boolean;
}

export function InputPrompt({ onSubmit, isStreaming }: InputPromptProps) {
  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const placeholder = '  Type your message...';

  const insertAtCursor = useCallback(
    (text: string) => {
      setInput((prev) => {
        const before = cpSlice(prev, 0, cursorPos);
        const after = cpSlice(prev, cursorPos);
        return before + text + after;
      });
      setCursorPos((prev) => prev + cpLen(text));
    },
    [cursorPos]
  );

  const deleteBeforeCursor = useCallback(() => {
    if (cursorPos === 0) return;
    setInput((prev) => {
      const before = cpSlice(prev, 0, cursorPos - 1);
      const after = cpSlice(prev, cursorPos);
      return before + after;
    });
    setCursorPos((prev) => prev - 1);
  }, [cursorPos]);

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed) {
      void onSubmit(trimmed);
      setInput('');
      setCursorPos(0);
    }
  }, [input, onSubmit]);

  useKeypress((key) => {
    if (isStreaming) return false;

    if (key.name === 'return') {
      submit();
      return true;
    }

    if (key.name === 'left') {
      if (cursorPos > 0) {
        setCursorPos((prev) => prev - 1);
      }
      return true;
    }

    if (key.name === 'right') {
      const length = cpLen(input);
      if (cursorPos < length) {
        setCursorPos((prev) => prev + 1);
      }
      return true;
    }

    if (key.name === 'backspace' || key.name === 'delete') {
      deleteBeforeCursor();
      return true;
    }

    if (key.insertable) {
      insertAtCursor(key.sequence);
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
          color={theme.text.primary}
          dimColor
        >
          {chalk.inverse(placeholder[0])}
          {placeholder.slice(1)}
        </Text>
      );
    }

    const textBeforeCursor = cpSlice(input, 0, cursorPos);
    const visualCursorPos = stringWidth(textBeforeCursor);
    const charAtCursor = cpSlice(input, cursorPos, cursorPos + 1);
    const textAfterCursor = cpSlice(input, cursorPos + 1);

    return (
      <Text terminalCursorFocus={true} terminalCursorPosition={visualCursorPos}>
        {textBeforeCursor}
        {charAtCursor ? chalk.inverse(charAtCursor) : chalk.inverse(' ')}
        {textAfterCursor}
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
