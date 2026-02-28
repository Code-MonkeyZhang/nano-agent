import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { helpCommand } from './builtins/help.js';
import { aboutCommand } from './builtins/about.js';
import { repoCommand } from './builtins/repo.js';
import { mcpCommand } from './builtins/mcp.js';
import { skillCommand } from './builtins/skill.js';
import { serverCommands } from './builtins/server.js';

export interface ParsedCommand {
  command: SlashCommand | null;
  args: string;
  isValid: boolean;
}

export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    const builtins: SlashCommand[] = [
      helpCommand,
      aboutCommand,
      repoCommand,
      mcpCommand,
      skillCommand,
      ...serverCommands,
    ];

    for (const cmd of builtins) {
      this.register(cmd);
    }
  }

  register(command: SlashCommand): void {
    this.commands.set(command.name, command);

    if (command.altNames) {
      for (const alias of command.altNames) {
        this.aliases.set(alias, command.name);
      }
    }

    if (command.subCommands) {
      for (const subCmd of command.subCommands) {
        this.register(subCmd);
      }
    }
  }

  getCommands(): SlashCommand[] {
    return Array.from(this.commands.values()).filter((cmd) => !cmd.hidden);
  }

  parse(input: string): ParsedCommand {
    const trimmed = input.trim();

    if (!trimmed.startsWith('/')) {
      return { command: null, args: trimmed, isValid: false };
    }

    const withoutSlash = trimmed.substring(1);
    const parts = withoutSlash.split(/\s+/);
    const commandName = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1).join(' ');

    let command = this.commands.get(commandName);

    if (!command) {
      const mainName = this.aliases.get(commandName);
      if (mainName) {
        command = this.commands.get(mainName);
      }
    }

    if (!command) {
      return { command: null, args: trimmed, isValid: false };
    }

    return { command, args, isValid: true };
  }

  async execute(
    command: SlashCommand,
    context: CommandContext
  ): Promise<CommandResult> {
    return command.action(context);
  }

  getCompletions(partial: string): string[] {
    if (!partial.startsWith('/')) {
      return [];
    }

    const prefix = partial.substring(1).toLowerCase();
    const completions: string[] = [];

    for (const [name, cmd] of this.commands) {
      if (name.startsWith(prefix) && !cmd.hidden) {
        completions.push(`/${name}`);
      }
    }

    return completions;
  }
}

let registryInstance: CommandRegistry | null = null;

export function getCommandRegistry(): CommandRegistry {
  if (!registryInstance) {
    registryInstance = new CommandRegistry();
  }
  return registryInstance;
}
