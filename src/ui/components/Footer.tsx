import { Box, Text } from 'ink';
import { theme } from '../themes.js';

interface FooterProps {
  workspace: string;
  model: string;
}

// Footer组件, 用于显示工作目录和当前模型
export function Footer({ workspace, model }: FooterProps) {
  const shortPath = workspace
    .replace(process.env['HOME'] || '', '~')
    .split('/')
    .slice(-3)
    .join('/');

  return (
    <Box justifyContent="space-between" paddingX={1} width="100%">
      <Box>
        <Text color={theme.text.primary}>~/{shortPath}</Text>
      </Box>

      <Box>
        <Text>
          <Text color={theme.text.secondary}>/model </Text>
          <Text color={theme.text.primary}>{model}</Text>
        </Text>
      </Box>
    </Box>
  );
}
