import type React from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';

interface HalfLinePaddedBoxProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export function HalfLinePaddedBox({
  children,
  backgroundColor = '#2d3748',
}: HalfLinePaddedBoxProps) {
  const { columns: terminalWidth } = useTerminalSize();

  return (
    <Box flexDirection="column" width={terminalWidth}>
      <Text color={backgroundColor}>{'▄'.repeat(terminalWidth)}</Text>

      <Box paddingX={1} width={terminalWidth} backgroundColor={backgroundColor}>
        {children}
      </Box>

      <Text color={backgroundColor}>{'▀'.repeat(terminalWidth)}</Text>
    </Box>
  );
}
