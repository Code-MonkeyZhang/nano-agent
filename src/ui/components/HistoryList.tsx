import { Box, Text } from 'ink';
import type { HistoryItem } from '../types.js';
import { UserMessage } from './messages/UserMessage.js';
import { AgentMessage } from './messages/AgentMessage.js';
import { ToolMessage } from './messages/ToolMessage.js';
import { ErrorMessage } from './messages/ErrorMessage.js';
import { ThinkingMessage } from './messages/ThinkingMessage.js';

interface HistoryListProps {
  items: HistoryItem[];
}

export function HistoryList({ items }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <Box marginBottom={1}>
        <Text color="gray">Start a conversation...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
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
        }
      })}
    </Box>
  );
}
