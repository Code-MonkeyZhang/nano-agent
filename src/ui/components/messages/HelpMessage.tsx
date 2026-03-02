import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import { getCommandRegistry } from '../../commands/CommandRegistry.js';

export function HelpMessage() {
  const registry = getCommandRegistry();
  const commands = registry.getCommands();

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderColor={theme.border.default}
      borderStyle="round"
      paddingX={1}
    >
      <Text bold color={theme.text.accent}>
        Nano-Agent Help
      </Text>
      <Box height={1} />
      <Text bold color={theme.text.primary}>
        Commands:
      </Text>
      {commands
        .filter((command) => command.description)
        .map((command) => (
          <Box key={command.name} flexDirection="column">
            <Text color={theme.text.primary}>
              <Text bold color={theme.text.accent}>
                {`  /${command.name}`}
              </Text>
              {` - ${command.description}`}
            </Text>
          </Box>
        ))}
      <Box height={1} />
      <Text bold color={theme.text.primary}>
        Tips:
      </Text>
      <Text color={theme.text.primary}>
        <Text bold color={theme.text.accent}>
          {'  /'}
        </Text>
        {' - Type / followed by command name to execute'}
      </Text>
    </Box>
  );
}
