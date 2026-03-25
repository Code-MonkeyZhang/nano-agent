/**
 * @fileoverview 消息的核心类型定义。
 * TODO: 如果支持多模态这些都要改
 */

/**
 * 多模态消息的内容块。
 * TODO: 目前支持文本，但可扩展为其他内容类型。
 */
export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * 包含system prompt的系统消息。
 */
export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
}

/**
 * 助手消息中的工具调用。
 * 表示模型请求的函数调用。
 */
export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * 助手消息，包含可选的思考和工具调用。
 */
export interface AssistantMessage {
  role: 'assistant';
  content?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
}

/**
 * 包含执行结果的工具结果消息。
 * 工具执行完成后发送回模型。
 */
export interface ToolResultMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
  tool_name?: string;
}

export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage;
