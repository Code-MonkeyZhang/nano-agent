import { Box, Text } from 'ink';
import type { HistoryItem } from '../types.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { UserMessage } from './messages/UserMessage.js';
import { AgentMessage } from './messages/AgentMessage.js';
import { ToolMessage } from './messages/ToolMessage.js';
import { ErrorMessage } from './messages/ErrorMessage.js';
import { ThinkingMessage } from './messages/ThinkingMessage.js';
import { HelpMessage } from './messages/HelpMessage.js';
import { AboutMessage } from './messages/AboutMessage.js';
import { McpMessage } from './messages/McpMessage.js';
import { SkillMessage } from './messages/SkillMessage.js';
import { theme } from '../themes.js';
import type { AgentCore } from '../../agent.js';

interface HistoryListProps {
  items: HistoryItem[];
  agent: AgentCore;
}

export function HistoryList({ items, agent }: HistoryListProps) {
  const { terminalWidth } = useUIState();

  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.text.secondary} dimColor>
          Start a conversation...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {items.map((item, index) => {
        switch (item.type) {
          case 'user':
            return <UserMessage key={index} text={item.text} />;
          case 'agent':
            return (
              <AgentMessage
                key={index}
                text={item.text}
                terminalWidth={terminalWidth}
              />
            );
          case 'tool':
            return (
              <ToolMessage
                key={index}
                name={item.name}
                result={item.result}
                success={item.success}
              />
            );
          case 'thinking':
            return <ThinkingMessage key={index} text={item.text} />;
          case 'error':
            return <ErrorMessage key={index} text={item.text} />;
          case 'command':
            return (
              <Box key={index} flexDirection="column" paddingY={1}>
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
            return <HelpMessage key={index} />;
          case 'about':
            return <AboutMessage key={index} agent={agent} />;
          case 'mcp':
            return <McpMessage key={index} />;
          case 'skill':
            return <SkillMessage key={index} agent={agent} />;
          default:
            return null;
        }
      })}
    </Box>
  );
}
