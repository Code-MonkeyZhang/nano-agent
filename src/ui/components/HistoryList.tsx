import { Box, Text } from 'ink';
import type { HistoryItem } from '../types.js';
import { UserMessage } from './messages/UserMessage.js';
import { AgentMessage } from './messages/AgentMessage.js';
import { ToolMessage } from './messages/ToolMessage.js';
import { ErrorMessage } from './messages/ErrorMessage.js';
import { ThinkingMessage } from './messages/ThinkingMessage.js';
import { theme } from '../themes.js';

interface HistoryListProps {
  items: HistoryItem[];
}

export function HistoryList({ items }: HistoryListProps) {
  // 只在没有内容的时候, 在开头显示
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
      {/* 遍历渲染不同种类的Message */}
      {items.map((item, index) => {
        switch (item.type) {
          case 'user':
            return <UserMessage key={index} text={item.text} />;
          case 'agent':
            return <AgentMessage key={index} text={item.text} />;
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
          default:
            return null;
        }
      })}
    </Box>
  );
}
