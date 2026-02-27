import type React from 'react';
import { Box, Text, useStdout } from 'ink';

/** 半行内边距的装饰盒子组件
 *
 * 在子组件上下各添加一行装饰字符（▄ 和 ▀），
 * 产生类似边框的视觉效果，常用于输入框等场景。
 */

interface HalfLinePaddedBoxProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export function HalfLinePaddedBox({
  children,
  backgroundColor = '#2d3748',
}: HalfLinePaddedBoxProps) {
  // 获取终端 stdout 信息，用于计算宽度
  const { stdout } = useStdout();
  // 获取终端列数（宽度），默认为 80
  const terminalWidth = stdout.columns || 80;

  return (
    // 外层 Box：竖直排列，宽度设为终端宽度
    <Box flexDirection="column" width={terminalWidth}>
      {/* 上边框：用 ▄ 字符重复铺满，颜色与背景色相同产生"隐形线"效果 */}
      <Text color={backgroundColor}>{'▄'.repeat(terminalWidth)}</Text>

      <Box paddingX={1} width={terminalWidth}>
        {children}
      </Box>

      {/* 下边框：用 ▀ 字符重复铺满 */}
      <Text color={backgroundColor}>{'▀'.repeat(terminalWidth)}</Text>
    </Box>
  );
}
