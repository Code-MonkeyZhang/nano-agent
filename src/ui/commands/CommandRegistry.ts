/**
 * 命令注册表模块
 *
 * 职责:
 * - 管理和注册所有斜杠命令 (/help, /about, /mcp 等)
 * - 解析用户输入,区分命令和普通消息
 * - 单例模式,全局共享命令注册表
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { helpCommand } from './builtins/help.js';
import { aboutCommand } from './builtins/about.js';
import { repoCommand } from './builtins/repo.js';
import { mcpCommand } from './builtins/mcp.js';
import { skillCommand } from './builtins/skill.js';
import { serverCommands } from './builtins/server.js';

export interface ParsedCommand {
  /** 解析到的命令对象 (null 表示不是有效命令) */
  command: SlashCommand | null;
  args: string;
  isValid: boolean;
}

/**
 * 命令注册表类
 *
 * 管理所有斜杠命令的注册、解析和执行
 * 使用单例模式,通过 getCommandRegistry() 获取实例
 */
export class CommandRegistry {
  /** 命令名 -> 命令对象的映射 */
  private commands: Map<string, SlashCommand> = new Map();

  constructor() {
    // 构造函数中注册内置命令
    this.registerBuiltins();
  }

  /**
   * 注册内置命令
   * 包括: help, about, repo, mcp, skill, server 等
   */
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

  /**
   * 注册一个命令
   *
   * @param command - 要注册的命令对象
   */
  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
  }

  /**
   * 获取所有命令列表
   *
   * @returns 命令数组
   */
  getCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 解析用户输入
   * 判断是命令还是普通消息
   *
   * 解析逻辑:
   * 1. 不以 / 开头 → 普通消息
   * 2. 以 / 开头 → 查找命令
   *    - 找到 → 返回命令和参数
   *    - 找不到 → 当作普通消息
   *
   * @param input - 用户输入文本
   * @returns 解析结果
   */
  parse(input: string): ParsedCommand {
    const trimmed = input.trim();

    // ===== 1. 检查是否以 / 开头 =====
    if (!trimmed.startsWith('/')) {
      // 不是命令,当作普通消息
      return { command: null, args: trimmed, isValid: false };
    }

    // ===== 2. 提取命令名和参数 =====
    const withoutSlash = trimmed.substring(1); // 去掉开头的 /
    const parts = withoutSlash.split(/\s+/); // 按空格分割
    const commandName = parts[0]?.toLowerCase() ?? ''; // 命令名 (转小写)
    const args = parts.slice(1).join(' '); // 参数 (合并剩余部分)

    // ===== 3. 查找命令 =====
    const command = this.commands.get(commandName);

    // ===== 4. 没找到命令 → 当作普通消息 =====
    if (!command) {
      return { command: null, args: trimmed, isValid: false };
    }

    // ===== 5. 找到命令 → 返回 =====
    return { command, args, isValid: true };
  }

  /**
   * 执行命令
   *
   * @param command - 要执行的命令对象
   * @param context - 命令执行上下文 (包含 agent 等)
   * @returns 命令执行结果
   */
  async execute(
    command: SlashCommand,
    context: CommandContext
  ): Promise<CommandResult> {
    return command.action(context);
  }
}

// ===== 单例实例 =====

/** 命令注册表单例实例 */
let registryInstance: CommandRegistry | null = null;

/**
 * 获取命令注册表单例
 * 首次调用时创建实例,后续返回同一实例
 *
 * @returns CommandRegistry 实例
 */
export function getCommandRegistry(): CommandRegistry {
  if (!registryInstance) {
    registryInstance = new CommandRegistry();
  }
  return registryInstance;
}
