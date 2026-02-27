import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { HalfLinePaddedBox } from './shared/HalfLinePaddedBox.js';
import { theme } from '../themes.js';

interface InputPromptProps {
  onSubmit: (text: string) => Promise<void>;
  isStreaming: boolean;
}

export function InputPrompt({ onSubmit, isStreaming }: InputPromptProps) {
  const [input, setInput] = useState('');
  const placeholder = '  Type your message or @path/to/file';

  useInput(
    // 每次按键都会触发这个回调
    // char: 按下的字符
    // key: 包含修饰键信息的对象 { return, backspace, ctrl, meta, ... }
    (char, key) => {
      // 回车键submit
      if (key.return) {
        const trimmed = input.trim();
        if (trimmed) {
          void onSubmit(trimmed);
          setInput('');
        }
      }

      // 退格操作, 删除一个内容
      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
        return;
      }

      // regular input filter out ctrl keys for more operations
      if (!key.ctrl && !key.meta) {
        setInput((prev) => prev + char);
      }
    }
  );

  const isInputEmpty = input.length === 0;
  const bgColor = '#585959';

  // input区域的布局
  return (
    <HalfLinePaddedBox backgroundColor={bgColor}>
      <Box flexGrow={1} flexDirection="row">
        <Text color={theme.text.accent}>&gt; </Text>
        <Box flexGrow={1}>
          {isInputEmpty ? (
            <Text color={theme.text.secondary} dimColor>
              {placeholder}
            </Text>
          ) : (
            <Text>
              {input}
              {<Text color={theme.text.accent}>▋</Text>}
            </Text>
          )}
        </Box>
      </Box>
    </HalfLinePaddedBox>
  );
}
