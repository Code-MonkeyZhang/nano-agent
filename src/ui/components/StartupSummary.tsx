/**
 * 启动摘要组件
 *
 * 职责:
 * - 显示 Agent 启动后的配置信息摘要
 * - 仅显示关键信息: Model、Provider、MCP 服务器数量、Skills 数量
 * - 用户输入后自动隐藏
 */

import { Box, Text } from 'ink';
import { theme } from '../themes.js';
import type { AgentCore } from '../../agent.js';

interface StartupSummaryProps {
  agent: AgentCore;
}

/**
 * 启动摘要组件
 * 在用户开始交互前显示配置信息
 */
export function StartupSummary({ agent }: StartupSummaryProps) {
  const config = agent.config;

  // 计算 MCP 工具数量 (排除内置工具)
  const mcpCount = Array.from(agent.tools.values()).filter(
    (tool) =>
      ![
        'read',
        'write',
        'edit',
        'bash',
        'bash_output',
        'bash_kill',
        'get_skill',
      ].includes(tool.name)
  ).length;

  // 获取 Skills 数量
  const skillsCount = agent.listSkills().length;

  // 显示项目列表
  const items = [
    { label: 'Model', value: config.llm.model },
    { label: 'Provider', value: config.llm.provider },
    { label: 'MCP Servers', value: `${mcpCount} connected` },
    { label: 'Skills', value: `${skillsCount} loaded` },
  ];

  // ===== 渲染 =====
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* 标题 */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Nano-Agent
        </Text>
        <Text dimColor color={theme.text.secondary}>
          {' '}
          - AI Agent with MCP Support
        </Text>
      </Box>

      {/* 配置信息列表 */}
      <Box flexDirection="column" paddingX={1}>
        {items.map((item, index) => (
          <Box key={index}>
            {/* 标签 (固定宽度 14) */}
            <Box width={14}>
              <Text bold color={theme.text.primary}>
                {item.label}
              </Text>
            </Box>
            {/* 值 */}
            <Text color={theme.text.secondary}>: {item.value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
