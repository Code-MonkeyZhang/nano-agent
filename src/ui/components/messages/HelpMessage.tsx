import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import { getCommandRegistry } from '../../commands/CommandRegistry.js';
import { CommandKind } from '../../commands/types.js';

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
        .filter((command) => command.description && !command.hidden)
        .map((command) => (
          <Box key={command.name} flexDirection="column">
            <Text color={theme.text.primary}>
              <Text bold color={theme.text.accent}>
                {`  /${command.name}`}
              </Text>
              {command.kind === CommandKind.FILE && (
                <Text color={theme.text.secondary}> [FILE]</Text>
              )}
              {` - ${command.description}`}
            </Text>
            {command.altNames && command.altNames.length > 0 && (
              <Text color={theme.text.secondary}>
                {`     aliases: ${command.altNames.map((a) => `/${a}`).join(', ')}`}
              </Text>
            )}
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
