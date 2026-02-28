import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import type { AgentCore } from '../../../agent.js';

interface AboutMessageProps {
  agent: AgentCore;
}

export function AboutMessage({ agent }: AboutMessageProps) {
  const config = agent.config;

  const info = [
    { label: 'Version', value: '1.0.0' },
    { label: 'Model', value: config.llm.model },
    { label: 'Provider', value: config.llm.provider },
    { label: 'API Base', value: config.llm.apiBase },
    { label: 'Max Steps', value: String(config.agent.maxSteps) },
    { label: 'Workspace', value: agent.workspaceDir },
    { label: 'Tools', value: `${agent.tools.size} loaded` },
  ];

  const maxLabelLen = Math.max(...info.map((i) => i.label.length));

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderColor={theme.border.default}
      borderStyle="round"
      paddingX={1}
    >
      <Text bold color={theme.text.accent}>
        About Nano-Agent
      </Text>
      <Box height={1} />
      {info.map((item) => (
        <Text key={item.label} color={theme.text.primary}>
          <Text bold>{`${item.label}:`}</Text>
          {' '.repeat(maxLabelLen - item.label.length + 1)}
          <Text color={theme.text.secondary}>{item.value}</Text>
        </Text>
      ))}
    </Box>
  );
}
