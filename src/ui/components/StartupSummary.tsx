import { Box, Text } from 'ink';
import { theme } from '../themes.js';
import type { AgentCore } from '../../agent.js';

interface StartupSummaryProps {
  agent: AgentCore;
}

export function StartupSummary({ agent }: StartupSummaryProps) {
  const config = agent.runConfig;

  const builtinToolNames = new Set([
    'read',
    'write',
    'edit',
    'bash',
    'bash_output',
    'bash_kill',
    'get_skill',
  ]);

  const builtinCount = Array.from(agent.tools.values()).filter((tool) =>
    builtinToolNames.has(tool.name)
  ).length;

  const items = [
    { label: 'Agent', value: config.agentName },
    { label: 'Model', value: config.model.name ?? config.modelId },
    { label: 'Provider', value: config.provider },
    {
      label: 'MCP Servers',
      value: `${config.mcpServerNames.length} configured`,
    },
    { label: 'Builtin Tools', value: `${builtinCount} loaded` },
    { label: 'Skills', value: `${config.skills.length} loaded` },
  ];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Nano-Agent
        </Text>
        <Text dimColor color={theme.text.secondary}>
          {' '}
          - AI Agent with MCP Support
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        {items.map((item, index) => (
          <Box key={index}>
            <Box width={14}>
              <Text bold color={theme.text.primary}>
                {item.label}
              </Text>
            </Box>
            <Text color={theme.text.secondary}>: {item.value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
