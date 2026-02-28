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

/**
 * 终端输入框组件
 */
export function InputPrompt({ onSubmit, isStreaming }: InputPromptProps) {
  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const placeholder = '  Type your message or @path/to/file';

  /**
   * 在光标位置插入文本
   */
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

  /**
   * 删除光标前的字符
   */
  const deleteBeforeCursor = useCallback(() => {
    if (cursorPos === 0) return;
    setInput((prev) => {
      const before = cpSlice(prev, 0, cursorPos - 1);
      const after = cpSlice(prev, cursorPos);
      return before + after;
    });
    setCursorPos((prev) => prev - 1);
  }, [cursorPos]);

  /**
   * 提交输入
   */
  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed) {
      void onSubmit(trimmed);
      setInput('');
      setCursorPos(0);
    }
  }, [input, onSubmit]);

  /**
   * 键盘事件处理
   */
  useKeypress((key) => {
    if (isStreaming) return false;

    // 回车提交
    if (key.name === 'return') {
      submit();
      return true;
    }

    // 左箭头 - 光标左移
    if (key.name === 'left') {
      if (cursorPos > 0) {
        setCursorPos((prev) => prev - 1);
      }
      return true;
    }

    // 右箭头 - 光标右移
    if (key.name === 'right') {
      const length = cpLen(input);
      if (cursorPos < length) {
        setCursorPos((prev) => prev + 1);
      }
      return true;
    }

    // 退格/删除 - 删除光标前字符
    if (key.name === 'backspace' || key.name === 'delete') {
      deleteBeforeCursor();
      return true;
    }

    // 普通字符 - 在光标位置插入
    if (key.insertable) {
      insertAtCursor(key.sequence);
      return true;
    }

    return false;
  });

  const isInputEmpty = input.length === 0;
  const bgColor = '#585959';

  /**
   * 渲染输入内容
   * 核心思路：把字符串切成三段，用反色显示中间那段来模拟光标
   *
   * 假设 input = "hello", cursorPos = 2
   * 三段分割：
   *   - textBeforeCursor = "he"     (索引 0 到 2，不含 2)
   *   - charAtCursor     = "l"      (索引 2)
   *   - 光标后的文本      = "lo"     (索引 3 开始)
   *
   * 渲染结果：he[l]o （l 用反色显示）
   */
  const renderContent = () => {
    // 没有输入时 显示占位符
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

    // 把字符串切成三段
    const textBeforeCursor = cpSlice(input, 0, cursorPos); // 光标前的文本
    const visualCursorPos = stringWidth(textBeforeCursor); // 视觉位置（处理中文/emoji）
    const charAtCursor = cpSlice(input, cursorPos, cursorPos + 1); // 光标位置的字符
    const textAfterCursor = cpSlice(input, cursorPos + 1); // 光标后的文本

    return (
      <Text terminalCursorFocus={true} terminalCursorPosition={visualCursorPos}>
        {textBeforeCursor}
        {/* 光标：反色显示当前字符，或显示反色空格 */}
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
