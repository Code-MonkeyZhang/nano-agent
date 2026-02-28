import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import { getMcpConnections } from '../../../tools/mcp/index.js';

export function McpMessage() {
  const connections = getMcpConnections();

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderColor={theme.border.default}
      borderStyle="round"
      paddingX={1}
    >
      <Text bold color={theme.text.accent}>
        MCP Servers
      </Text>
      <Box height={1} />
      {connections.length === 0 ? (
        <Text color={theme.text.secondary}>No MCP servers connected</Text>
      ) : (
        connections.map((conn) => (
          <Box key={conn.name} flexDirection="column">
            <Text color={theme.text.primary}>
              <Text bold color={theme.text.accent}>
                {`  ${conn.name}`}
              </Text>
              {` (${conn.connectionType}) - ${conn.tools.length} tools`}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}
