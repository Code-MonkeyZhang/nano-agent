/**
 * @fileoverview 工具系统的基础类型和接口。
 */

export type JsonSchema = Record<string, unknown>;
export type ToolInput = Record<string, unknown>;

/**
 * 工具执行结果的统一结构。
 * 所有工具必须以此格式返回结果以便统一处理。
 */
export interface ToolResult {
  success: boolean;
  content: string;
  error?: string | null;
}

/**
 * 带额外元数据的工具结果类型。
 * 用于需要返回结构化数据的工具（如 Bash）。
 */
export type ToolResultWithMeta<
  TMeta extends Record<string, unknown> = Record<string, never>,
> = ToolResult & TMeta;

/**
 * 工具接口 - 所有工具必须实现此接口。
 *
 * @template Input - 输入参数类型（继承自ToolInput）
 * @template Output - 执行结果类型（继承自ToolResult）
 */
export interface Tool<
  Input extends ToolInput = ToolInput,
  Output extends ToolResult = ToolResult,
> {
  name: string;
  description?: string;
  parameters: JsonSchema;
  /**
   * 使用给定参数执行工具。
   * @param params - 与JSON Schema匹配的输入参数
   * @returns 解析为ToolResult的Promise
   */
  execute(params: Input): Promise<Output>;
}
