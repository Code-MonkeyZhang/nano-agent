import { Box, Text } from 'ink';
import type { HistoryItem as HistoryItemType } from '../types.js';
import { UserMessage } from './messages/UserMessage.js';
import { AgentMessage } from './messages/AgentMessage.js';
import { ToolMessage } from './messages/ToolMessage.js';
import { ErrorMessage } from './messages/ErrorMessage.js';
import { ThinkingMessage } from './messages/ThinkingMessage.js';
import { HelpMessage } from './messages/HelpMessage.js';
import { AboutMessage } from './messages/AboutMessage.js';
import { McpMessage } from './messages/McpMessage.js';
import { SkillMessage } from './messages/SkillMessage.js';
import { ServerStatusMessage } from './messages/ServerStatusMessage.js';
import { theme } from '../themes.js';
import type { AgentCore } from '../../agent.js';

interface HistoryItemProps {
  item: HistoryItemType;
  agent: AgentCore;
  terminalWidth: number;
}

export function HistoryItem({ item, agent, terminalWidth }: HistoryItemProps) {
  switch (item.type) {
    case 'user':
      return <UserMessage text={item.text} />;
    case 'agent':
      return <AgentMessage text={item.text} terminalWidth={terminalWidth} />;
    case 'tool':
      return (
        <ToolMessage
          name={item.name}
          result={item.result}
          success={item.success}
        />
      );
    case 'thinking':
      return <ThinkingMessage text={item.text} />;
    case 'error':
      return (
        <ErrorMessage
          text={item.text}
          code={item.code}
          suggestion={item.suggestion}
        />
      );
    case 'command':
      return (
        <Box flexDirection="column" paddingY={1}>
          <Text
            color={
              item.messageType === 'error'
                ? theme.status.error
                : theme.text.accent
            }
          >
            {item.content}
          </Text>
        </Box>
      );
    case 'help':
      return <HelpMessage />;
    case 'about':
      return <AboutMessage agent={agent} />;
    case 'mcp':
      return <McpMessage />;
    case 'skill':
      return <SkillMessage agent={agent} />;
    case 'server_status':
      return <ServerStatusMessage state={item.state} />;
    default:
      return null;
  }
}
